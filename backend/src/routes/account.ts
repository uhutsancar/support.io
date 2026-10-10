// The signed-in account's own security settings (plan v10 SEC-03, SEC-04).
//
//   POST /api/auth/change-password       current + new password
//   POST /api/auth/change-email          password + new address → link to it
//   POST /api/auth/confirm-email-change  the link's token (no session needed)
//   POST /api/auth/sessions/revoke       sign out every other device
//   GET  /api/auth/2fa                   status
//   POST /api/auth/2fa/setup             password → secret + otpauth address
//   POST /api/auth/2fa/confirm           first code → on, recovery codes once
//   POST /api/auth/2fa/disable           password + code
//   POST /api/auth/2fa/recovery-codes    password + code → new codes
//   PUT  /api/auth/organization-security owner/admin: require 2FA for everyone
//
// Every change that matters asks for the password again, whatever the
// session says: a session left open on a shared computer must not be enough
// to lock the owner out. Changes are counted per account (5 an hour) and
// leave an audit row; the owner of the address hears about each one.

import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import Team from '../models/Team';
import Organization from '../models/Organization';
import events from '../events';
import { auth } from '../middleware/auth';
import { accountChangeLimiter, requireSharedRateLimits } from '../middleware/rateLimit';
import { startSession, SESSION_TTL_SECONDS } from '../config/session';
import { bindSessionForStepUp, signRecentAuth, signSession } from '../config/tokens';
import type { RecentAuthPurpose } from '../config/tokens';
import { assertPasswordAllowed } from '../config/passwords';
import { isDisposableEmail } from '../config/emailPolicy';
import { asyncHandler, HttpError, forbidden } from '../http';
import { consumeEmailChange, issueAuthToken, revokeAuthTokens } from '../services/authTokens';
import { appBaseUrl, mail } from '../services/mail';
import {
  beginEnrollment,
  confirmEnrollment,
  disableMfa,
  mfaEnabled,
  recoveryCodesLeft,
  regenerateRecoveryCodes,
  verifySecondStep
} from '../services/mfa';
import { planIncludes } from '../domain/plans';
import { getPlan } from '../services/entitlements';
import { mailLocale, sessionClaims } from './auth';
import { referralSummary } from '../services/referrals';
import type { Request, Response } from 'express';
import { invalidateAdminAccount, invalidateOrganization } from '../realtime/invalidation';

const router = express.Router();

const resetLink = () => `${appBaseUrl()}/forgot-password`;

function audit(req: Request, event: string, metadata: Record<string, unknown> = {}) {
  events.emit(event, {
    organizationId: req.user.organizationId,
    userId: req.user._id,
    metadata: { userType: req.userType, ...metadata },
    ip: req.ip,
    ua: req.get('user-agent')
  });
}

/** The password typed again for a sensitive change; 400 when it is wrong. */
async function assertPassword(req: Request): Promise<void> {
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password || !(await req.user.comparePassword(password))) {
    throw new HttpError(400, 'The password is not correct', 'PASSWORD_INCORRECT');
  }
}

/** Ends every other session of the account and gives this browser a new one. */
function rotateSessions(req: Request, res: Response): string {
  req.user.sessionVersion = (req.user.sessionVersion ?? 0) + 1;
  return startSession(res, signSession(sessionClaims(req.user, req.userType), SESSION_TTL_SECONDS));
}

// ----------------------------------------------------------------- password

router.post(
  '/change-password',
  auth,
  accountChangeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = req.body?.newPassword;
    if (!currentPassword || !(await req.user.comparePassword(currentPassword))) {
      throw new HttpError(400, 'The current password is not correct', 'PASSWORD_INCORRECT');
    }
    assertPasswordAllowed(newPassword, { email: req.user.email });
    if (newPassword === currentPassword) {
      throw new HttpError(400, 'Choose a password you have not used here', 'PASSWORD_UNCHANGED');
    }

    req.user.password = newPassword;
    const csrfToken = rotateSessions(req, res);
    await req.user.save();
    invalidateAdminAccount(req.user._id);
    // Links mailed before the change would otherwise still set a password.
    await revokeAuthTokens({ id: req.user._id, type: req.userType }, 'reset');

    audit(req, 'auth.password.changed');
    void mail.sendPasswordChanged(req.user.email, {
      name: req.user.name,
      link: resetLink(),
      locale: mailLocale(req)
    });
    res.json({ changed: true, csrfToken });
  })
);

// ------------------------------------------------------------------- e-mail

async function addressTaken(email: string): Promise<boolean> {
  return Boolean(
    (await User.findOne({ email, isActive: true })) ||
    (await Team.findOne({ email, isActive: true }))
  );
}

const EMAIL_CHANGE_SENT = {
  message: 'If the address can be used, a confirmation link is on its way to it.'
};

// A ten-minute, exact-session and exact-purpose proof for account binding
// changes. MFA accounts must prove both factors; the resulting JWT grants
// only the named action and is useless as a login session.
router.post(
  '/recent-auth',
  auth,
  requireSharedRateLimits,
  accountChangeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const purpose = req.body?.purpose as RecentAuthPurpose;
    if (purpose !== 'google-link' && purpose !== 'google-unlink') {
      throw new HttpError(400, 'Unknown recent-auth purpose', 'RECENT_AUTH_PURPOSE');
    }
    await assertPassword(req);
    if (mfaEnabled(req.user)) {
      const second = await verifySecondStep(req.user, req.userType, {
        code: req.body?.code,
        recoveryCode: req.body?.recoveryCode
      });
      if (!second) throw new HttpError(400, 'The verification code is not valid', 'MFA_INVALID');
    }
    const proof = signRecentAuth({
      purpose,
      userId: String(req.user._id),
      userType: req.userType,
      sv: req.user.sessionVersion ?? 0,
      sessionBinding: bindSessionForStepUp(req.token)
    });
    res.set('Cache-Control', 'no-store').json({ proof, expiresIn: 10 * 60 });
  })
);

router.post(
  '/change-email',
  auth,
  accountChangeLimiter,
  [body('newEmail').isEmail().normalizeEmail()],
  asyncHandler(async (req: Request, res: Response) => {
    await assertPassword(req);
    if (!validationResult(req).isEmpty()) {
      throw new HttpError(400, 'Enter a valid e-mail address', 'EMAIL_INVALID');
    }
    const newEmail: string = req.body.newEmail;
    if (newEmail === req.user.email) {
      throw new HttpError(400, 'This is already your address', 'EMAIL_UNCHANGED');
    }
    if (isDisposableEmail(newEmail)) {
      throw new HttpError(400, 'Please use a permanent e-mail address', 'EMAIL_DISPOSABLE');
    }

    // An address another account uses gets the same answer and no mail:
    // this form must not tell a signed-in user who else has an account.
    if (!(await addressTaken(newEmail))) {
      const token = await issueAuthToken({ id: req.user._id, type: req.userType }, 'email_change', {
        newEmail,
        oldEmail: req.user.email
      });
      void mail.sendEmailChange(newEmail, {
        name: req.user.name,
        link: `${appBaseUrl()}/confirm-email?token=${encodeURIComponent(token)}`,
        locale: mailLocale(req)
      });
      void mail.sendEmailChangeNotice(req.user.email, {
        name: req.user.name,
        newEmail,
        changed: false,
        link: resetLink(),
        locale: mailLocale(req)
      });
    }
    audit(req, 'auth.email.change_requested');
    res.json(EMAIL_CHANGE_SENT);
  })
);

router.post(
  '/confirm-email-change',
  asyncHandler(async (req: Request, res: Response) => {
    const changed = await consumeEmailChange(req.body?.token);
    if (changed.status === 'invalid') {
      throw new HttpError(400, 'This link is invalid or has expired', 'INVALID_TOKEN');
    }
    if (changed.status === 'taken') {
      // Someone took the address between the request and the click.
      throw new HttpError(409, 'This address is no longer available', 'EMAIL_TAKEN');
    }
    invalidateAdminAccount(changed.id);

    events.emit('auth.email.changed', {
      organizationId: changed.organizationId,
      userId: changed.id,
      metadata: { userType: changed.type },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    if (changed.oldEmail) {
      void mail.sendEmailChangeNotice(changed.oldEmail, {
        name: changed.name,
        newEmail: changed.newEmail,
        changed: true,
        link: resetLink(),
        locale: mailLocale(req)
      });
    }
    res.json({ changed: true, email: changed.newEmail });
  })
);

// ----------------------------------------------------------------- sessions

router.post(
  '/sessions/revoke',
  auth,
  accountChangeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const csrfToken = rotateSessions(req, res);
    await req.user.save();
    invalidateAdminAccount(req.user._id);
    audit(req, 'auth.sessions.revoked');
    void mail.sendSecurityNotice(req.user.email, {
      name: req.user.name,
      event: 'sessions_revoked',
      link: resetLink(),
      locale: mailLocale(req)
    });
    res.json({ revoked: true, csrfToken });
  })
);

// ----------------------------------------------------------- two-step sign-in

router.get(
  '/2fa',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({
      enabled: mfaEnabled(req.user),
      recoveryCodesLeft: mfaEnabled(req.user) ? recoveryCodesLeft(req.user) : 0,
      enforcedByOrganization: Boolean(req.organization?.enforce2fa)
    });
  })
);

router.post(
  '/2fa/setup',
  auth,
  accountChangeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    await assertPassword(req);
    if (mfaEnabled(req.user)) {
      throw new HttpError(409, 'Two-step verification is already on', 'MFA_ALREADY_ENABLED');
    }
    // The secret goes to the browser once, to draw the QR code there; it is
    // never logged and never sent again.
    const { secret, uri } = await beginEnrollment(req.user, req.userType);
    res.set('Cache-Control', 'no-store').json({ secret, otpauthUri: uri });
  })
);

router.post(
  '/2fa/confirm',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    const codes = await confirmEnrollment(req.user, req.userType, req.body?.code);
    if (!codes) throw new HttpError(400, 'The code is not correct', 'MFA_CODE_INVALID');
    // Existing sessions predate the second step; they end here.
    const csrfToken = rotateSessions(req, res);
    await req.user.save();
    invalidateAdminAccount(req.user._id);
    audit(req, 'auth.mfa.enabled');
    void mail.sendSecurityNotice(req.user.email, {
      name: req.user.name,
      event: 'mfa_enabled',
      link: resetLink(),
      locale: mailLocale(req)
    });
    res.set('Cache-Control', 'no-store').json({ enabled: true, recoveryCodes: codes, csrfToken });
  })
);

/** Password and a current code (or a recovery code), for the changes below. */
async function assertSecondStep(req: Request): Promise<void> {
  await assertPassword(req);
  const ok = await verifySecondStep(req.user, req.userType, {
    code: req.body?.code,
    recoveryCode: req.body?.recoveryCode
  });
  if (!ok) throw new HttpError(400, 'The code is not correct', 'MFA_CODE_INVALID');
}

router.post(
  '/2fa/disable',
  auth,
  accountChangeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!mfaEnabled(req.user)) {
      res.json({ enabled: false });
      return;
    }
    if (req.organization?.enforce2fa) {
      throw forbidden('Your organization requires two-step verification', 'MFA_ENFORCED');
    }
    await assertSecondStep(req);
    await disableMfa(req.user, req.userType);
    req.user.sessionVersion = (req.user.sessionVersion ?? 0) + 1;
    await req.user.save();
    invalidateAdminAccount(req.user._id);
    audit(req, 'auth.mfa.disabled');
    void mail.sendSecurityNotice(req.user.email, {
      name: req.user.name,
      event: 'mfa_disabled',
      link: resetLink(),
      locale: mailLocale(req)
    });
    res.json({ enabled: false });
  })
);

router.post(
  '/2fa/recovery-codes',
  auth,
  accountChangeLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (!mfaEnabled(req.user)) {
      throw new HttpError(409, 'Two-step verification is off', 'MFA_NOT_ENABLED');
    }
    await assertSecondStep(req);
    const codes = await regenerateRecoveryCodes(req.user, req.userType);
    res.set('Cache-Control', 'no-store').json({ recoveryCodes: codes });
  })
);

// ----------------------------------------------------- notification settings

/**
 * How this account hears about chats (PRD-01, PRD-02): unanswered-chat mails
 * at once / hourly / never, which events raise a desktop notification, the
 * sound, and the language mails go out in. Only these keys are written.
 */
router.get(
  '/preferences',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ preferences: notificationPreferences(req.user.preferences) });
  })
);

router.put(
  '/preferences',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const current = notificationPreferences(req.user.preferences);
    const desktop = (body.desktop ?? {}) as Record<string, unknown>;
    const pickBool = (value: unknown, fallback: boolean) =>
      typeof value === 'boolean' ? value : fallback;
    const next = {
      missedChatEmail: ['instant', 'hourly', 'off'].includes(String(body.missedChatEmail))
        ? (body.missedChatEmail as 'instant' | 'hourly' | 'off')
        : current.missedChatEmail,
      desktop: {
        newConversation: pickBool(desktop.newConversation, current.desktop.newConversation),
        assigned: pickBool(desktop.assigned, current.desktop.assigned),
        allMessages: pickBool(desktop.allMessages, current.desktop.allMessages)
      },
      notificationSound: pickBool(body.notificationSound, current.notificationSound),
      activationEmails: pickBool(body.activationEmails, current.activationEmails),
      weeklyReport: pickBool(body.weeklyReport, current.weeklyReport),
      locale: body.locale === 'en' || body.locale === 'tr' ? body.locale : current.locale
    };
    req.user.preferences = {
      ...(req.user.preferences || {}),
      ...next
    } as typeof req.user.preferences;
    await req.user.save();
    res.json({ preferences: next });
  })
);

function notificationPreferences(stored: unknown) {
  const prefs = (stored && typeof stored === 'object' ? stored : {}) as Record<string, any>;
  return {
    missedChatEmail: (['instant', 'hourly', 'off'].includes(prefs.missedChatEmail)
      ? prefs.missedChatEmail
      : 'instant') as 'instant' | 'hourly' | 'off',
    desktop: {
      newConversation: prefs.desktop?.newConversation !== false,
      assigned: prefs.desktop?.assigned !== false,
      allMessages: prefs.desktop?.allMessages === true
    },
    notificationSound: prefs.notificationSound !== false,
    activationEmails: prefs.activationEmails !== false,
    weeklyReport: prefs.weeklyReport !== false,
    locale: (prefs.locale === 'en' ? 'en' : 'tr') as 'tr' | 'en'
  };
}

// ------------------------------------------------------- referral (PRD-23)

/** The owner's referral link and how it has done. */
router.get(
  '/referral',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.organization || req.user.role !== 'owner') {
      throw forbidden('Only the owner can see the referral link', 'FORBIDDEN');
    }
    res.json(await referralSummary(String(req.organization._id)));
  })
);

// ------------------------------------------------- organization: require 2FA

router.put(
  '/organization-security',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.organization || !['owner', 'admin'].includes(String(req.user.role))) {
      throw forbidden('Only the owner or an admin can change this', 'FORBIDDEN');
    }
    const enforce2fa = req.body?.enforce2fa === true;
    const plan = await getPlan(String(req.organization._id));
    if (enforce2fa && !planIncludes(plan, 'security')) {
      throw new HttpError(
        403,
        'Requiring two-step verification is an Enterprise feature',
        'PLAN_FEATURE_REQUIRED',
        {
          feature: 'security'
        }
      );
    }
    // Whoever switches it on must not be the first one locked out.
    if (enforce2fa && !mfaEnabled(req.user)) {
      throw new HttpError(
        409,
        'Turn on two-step verification for your own account first',
        'MFA_REQUIRED_FIRST'
      );
    }
    const organization = await Organization.findById(String(req.organization._id));
    if (!organization) throw forbidden('Organization not found', 'ORGANIZATION_INACTIVE');
    organization.enforce2fa = enforce2fa;
    await organization.save();
    invalidateOrganization(organization._id);
    audit(req, 'organization.security.updated', { enforce2fa });
    res.json({ enforce2fa });
  })
);

export default router;
