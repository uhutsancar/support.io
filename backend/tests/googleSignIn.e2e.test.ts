'use strict';

// Sign-in with Google (plan v10 PRD-14), through the API's stand-in for
// Google (GOOGLE_SIGN_IN_TRANSPORT=memory): the same redirects, state cookie,
// PKCE and ID-token checks as with Google, minus Google's servers. A new
// Google account makes a verified workspace; an address that already has an
// account is never opened by Google until its owner connects it, signed in;
// a Google account opens one account at most; two-step sign-in still asks for
// its code; anything stale, replayed or unverified is turned away.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { stepAt, totpCode } from '../src/services/totp';
import { outbox, signUp } from './helpers/accounts';
import { BASE } from './helpers/widget';
import { referralSummary } from '../src/services/referrals';

test.after(async () => {
  await closeRedisClient();
  await getPool().end();
});

const PASSWORD = 'E2ePassw0rd!';
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

const cookie = (res: Response, name: string): string | null => {
  const match = new RegExp(`(?:^|,\\s*)${name}=([^;]*)`).exec(res.headers.get('set-cookie') || '');
  return match && match[1] ? match[1] : null;
};
const pathOf = (location: string | null) => {
  const url = new URL(String(location), BASE);
  return url.pathname + url.search + url.hash;
};

interface GoogleAccount {
  sub: string;
  email: string;
  name?: string;
  verified?: boolean;
}

/**
 * Walks the redirects a browser follows: our start (or a link URL), the
 * stand-in's account chooser, our callback. Returns where the callback sends
 * the browser and the session it set, if any.
 */
async function throughGoogle(
  account: GoogleAccount,
  options: {
    start?: string;
    decision?: 'allow' | 'deny';
    tamper?: (q: URLSearchParams) => void;
    /** A referral link's code on the sign-in button (PRD-23). */
    ref?: string;
  } = {}
) {
  let attemptCookie: string | null = null;
  let authorize: string;
  if (options.start) {
    authorize = options.start;
  } else {
    const ref = options.ref ? `&ref=${options.ref}` : '';
    const start = await fetch(`${BASE}/api/auth/google/start?lang=tr${ref}`, {
      redirect: 'manual'
    });
    assert.equal(start.status, 303);
    attemptCookie = cookie(start, 'sc_google');
    authorize = String(start.headers.get('location'));
  }
  const query = new URL(authorize).searchParams;
  assert.equal(query.get('scope'), 'openid email profile');
  assert.equal(query.get('code_challenge_method'), 'S256');
  const form = new URLSearchParams({
    client_id: query.get('client_id') || '',
    redirect_uri: query.get('redirect_uri') || '',
    state: query.get('state') || '',
    nonce: query.get('nonce') || '',
    code_challenge: query.get('code_challenge') || '',
    sub: account.sub,
    email: account.email,
    name: account.name ?? 'Google Kullanıcısı',
    decision: options.decision ?? 'allow',
    ...(account.verified === false ? {} : { email_verified: 'true' })
  });
  const chosen = await fetch(`${BASE}/api/dev/google/authorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
    redirect: 'manual'
  });
  assert.equal(chosen.status, 303);
  const callback = new URL(String(chosen.headers.get('location')));
  options.tamper?.(callback.searchParams);
  return { callback, attemptCookie };
}

async function finish(callback: URL, attemptCookie: string | null) {
  const res = await fetch(`${BASE}${callback.pathname}${callback.search}`, {
    redirect: 'manual',
    headers: attemptCookie ? { Cookie: `sc_google=${attemptCookie}` } : {}
  });
  assert.equal(res.status, 303);
  return {
    to: pathOf(res.headers.get('location')),
    session: cookie(res, 'sc_session'),
    res
  };
}

async function signInWithGoogle(account: GoogleAccount) {
  const { callback, attemptCookie } = await throughGoogle(account);
  return finish(callback, attemptCookie);
}

async function me(session: string) {
  const res = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${decodeURIComponent(session)}` }
  });
  assert.equal(res.status, 200);
  return ((await res.json()) as { user: any }).user;
}

/** A password account, verified and signed in; its session as a bearer token. */
async function passwordAccount(label: string) {
  const email = `${label}${stamp()}@google.test`;
  const reg = await signUp({ name: `${label} owner`, email, password: PASSWORD });
  return { email, token: decodeURIComponent(cookie(reg as unknown as Response, 'sc_session')!) };
}

async function recentProof(
  token: string,
  purpose: 'google-link' | 'google-unlink',
  secondFactor: { code?: string; recoveryCode?: string } = {}
): Promise<string> {
  const res = await fetch(`${BASE}/api/auth/recent-auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ purpose, password: PASSWORD, ...secondFactor })
  });
  const body = (await res.json()) as { proof?: string; message?: string };
  assert.equal(res.status, 200, body.message);
  assert.ok(body.proof);
  return body.proof;
}

async function linkUrl(
  token: string,
  secondFactor: { code?: string; recoveryCode?: string } = {}
): Promise<{ url: string; attemptCookie: string | null }> {
  const proof = await recentProof(token, 'google-link', secondFactor);
  const res = await fetch(`${BASE}/api/auth/google/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Recent-Auth': proof
    },
    body: JSON.stringify({ lang: 'tr' })
  });
  assert.equal(res.status, 200);
  return {
    url: ((await res.json()) as { url: string }).url,
    attemptCookie: cookie(res, 'sc_google')
  };
}

async function unlinkGoogle(token: string): Promise<Response> {
  const proof = await recentProof(token, 'google-unlink');
  return fetch(`${BASE}/api/auth/google`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'X-Recent-Auth': proof }
  });
}

async function googleOf(email: string) {
  const { rows } = await query('SELECT google_sub, google_email FROM users WHERE email = $1', [
    email
  ]);
  return rows[0] as { google_sub: string | null; google_email: string | null };
}

/** Audit rows are written from an event, a moment after the response. */
async function audited(email: string, action: string): Promise<number> {
  for (let attempt = 0; attempt < 30; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM audit_logs a JOIN users u ON u.id = a.user_id
        WHERE u.email = $1 AND a.action = $2`,
      [email, action]
    );
    if (rows[0].n > 0) return rows[0].n;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return 0;
}

test('the sign-in pages are told the button exists', async () => {
  const res = await fetch(`${BASE}/api/auth/config`);
  assert.equal(((await res.json()) as { googleSignIn: boolean }).googleSignIn, true);
});

test('a new Google account makes a verified workspace, and opens it again', async () => {
  const account = {
    sub: `g-new-${stamp()}`,
    email: `yeni${stamp()}@gmail.test`,
    name: 'Ayşe Google'
  };
  const first = await signInWithGoogle(account);
  assert.equal(first.to, '/onboarding');
  assert.ok(first.session, 'signed in');
  const user = await me(first.session!);
  assert.equal(user.email, account.email);
  assert.equal(user.name, 'Ayşe Google');
  assert.equal(user.emailVerified, true);
  assert.equal(user.role, 'owner');
  assert.deepEqual(user.google, { email: account.email });
  assert.equal(user.organization.planType, 'PRO', 'the trial starts with the workspace');

  const again = await signInWithGoogle(account);
  assert.equal((await me(again.session!)).id, user.id, 'the same account, not a second one');
  const { rows } = await query('SELECT count(*)::int AS n FROM users WHERE email = $1', [
    account.email
  ]);
  assert.equal(rows[0].n, 1);
});

test('an address with an account is not opened by an unconnected Google account', async () => {
  const { email } = await passwordAccount('exists');
  const out = await signInWithGoogle({ sub: `g-attacker-${stamp()}`, email });
  assert.equal(out.to, '/login?google=exists');
  assert.equal(out.session, null);
  assert.equal((await googleOf(email)).google_sub, null, 'nothing was connected');
});

test('connected by its owner, signed in, Google opens the account', async () => {
  const { email, token } = await passwordAccount('link');
  const sub = `g-link-${stamp()}`;
  const { url, attemptCookie } = await linkUrl(token);
  const { callback } = await throughGoogle(
    { sub, email: `kisisel${stamp()}@gmail.test` },
    { start: url }
  );
  const linked = await finish(callback, attemptCookie);
  assert.equal(linked.to, '/dashboard/settings?google=linked#security');
  assert.equal((await googleOf(email)).google_sub, sub);

  assert.equal(await audited(email, 'GOOGLE_LINKED'), 1, 'audited');
  const mails = await outbox(email);
  assert.ok(
    mails.some((m) => /Google ile giriş eklendi/.test(m.subject)),
    'the owner is told'
  );

  const opened = await signInWithGoogle({ sub, email: 'whatever@gmail.test' });
  assert.equal(opened.to, '/onboarding', 'its set-up is not finished yet');
  assert.equal((await me(opened.session!)).email, email);

  // Disconnected, the Google account no longer opens it.
  const unlink = await unlinkGoogle(token);
  assert.equal(unlink.status, 204);
  assert.equal((await googleOf(email)).google_sub, null);
  const after = await signInWithGoogle({ sub, email });
  assert.equal(after.to, '/login?google=exists');
});

test('a Google account connects to one account only', async () => {
  const a = await passwordAccount('onea');
  const b = await passwordAccount('oneb');
  const sub = `g-one-${stamp()}`;
  for (const [who, expected] of [
    [a, '/dashboard/settings?google=linked#security'],
    [b, '/dashboard/settings?google=taken#security']
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    const { url, attemptCookie } = await linkUrl(who.token);
    // eslint-disable-next-line no-await-in-loop
    const { callback } = await throughGoogle(
      { sub, email: `x${stamp()}@gmail.test` },
      { start: url }
    );
    // eslint-disable-next-line no-await-in-loop
    assert.equal((await finish(callback, attemptCookie)).to, expected);
  }
  assert.equal((await googleOf(b.email)).google_sub, null);
});

test('link step-up is required and bound to its exact session and purpose', async () => {
  const { email, token } = await passwordAccount('stepup');
  const missing = await fetch(`${BASE}/api/auth/google/link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ lang: 'tr' })
  });
  assert.equal(missing.status, 403);

  const wrongPurpose = await recentProof(token, 'google-unlink');
  const wrong = await fetch(`${BASE}/api/auth/google/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Recent-Auth': wrongPurpose
    },
    body: JSON.stringify({ lang: 'tr' })
  });
  assert.equal(wrong.status, 403);

  const proof = await recentProof(token, 'google-link');
  const otherSession = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD })
  });
  assert.equal(otherSession.status, 200);
  const otherToken = decodeURIComponent(cookie(otherSession, 'sc_session')!);
  const replayed = await fetch(`${BASE}/api/auth/google/link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${otherToken}`,
      'X-Recent-Auth': proof
    },
    body: JSON.stringify({ lang: 'tr' })
  });
  assert.equal(replayed.status, 403);
});

test('two-step sign-in still asks for its code', async () => {
  const { email, token } = await passwordAccount('mfa');
  const setup = await fetch(`${BASE}/api/auth/2fa/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password: PASSWORD })
  });
  const { secret } = (await setup.json()) as { secret: string };
  const confirm = await fetch(`${BASE}/api/auth/2fa/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ code: totpCode(secret, stepAt()) })
  });
  assert.equal(confirm.status, 200);
  const { recoveryCodes } = (await confirm.json()) as { recoveryCodes: string[] };
  const session = decodeURIComponent(cookie(confirm, 'sc_session')!);

  const sub = `g-mfa-${stamp()}`;
  const { url, attemptCookie } = await linkUrl(session, { recoveryCode: recoveryCodes[0] });
  const { callback } = await throughGoogle({ sub, email }, { start: url });
  assert.equal(
    (await finish(callback, attemptCookie)).to,
    '/dashboard/settings?google=linked#security'
  );

  const out = await signInWithGoogle({ sub, email });
  assert.equal(out.session, null, 'no session before the code');
  const mfaToken = decodeURIComponent(/^\/login#mfa=(.+)$/.exec(out.to)?.[1] || '');
  assert.ok(mfaToken, out.to);
  const second = await fetch(`${BASE}/api/auth/login/2fa`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mfaToken, code: totpCode(secret, stepAt() + 1) })
  });
  assert.equal(second.status, 200, await second.text());
});

test('stale, replayed, refused or unverified attempts open nothing', async () => {
  const account = () => ({ sub: `g-bad-${stamp()}`, email: `bad${stamp()}@gmail.test` });

  // Google did not verify the address.
  const unverified = await signInWithGoogle({ ...account(), verified: false });
  assert.equal(unverified.to, '/login?google=failed');

  // The person pressed Cancel on Google's page.
  const denied = await throughGoogle(account(), { decision: 'deny' });
  assert.equal((await finish(denied.callback, denied.attemptCookie)).to, '/login?google=cancelled');

  // No attempt cookie: a callback this browser did not start.
  const foreign = await throughGoogle(account());
  assert.equal((await finish(foreign.callback, null)).to, '/login?google=expired');

  // The state does not match the attempt.
  const forged = await throughGoogle(account(), { tamper: (q) => q.set('state', 'x'.repeat(43)) });
  assert.equal((await finish(forged.callback, forged.attemptCookie)).to, '/login?google=expired');

  // A code used once is spent.
  const once = await throughGoogle(account());
  assert.equal((await finish(once.callback, once.attemptCookie)).to, '/onboarding');
  assert.equal((await finish(once.callback, once.attemptCookie)).to, '/login?google=failed');

  // A code issued for another attempt fails PKCE and the nonce.
  const mine = await throughGoogle(account());
  const theirs = await throughGoogle(account());
  const swapped = new URL(mine.callback);
  swapped.searchParams.set('code', String(theirs.callback.searchParams.get('code')));
  assert.equal((await finish(swapped, mine.attemptCookie)).to, '/login?google=failed');

  // Nobody can start a link without a session.
  const anonymous = await fetch(`${BASE}/api/auth/google/link`, { method: 'POST' });
  assert.equal(anonymous.status, 401);
});

test('a deleted workspace releases its Google account', async () => {
  const { email, token } = await passwordAccount('deleted');
  const sub = `g-deleted-${stamp()}`;
  const { url, attemptCookie } = await linkUrl(token);
  const { callback } = await throughGoogle({ sub, email }, { start: url });
  assert.equal(
    (await finish(callback, attemptCookie)).to,
    '/dashboard/settings?google=linked#security'
  );

  const deleted = await fetch(`${BASE}/api/auth/account`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ password: PASSWORD })
  });
  assert.equal(deleted.status, 200);
  const { rows } = await query('SELECT count(*)::int AS n FROM users WHERE google_sub = $1', [sub]);
  assert.equal(rows[0].n, 0, 'no row keeps the Google account');

  // The same Google account starts afresh.
  const fresh = await signInWithGoogle({ sub, email });
  assert.equal(fresh.to, '/onboarding');
});

test('a sign-up nobody confirmed belongs to whoever Google says owns the address', async () => {
  const email = `pending${stamp()}@google.test`;
  const registered = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Başkası', email, password: 'SomeoneElse123!' })
  });
  assert.equal(registered.status, 201);

  const out = await signInWithGoogle({ sub: `g-pending-${stamp()}`, email, name: 'Gerçek Sahip' });
  assert.equal(out.to, '/onboarding');
  const user = await me(out.session!);
  assert.equal(user.email, email);
  assert.equal(user.name, 'Gerçek Sahip', 'not the name the other person typed');
  assert.equal(user.emailVerified, true);

  // The password typed by whoever started the sign-up opens nothing.
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'SomeoneElse123!' })
  });
  assert.equal(login.status, 401);
});

test('a referral link’s code travels through Google to the new workspace', async () => {
  const { token } = await passwordAccount('referrer');
  const whoami = await fetch(`${BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const referrer = String(
    ((await whoami.json()) as { user: { organizationId: string } }).user.organizationId
  );
  const { code } = await referralSummary(referrer);
  const { callback, attemptCookie } = await throughGoogle(
    { sub: `g-ref-${stamp()}`, email: `davetli${stamp()}@gmail.test` },
    { ref: code }
  );
  const out = await finish(callback, attemptCookie);
  assert.equal(out.to, '/onboarding');
  const invited = String((await me(out.session!)).organizationId);
  const { rows } = await query(
    'SELECT referrer_organization_id FROM referrals WHERE referred_organization_id = $1',
    [invited]
  );
  assert.equal(rows[0]?.referrer_organization_id, referrer);
});
