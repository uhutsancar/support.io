// Registration, sign-in and the session's lifecycle.
//
// The session token is never returned in the response body: it is written to an
// httpOnly cookie the browser attaches by itself and JavaScript cannot read.
// The `csrfToken` that *is* returned grants nothing — it only proves a request
// came from the panel. See config/session.ts for both halves of that design.
//
// Sign-up is e-mail first (plan v10 SEC-06): POST /register answers the same
// whether or not the address already has an account, and the session starts
// when the link in the verification mail is opened. An owner account cannot
// sign in with its password before its address is verified, so an address
// typed by someone else never becomes a working account. Accounts with
// two-step sign-in get a five-minute pending token from /login and their
// session from /login/2fa.
//
// Changing the password or the address and two-step enrolment live in
// routes/account.ts.

import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User';
import Team from '../models/Team';
import Organization from '../models/Organization';
import Site from '../models/Site';
import events from '../events';
import { auth } from '../middleware/auth';
import { startSession, endSession, SESSION_TTL_SECONDS } from '../config/session';
import { deleteOrganization } from '../services/organizationDeletion';
import { signMfaPending, signSession, verifyMfaPending } from '../config/tokens';
import {
  assertPasswordAllowed,
  burnVerification,
  hashPassword,
  needsRehash,
  PASSWORD_MIN_LENGTH
} from '../config/passwords';
import { isDisposableEmail } from '../config/emailPolicy';
import { PRESENCE_STATUSES, isPresenceStatus } from '../domain';
import { asyncHandler, badRequest, HttpError, unauthorized } from '../http';
import {
  consumeAuthToken,
  issueAuthToken,
  passwordFingerprint,
  revokeAuthTokens
} from '../services/authTokens';
import { appBaseUrl, mail } from '../services/mail';
import { mfaEnabled, recoveryCodesLeft, verifySecondStep } from '../services/mfa';
import { turnstileSiteKey, verifyTurnstile } from '../services/turnstile';
import { startTrial, trialRunning } from '../services/trial';
import { getPlan } from '../services/entitlements';
import type { PlanType } from '../domain';
import {
  forgotPasswordAccountLimiter,
  forgotPasswordLimiter,
  mfaLimiter,
  resendVerificationLimiter
} from '../middleware/rateLimit';
import type { MailLocale } from '../services/mail';
import type { Request, Response } from 'express';
import type {
  AuthenticatedOrganization,
  AuthTokenPayload,
  AuthenticatedUser,
  UserType
} from '../types/auth';

const router = express.Router();

const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2-50 characters')
];

const validateLogin = [body('email').isEmail().normalizeEmail(), body('password').notEmpty()];

/** Throws the first validation message, or nothing when the body is fine. */
function assertValid(req: Request, genericMessage?: string): void {
  const errors = validationResult(req);
  if (errors.isEmpty()) return;
  // Sign-in reports a generic message: telling a caller which half of the
  // credentials was malformed helps enumerate accounts.
  throw badRequest(genericMessage ?? String(errors.array()[0].msg));
}

/**
 * The account, as every endpoint here returns it.
 *
 * The three handlers each built this object separately and they had drifted:
 * register returned `isOnboarded` and `_id`, login returned those plus
 * `avatar`, and `/me` returned a nested `organization` instead of
 * `organizationId`. The panel then had to cope with all three shapes.
 */
export function accountResponse(
  user: AuthenticatedUser,
  userType: UserType,
  organization?: AuthenticatedOrganization | null,
  /** The plan in force (trial, subscription); the stored one when omitted. */
  plan?: PlanType
) {
  return {
    id: user._id,
    _id: user._id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatar: user.avatar ?? null,
    status: user.status,
    // Only a User account carries the onboarding flag; a Team agent is invited
    // into an organization that is already set up, so they are always done.
    isOnboarded: userType === 'team' ? true : 'isOnboarded' in user ? user.isOnboarded : false,
    emailVerified: Boolean(user.emailVerifiedAt),
    organizationId: user.organizationId ?? null,
    userType,
    mfaEnabled: mfaEnabled(user),
    // The organization asks every member for a second step and this account
    // has none yet: the panel shows the set-up screen and nothing else.
    mfaSetupRequired: Boolean(organization?.enforce2fa) && !mfaEnabled(user),
    ...(organization !== undefined
      ? {
          organization: organization
            ? {
                id: organization._id,
                name: organization.name,
                planType: plan ?? organization.planType,
                enforce2fa: Boolean(organization.enforce2fa),
                trialEndsAt:
                  plan === 'PRO' &&
                  organization.planType === 'FREE' &&
                  trialRunning(organization.trialEndsAt)
                    ? organization.trialEndsAt
                    : null
              }
            : null
        }
      : {})
  };
}

/** The session claims for an account, its current session version included. */
export function sessionClaims(user: AuthenticatedUser, userType: UserType): AuthTokenPayload {
  const claims: AuthTokenPayload = {
    userId: user._id,
    userType,
    role: user.role,
    sv: user.sessionVersion ?? 0
  };
  if (user.organizationId) claims.organizationId = user.organizationId;
  return claims;
}

/** The language a mail goes out in: the panel's, when it says. */
export function mailLocale(req: Request): MailLocale {
  const asked = String(req.body?.locale || req.get('accept-language') || '').toLowerCase();
  return asked.startsWith('en') ? 'en' : 'tr';
}

/** Mails the account a fresh verification link, bound to its current password. */
async function sendVerification(
  req: Request,
  user: AuthenticatedUser,
  userType: UserType
): Promise<boolean> {
  const token = await issueAuthToken({ id: user._id, type: userType }, 'verify', {
    pw: passwordFingerprint(user.password)
  });
  return mail.sendVerification(user.email, {
    name: user.name,
    link: `${appBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`,
    locale: mailLocale(req)
  });
}

/** The active account behind an address, in either table. */
async function accountByEmail(
  email: string
): Promise<{ user: AuthenticatedUser; userType: UserType } | null> {
  const user = await User.findOne({ email, isActive: true });
  if (user) return { user, userType: 'user' };
  const team = await Team.findOne({ email, isActive: true });
  return team ? { user: team, userType: 'team' } : null;
}

/** The account a spent token belongs to. */
export async function accountById(
  id: string,
  userType: UserType
): Promise<AuthenticatedUser | null> {
  return userType === 'team'
    ? Team.findOne({ _id: id, isActive: true })
    : User.findOne({ _id: id, isActive: true });
}

const invalidToken = () =>
  new HttpError(400, 'This link is invalid or has expired', 'INVALID_TOKEN');

/** Every account belongs to an organization; one is created if it has none. */
async function organizationFor(user: AuthenticatedUser): Promise<unknown> {
  if (user.organizationId) return user.organizationId;
  const organization = new Organization({ name: `${user.name}'s Organization`, planType: 'FREE' });
  await organization.save();
  return organization._id;
}

/**
 * The organization behind the host a failed sign-in was aimed at.
 *
 * Best-effort: it only enriches an audit record, so it must never fail the
 * request. Unlike the empty catch this replaces, the reason is logged.
 */
async function organizationForHost(host: string | undefined): Promise<unknown> {
  if (!host) return null;
  try {
    const site = await Site.findOne({ domain: host }).select('organizationId');
    return site?.organizationId ?? null;
  } catch (error) {
    console.error('[auth] could not resolve organization for host', host, error);
    return null;
  }
}

/** Starts a session for an account that has passed every step. */
async function completeSignIn(
  req: Request,
  res: Response,
  user: AuthenticatedUser,
  userType: UserType,
  how: Record<string, unknown> = {}
) {
  user.organizationId = await organizationFor(user);
  user.status = 'online';
  await user.save();

  events.emit('auth.login.success', {
    organizationId: user.organizationId,
    userId: user._id,
    metadata: { userType, ...how },
    ip: req.ip,
    ua: req.get('user-agent')
  });

  const organization = user.organizationId
    ? await Organization.findOne({ _id: user.organizationId, isActive: true })
    : null;
  const plan = organization ? await getPlan(String(organization._id)) : undefined;
  res.json({
    user: accountResponse(user, userType, organization, plan),
    csrfToken: startSession(res, signSession(sessionClaims(user, userType), SESSION_TTL_SECONDS))
  });
}

/**
 * What the sign-up and sign-in forms need before the user types anything:
 * the Turnstile site key (public by design) and the password length rule.
 */
router.get('/config', (_req: Request, res: Response) => {
  res.set('Cache-Control', 'public, max-age=300').json({
    turnstileSiteKey: turnstileSiteKey() || null,
    passwordMinLength: PASSWORD_MIN_LENGTH
  });
});

const VERIFICATION_SENT = { verificationSent: true };

router.post(
  '/register',
  validateRegistration,
  asyncHandler(async (req: Request, res: Response) => {
    assertValid(req);
    const { email, password, name } = req.body;
    assertPasswordAllowed(password, { email });
    if (isDisposableEmail(email)) {
      throw new HttpError(400, 'Please use a permanent e-mail address', 'EMAIL_DISPOSABLE');
    }
    if (!(await verifyTurnstile(req.body?.turnstileToken, req.ip))) {
      throw new HttpError(400, 'The security check failed, please try again', 'CAPTCHA_FAILED');
    }

    const existing = await accountByEmail(email);
    if (existing && existing.userType === 'user' && !existing.user.emailVerifiedAt) {
      // A sign-up nobody has confirmed yet. The newest attempt wins: its
      // password replaces the old one and only its link works (the link is
      // bound to the password it was issued for), so whoever owns the inbox
      // ends up with the password they typed themselves.
      const pending = existing.user;
      pending.password = password;
      pending.name = name;
      await pending.save();
      await sendVerification(req, pending, 'user');
    } else if (existing) {
      // The address has an account. The answer below is the same as for a
      // new one; only the owner of the inbox learns that someone tried. The
      // hash keeps the response time close to that of a real sign-up.
      await hashPassword(password);
      void mail.sendExistingAccount(existing.user.email, {
        name: existing.user.name,
        link: `${appBaseUrl()}/login`,
        locale: mailLocale(req)
      });
    } else {
      const organization = new Organization({ name: `${name}'s Organization`, planType: 'FREE' });
      await organization.save();
      const user = await User.create({
        email,
        password,
        name,
        role: 'owner',
        organizationId: organization._id
      });
      organization.ownerUserId = user._id;
      await organization.save();
      // The free trial of the paid plan starts with the workspace (PRD-15).
      await startTrial(String(organization._id));
      await sendVerification(req, user, 'user');
    }

    res.status(201).json(VERIFICATION_SENT);
  })
);

router.post(
  '/login',
  validateLogin,
  asyncHandler(async (req: Request, res: Response) => {
    assertValid(req, 'Invalid input');
    const { email, password } = req.body;

    // The account can live in either table, so the variable holds both shapes.
    let user: AuthenticatedUser | null = await User.findOne({ email, isActive: true });
    let userType: UserType = 'user';
    if (!user) {
      user = await Team.findOne({ email, isActive: true });
      userType = 'team';
    }

    if (!user) {
      // An unregistered address still costs one bcrypt comparison, so the
      // response time does not reveal which addresses exist.
      await burnVerification(password);
      events.emit('auth.login.failure', {
        organizationId: await organizationForHost(req.get('host')),
        userId: null,
        metadata: { email },
        ip: req.ip,
        ua: req.get('user-agent')
      });
      throw unauthorized('Invalid credentials');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      events.emit('auth.login.failure', {
        organizationId: user.organizationId,
        userId: user._id,
        metadata: { reason: 'invalid_password' },
        ip: req.ip,
        ua: req.get('user-agent')
      });
      throw unauthorized('Invalid credentials');
    }

    // The password is in hand and the hash is out of date, so it is upgraded to
    // today's cost without the user doing anything.
    if (needsRehash(user.password)) {
      user.password = password;
      await user.save();
    }

    // An owner account opens only once its address is proven. Said only to
    // whoever knows the password, so it reveals nothing about the address.
    if (userType === 'user' && user.role === 'owner' && !user.emailVerifiedAt) {
      throw new HttpError(
        403,
        'Verify your e-mail address first; we can send the link again',
        'EMAIL_NOT_VERIFIED'
      );
    }

    if (mfaEnabled(user)) {
      res.json({
        mfaRequired: true,
        mfaToken: signMfaPending({
          userId: user._id,
          userType,
          sv: user.sessionVersion ?? 0
        })
      });
      return;
    }

    await completeSignIn(req, res, user, userType);
  })
);

// The second step: a code from the authenticator app, or a recovery code.
router.post(
  '/login/2fa',
  mfaLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const pending = verifyMfaPending(req.body?.mfaToken);
    if (!pending) {
      throw new HttpError(401, 'The sign-in has expired, please start again', 'MFA_EXPIRED');
    }
    const user = await accountById(pending.userId, pending.userType);
    // A password change or "sign out everywhere" since the password step
    // ends this pending sign-in too.
    if (!user || (user.sessionVersion ?? 0) !== pending.sv) {
      throw new HttpError(401, 'The sign-in has expired, please start again', 'MFA_EXPIRED');
    }
    const how = await verifySecondStep(user, {
      code: req.body?.code,
      recoveryCode: req.body?.recoveryCode
    });
    if (!how) {
      events.emit('auth.login.failure', {
        organizationId: user.organizationId,
        userId: user._id,
        metadata: { reason: 'invalid_second_step' },
        ip: req.ip,
        ua: req.get('user-agent')
      });
      throw new HttpError(400, 'The code is not correct', 'MFA_CODE_INVALID');
    }
    if (how === 'recovery') {
      events.emit('auth.mfa.recovery_used', {
        organizationId: user.organizationId,
        userId: user._id,
        metadata: { userType: pending.userType, codesLeft: recoveryCodesLeft(user) },
        ip: req.ip,
        ua: req.get('user-agent')
      });
      void mail.sendSecurityNotice(user.email, {
        name: user.name,
        event: 'recovery_used',
        link: `${appBaseUrl()}/forgot-password`,
        locale: mailLocale(req)
      });
    }
    await completeSignIn(req, res, user, pending.userType, { secondStep: how });
  })
);

router.get(
  '/me',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    const plan = req.organization ? await getPlan(String(req.organization._id)) : undefined;
    res.json({ user: accountResponse(req.user, req.userType, req.organization, plan) });
  })
);

router.post(
  '/logout',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    req.user.status = 'offline';
    await req.user.save();
    // The cookie must not survive a sign-out, or the browser keeps presenting a
    // valid credential for a session the user believes they ended.
    endSession(res);
    res.json({ message: 'Logged out successfully' });
  })
);

router.put(
  '/status',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body;
    if (!isPresenceStatus(status)) {
      throw badRequest(`status must be one of: ${PRESENCE_STATUSES.join(', ')}`);
    }
    req.user.status = status;
    await req.user.save();
    res.json({ message: 'Status updated successfully', status: req.user.status });
  })
);

// ------------------------------------------------------- e-mail verification

router.post(
  '/verify-email',
  asyncHandler(async (req: Request, res: Response) => {
    const spent = await consumeAuthToken(req.body?.token, 'verify');
    if (!spent) throw invalidToken();
    const user = await accountById(spent.id, spent.type);
    if (!user) throw invalidToken();
    // Issued for a password that has since been replaced (a newer sign-up
    // attempt, a reset): this link no longer stands for the account.
    if (spent.payload.pw && spent.payload.pw !== passwordFingerprint(user.password)) {
      throw invalidToken();
    }

    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date();
      await user.save();
      events.emit('auth.email.verified', {
        organizationId: user.organizationId,
        userId: user._id,
        metadata: { userType: spent.type },
        ip: req.ip,
        ua: req.get('user-agent')
      });
    }

    // Opening the link proves the inbox, which is what a sign-up needs: it
    // signs the browser in. An account with two-step sign-in still asks for
    // its second step through the ordinary sign-in.
    if (mfaEnabled(user)) {
      res.json({ verified: true });
      return;
    }
    await completeSignIn(req, res, user, spent.type, { via: 'verification_link' });
  })
);

router.post(
  '/resend-verification',
  auth,
  resendVerificationLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user.emailVerifiedAt) {
      res.json({ alreadyVerified: true });
      return;
    }
    const sent = await sendVerification(req, req.user, req.userType);
    res.json({ sent });
  })
);

// For someone who cannot sign in yet because the address is unverified. The
// same answer whatever the address, like the password reset below.
router.post(
  '/resend-verification-link',
  resendVerificationLimiter,
  forgotPasswordAccountLimiter,
  [body('email').isEmail().normalizeEmail()],
  asyncHandler(async (req: Request, res: Response) => {
    if (validationResult(req).isEmpty()) {
      const user = await User.findOne({ email: req.body.email, isActive: true });
      if (user && !user.emailVerifiedAt) await sendVerification(req, user, 'user');
    }
    res.json(VERIFICATION_SENT);
  })
);

// ------------------------------------------------------------ password reset

const RESET_REQUESTED = {
  message: 'If an account exists for this address, a reset link is on its way.'
};

router.post(
  '/forgot-password',
  forgotPasswordLimiter,
  forgotPasswordAccountLimiter,
  [body('email').isEmail().normalizeEmail()],
  asyncHandler(async (req: Request, res: Response) => {
    // The same answer whether or not the address has an account, whether or
    // not the mail could be sent: this endpoint must not be a way to learn
    // who has an account.
    if (!validationResult(req).isEmpty()) {
      res.json(RESET_REQUESTED);
      return;
    }
    const found = await accountByEmail(req.body.email);
    if (found) {
      const { user, userType } = found;
      const token = await issueAuthToken({ id: user._id, type: userType }, 'reset');
      // Not awaited: the response must not take longer for an existing
      // account than for an unknown one.
      void mail.sendPasswordReset(user.email, {
        name: user.name,
        link: `${appBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`,
        locale: mailLocale(req)
      });
      events.emit('auth.password.reset_requested', {
        organizationId: user.organizationId,
        userId: user._id,
        metadata: { userType },
        ip: req.ip,
        ua: req.get('user-agent')
      });
    }
    res.json(RESET_REQUESTED);
  })
);

router.post(
  '/reset-password',
  forgotPasswordLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // Checked twice: the length and list rules before the token is spent (a
    // typo must not burn the link), the e-mail rule once the account is known.
    assertPasswordAllowed(req.body?.password);

    const spent = await consumeAuthToken(req.body?.token, 'reset');
    if (!spent) throw invalidToken();
    const user = await accountById(spent.id, spent.type);
    if (!user) throw invalidToken();
    assertPasswordAllowed(req.body.password, { email: user.email });

    user.password = req.body.password;
    // Ends every session of this account, here and on every other device:
    // the usual reason for a reset is that someone else has the password.
    user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    // A reset link reached this inbox, which proves the address too.
    if (!user.emailVerifiedAt) user.emailVerifiedAt = new Date();
    await user.save();
    await revokeAuthTokens({ id: user._id, type: spent.type }, 'reset');

    events.emit('auth.password.reset', {
      organizationId: user.organizationId,
      userId: user._id,
      metadata: { userType: spent.type },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    endSession(res);
    res.json({ reset: true });
  })
);

router.delete(
  '/account',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    // The owner's account is the workspace: deleting it deletes the
    // organization and everything in it (services/organizationDeletion.ts),
    // so it asks for the password again, whatever the session says.
    if (req.user.role === 'owner' && req.user.organizationId) {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!password || !(await req.user.comparePassword(password))) {
        throw new HttpError(403, 'The password is not correct', 'PASSWORD_INCORRECT');
      }
      await deleteOrganization(String(req.user.organizationId));
      endSession(res);
      res.json({ message: 'Workspace deleted', workspaceDeleted: true });
      return;
    }

    // Anyone else leaves only themselves. A soft delete: the row stays so
    // conversations keep a sender, but the address is released and the
    // account can no longer sign in.
    req.user.email = `deleted_${Date.now()}@deleted.com`;
    req.user.isActive = false;
    req.user.name = 'Deleted User';
    req.user.status = 'offline';
    req.user.totpSecretEnc = null;
    req.user.totpEnabledAt = null;
    req.user.recoveryCodes = [];
    await req.user.save();
    endSession(res);
    res.json({ message: 'Account deleted successfully' });
  })
);

export default router;
