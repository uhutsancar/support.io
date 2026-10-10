// Sign-in with Google (plan v10 PRD-14). services/googleSignIn.ts verifies
// what Google says; this decides which account it opens.
//
//   GET    /api/auth/google/start      the sign-in and sign-up button
//   POST   /api/auth/google/link       a signed-in user connects Google
//   GET    /api/auth/google/callback   Google sends the browser back here
//   DELETE /api/auth/google            a signed-in user disconnects it
//
// An account is found by the Google account's subject id, never by its
// address. A Google account whose address already has an account here does
// not open it: its owner signs in as usual and connects Google from
// Settings → Security, which is the consent. A Google account nobody has
// connected and whose address is new makes a new workspace, the address
// counting as verified because Google verified it. Two-step sign-in, when on,
// is still asked for.

import crypto from 'crypto';
import express from 'express';
import jwt from 'jsonwebtoken';
import events from '../events';
import User from '../models/User';
import Team from '../models/Team';
import { auth } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimit';
import { requireRecentAuth } from '../middleware/recentAuth';
import { clearFlowCookie, setFlowCookie } from '../config/session';
import { derivedKey, signMfaPending } from '../config/tokens';
import { isDisposableEmail } from '../config/emailPolicy';
import { asyncHandler, HttpError } from '../http';
import { appBaseUrl, mail } from '../services/mail';
import { mfaEnabled } from '../services/mfa';
import { sendActivation } from '../services/activation';
import { normalizeCode, recordReferral } from '../services/referrals';
import {
  GoogleSignInError,
  authorizeUrl,
  googleConfig,
  identityFromCode,
  newAttempt,
  standInGrant
} from '../services/googleSignIn';
import { accountByEmail, accountById, createWorkspace, openSession } from './auth';
import type { GoogleAttempt, GoogleIdentity } from '../services/googleSignIn';
import type { Request, Response } from 'express';
import type { AuthenticatedUser, UserType } from '../types/auth';

const router = express.Router();

const COOKIE = 'sc_google';
const COOKIE_PATH = '/api/auth/google';
const ATTEMPT_MS = 10 * 60 * 1000;
const AUDIENCE = 'support-chat:google-attempt';

type Lang = 'tr' | 'en';
interface Attempt extends GoogleAttempt {
  lang: Lang;
  /** A referral link's code, kept for the workspace this may create (PRD-23). */
  ref?: string;
  /** Present when a signed-in account is connecting Google. */
  link?: { userId: string; userType: UserType; sv: number; authTime: number };
}

const langOf = (value: unknown): Lang => (String(value || '').startsWith('en') ? 'en' : 'tr');
const prefix = (lang: Lang) => (lang === 'en' ? '/en' : '');
const redirectUri = () => `${appBaseUrl()}/api/auth/google/callback`;

/** Back to the panel's sign-in page with what went wrong. */
const toLogin = (res: Response, lang: Lang, outcome: string) =>
  res.redirect(303, `${prefix(lang)}/login?google=${outcome}`);
const toSettings = (res: Response, lang: Lang, outcome: string) =>
  res.redirect(303, `${prefix(lang)}/dashboard/settings?google=${outcome}#security`);

function begin(res: Response, attempt: Attempt): string {
  const config = googleConfig()!;
  setFlowCookie(
    res,
    COOKIE,
    jwt.sign({ ...attempt }, derivedKey('google-sign-in'), {
      audience: AUDIENCE,
      expiresIn: ATTEMPT_MS / 1000
    }),
    ATTEMPT_MS,
    COOKIE_PATH
  );
  return authorizeUrl(config, attempt, redirectUri(), appBaseUrl());
}

function attemptFrom(req: Request): Attempt | null {
  const raw = req.cookies?.[COOKIE];
  if (typeof raw !== 'string') return null;
  try {
    return jwt.verify(raw, derivedKey('google-sign-in'), {
      audience: AUDIENCE,
      algorithms: ['HS256']
    }) as unknown as Attempt;
  } catch {
    return null;
  }
}

const sameText = (a: string, b: string) =>
  a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** The account this Google account is connected to, in either table. */
async function accountByGoogle(
  sub: string
): Promise<{ user: AuthenticatedUser; userType: UserType } | null> {
  const user = await User.findOne({ googleSub: sub });
  if (user) return { user, userType: 'user' };
  const team = await Team.findOne({ googleSub: sub });
  return team ? { user: team, userType: 'team' } : null;
}

const ensureEnabled = (_req: Request, res: Response, next: express.NextFunction) => {
  if (googleConfig()) return next();
  res
    .status(404)
    .json({ error: 'Sign-in with Google is not available', code: 'GOOGLE_UNAVAILABLE' });
};

// The button on the sign-in and sign-up pages: a plain link, no session.
router.get('/start', loginLimiter, (req: Request, res: Response) => {
  const lang = langOf(req.query.lang);
  if (!googleConfig()) {
    toLogin(res, lang, 'unavailable');
    return;
  }
  const ref = normalizeCode(req.query.ref) ?? undefined;
  res.redirect(303, begin(res, { ...newAttempt(), lang, ...(ref ? { ref } : {}) }));
});

// Connecting Google to the signed-in account. A POST behind the session and
// its CSRF check, so no other site can start it on the user's behalf.
router.post(
  '/link',
  ensureEnabled,
  auth,
  requireRecentAuth('google-link'),
  (req: Request, res: Response) => {
    const url = begin(res, {
      ...newAttempt(),
      lang: langOf(req.body?.lang),
      link: {
        userId: String(req.user._id),
        userType: req.userType,
        sv: req.user.sessionVersion ?? 0,
        authTime: Math.floor(Date.now() / 1000)
      }
    });
    res.json({ url });
  }
);

router.delete(
  '/',
  ensureEnabled,
  auth,
  requireRecentAuth('google-unlink'),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.user.googleSub) {
      req.user.googleSub = null;
      req.user.googleEmail = null;
      await req.user.save();
      events.emit('auth.google.unlinked', {
        organizationId: req.user.organizationId,
        userId: req.user._id,
        metadata: { userType: req.userType },
        ip: req.ip,
        ua: req.get('user-agent')
      });
      void mail.sendSecurityNotice(req.user.email, {
        name: req.user.name,
        event: 'google_unlinked',
        link: `${appBaseUrl()}/forgot-password`,
        locale: langOf(req.body?.lang)
      });
    }
    res.status(204).end();
  })
);

async function connect(req: Request, res: Response, attempt: Attempt, who: GoogleIdentity) {
  const { link, lang } = attempt;
  const user = link ? await accountById(link.userId, link.userType) : null;
  // Signed out, or "sign out everywhere", since the button was pressed.
  if (
    !user ||
    (user.sessionVersion ?? 0) !== link!.sv ||
    Math.floor(Date.now() / 1000) - link!.authTime > 10 * 60
  ) {
    return toSettings(res, lang, 'expired');
  }
  const holder = await accountByGoogle(who.sub);
  if (holder && String(holder.user._id) !== String(user._id)) {
    return toSettings(res, lang, 'taken');
  }
  user.googleSub = who.sub;
  user.googleEmail = who.email;
  try {
    await user.save();
  } catch (error) {
    // Connected to another account a moment ago (the unique index).
    if ((error as { code?: string }).code === '23505') return toSettings(res, lang, 'taken');
    throw error;
  }
  events.emit('auth.google.linked', {
    organizationId: user.organizationId,
    userId: user._id,
    metadata: { userType: link!.userType, googleEmail: who.email },
    ip: req.ip,
    ua: req.get('user-agent')
  });
  void mail.sendSecurityNotice(user.email, {
    name: user.name,
    event: 'google_linked',
    link: `${appBaseUrl()}/forgot-password`,
    locale: lang
  });
  return toSettings(res, lang, 'linked');
}

async function signIn(req: Request, res: Response, attempt: Attempt, who: GoogleIdentity) {
  const { lang } = attempt;
  let found = await accountByGoogle(who.sub);

  if (!found) {
    const existing = await accountByEmail(who.email);
    const unconfirmed =
      existing?.userType === 'user' &&
      existing.user.role === 'owner' &&
      !existing.user.emailVerifiedAt;
    // The address has an account that never connected this Google account:
    // its owner has to, signed in. Nothing is opened or created.
    if (existing && !unconfirmed) return toLogin(res, lang, 'exists');
    if (isDisposableEmail(who.email)) return toLogin(res, lang, 'disposable');
    // Never told to anyone: the account signs in with Google, and "forgot
    // password" gives it a password of its own whenever it wants one.
    const password = crypto.randomBytes(32).toString('base64url');
    const name = (who.name || who.email.split('@')[0]).slice(0, 50).padEnd(2, '.');
    let user: AuthenticatedUser;
    if (existing) {
      // A sign-up nobody has confirmed, which nobody could sign in to yet.
      // Google has just proven the address, so it is this person's — as
      // with the sign-up form, whoever owns the inbox gets the account; the
      // unconfirmed password stops working.
      user = existing.user;
      user.name = name;
      user.password = password;
      user.emailVerifiedAt = new Date();
      user.googleSub = who.sub;
      user.googleEmail = who.email;
      await user.save();
    } else {
      user = await createWorkspace({
        email: who.email,
        password,
        name,
        emailVerifiedAt: new Date(),
        googleSub: who.sub,
        googleEmail: who.email
      });
    }
    if (attempt.ref) await recordReferral(attempt.ref, String(user.organizationId));
    void sendActivation(String(user.organizationId), 'welcome').catch(() => undefined);
    events.emit('auth.email.verified', {
      organizationId: user.organizationId,
      userId: user._id,
      metadata: { userType: 'user', via: 'google' },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    found = { user, userType: 'user' };
  }

  const { user, userType } = found;
  if (!user.isActive) return toLogin(res, lang, 'failed');
  if (mfaEnabled(user)) {
    // The second step is the sign-in page's: the pending token travels in the
    // fragment, which the browser never sends to any server.
    const token = signMfaPending({
      userId: user._id,
      userType,
      sv: user.sessionVersion ?? 0
    });
    return res.redirect(303, `${prefix(lang)}/login#mfa=${encodeURIComponent(token)}`);
  }
  const session = await openSession(req, res, user, userType, { via: 'google' });
  const onboarding = session.user.role === 'owner' && session.user.isOnboarded === false;
  return res.redirect(303, `${prefix(lang)}${onboarding ? '/onboarding' : '/dashboard'}`);
}

router.get(
  '/callback',
  loginLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const attempt = attemptFrom(req);
    clearFlowCookie(res, COOKIE, COOKIE_PATH);
    const lang = attempt?.lang ?? 'tr';
    const back = attempt?.link ? toSettings : toLogin;
    const config = googleConfig();
    if (!config || !attempt) return toLogin(res, lang, 'expired');
    if (typeof req.query.error === 'string') return back(res, lang, 'cancelled');
    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code || !sameText(state, attempt.state)) return back(res, lang, 'expired');

    let who: GoogleIdentity;
    try {
      who = await identityFromCode(config, code, attempt, redirectUri());
    } catch (error) {
      if (!(error instanceof GoogleSignInError)) throw error;
      console.warn('[google] sign-in refused:', error.message);
      return back(res, lang, 'failed');
    }
    return attempt.link ? connect(req, res, attempt, who) : signIn(req, res, attempt, who);
  })
);

// --------------------------------------------------- development stand-in

/**
 * The stand-in for Google's account chooser (GOOGLE_SIGN_IN_TRANSPORT=memory,
 * never in production): a form where the test types the Google account it
 * signs in as. Mounted at /api/dev/google by server.ts.
 */
export const standInGoogle = express.Router();

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

standInGoogle.get('/authorize', (req: Request, res: Response) => {
  const keep = ['client_id', 'redirect_uri', 'state', 'nonce', 'code_challenge'];
  const hidden = keep
    .map(
      (k) => `<input type="hidden" name="${k}" value="${escapeHtml(String(req.query[k] ?? ''))}">`
    )
    .join('');
  // The API answers with no-referrer, under which a form posts `Origin: null`
  // and CORS turns it away; this page posts to its own origin only.
  res.set('Referrer-Policy', 'same-origin');
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Stand-in Google</title></head><body>
<h1>Stand-in Google</h1><p>Development only: choose the Google account to sign in as.</p>
<form method="post" action="/api/dev/google/authorize">${hidden}
<label>Subject <input name="sub" required></label>
<label>E-mail <input name="email" type="email" required></label>
<label>Name <input name="name"></label>
<label><input type="checkbox" name="email_verified" value="true" checked> Verified address</label>
<button type="submit" name="decision" value="allow">Continue</button>
<button type="submit" name="decision" value="deny" formnovalidate>Cancel</button>
</form></body></html>`);
});

standInGoogle.post(
  '/authorize',
  express.urlencoded({ extended: false, limit: '8kb' }),
  (req: Request, res: Response) => {
    const config = googleConfig();
    const b = req.body as Record<string, string>;
    const back = new URL(String(b.redirect_uri || ''));
    if (!config || back.toString() !== redirectUri()) {
      throw new HttpError(400, 'unknown redirect_uri', 'BAD_REDIRECT');
    }
    back.searchParams.set('state', String(b.state || ''));
    if (b.decision !== 'allow') {
      back.searchParams.set('error', 'access_denied');
    } else {
      back.searchParams.set(
        'code',
        standInGrant({
          identity: {
            sub: String(b.sub || ''),
            email: String(b.email || ''),
            name: String(b.name || ''),
            emailVerified: b.email_verified === 'true'
          },
          clientId: String(b.client_id || ''),
          redirectUri: back.origin + back.pathname,
          nonce: String(b.nonce || ''),
          challenge: String(b.code_challenge || '')
        })
      );
    }
    res.redirect(303, back.toString());
  }
);

export default router;
