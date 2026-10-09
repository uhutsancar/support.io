'use strict';

// E-mail verification and password reset, end to end (plan §7.2).
//
//  - sign-up mails a verification link and nothing else: the session starts
//    from the link, the answer is the same for a taken address, and a newer
//    sign-up of an unconfirmed address replaces it (plan v10 SEC-06)
//  - a link works once, only for its purpose, and only the newest one works
//  - forgot-password answers the same for every address
//  - a reset ends every session of the account and the old password
//
// Needs the running API with the console mail transport. Run: npm test

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { BASE } from './helpers/widget';
import { outbox, tokenFromMail, signUp } from './helpers/accounts';

const PASSWORD = 'E2ePassw0rd!';

interface ApiResponse {
  status: number;
  body: any;
  headers: Headers;
}

async function api(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}
): Promise<ApiResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json, headers: res.headers };
}

function sessionCookie(res: { headers: Headers }): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : '';
}

const unique = (label: string) =>
  `${label}${Date.now()}${Math.floor(Math.random() * 100000)}@recovery.test`;

async function register(email: string) {
  const reg = await signUp({ name: 'Recovery Owner', email, password: PASSWORD });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  return { token: sessionCookie(reg), user: reg.body.user };
}

test.after(async () => {
  await getPool().end();
});

/** POST /register as the form sends it; no session comes back. */
async function registerOnly(email: string, password = PASSWORD, name = 'Recovery Owner') {
  return api('/api/auth/register', { method: 'POST', body: { name, email, password } });
}

test('sign-up mails a link and signs in only through it; the link works once', async () => {
  const email = unique('verify');
  const reg = await registerOnly(email);
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  assert.deepEqual(reg.body, { verificationSent: true });
  assert.equal(sessionCookie(reg), '', 'sign-up must not start a session');

  // The password alone does not open an unverified owner account.
  const early = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD }
  });
  assert.equal(early.status, 403);
  assert.equal(early.body.code, 'EMAIL_NOT_VERIFIED');

  const mails = await outbox(email);
  assert.equal(mails.length, 1);
  assert.match(mails[0].text, /\/verify-email\?token=/);
  assert.ok(!mails[0].html.includes('<script'), 'the mail carries markup it should not');

  const token = await tokenFromMail(email, '/verify-email');
  const verified = await api('/api/auth/verify-email', { method: 'POST', body: { token } });
  assert.equal(verified.status, 200, JSON.stringify(verified.body));
  assert.equal(verified.body.user.emailVerified, true);
  const session = sessionCookie(verified);
  assert.ok(session, 'the link signs the browser in');
  const me = await api('/api/auth/me', { token: session });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.emailVerified, true);

  const again = await api('/api/auth/verify-email', { method: 'POST', body: { token } });
  assert.equal(again.status, 400);
  assert.equal(again.body.code, 'INVALID_TOKEN');

  const audit = await query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE action = 'EMAIL_VERIFIED' AND user_id = $1`,
    [verified.body.user._id]
  );
  assert.equal(audit.rows[0].n, 1);

  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD }
  });
  assert.equal(login.status, 200);
});

test('only the newest verification link works', async () => {
  const email = unique('resend');
  await registerOnly(email);
  const first = await tokenFromMail(email, '/verify-email');

  const resent = await api('/api/auth/resend-verification-link', {
    method: 'POST',
    body: { email }
  });
  assert.equal(resent.status, 200);
  assert.deepEqual(resent.body, { verificationSent: true });
  const second = await tokenFromMail(email, '/verify-email');
  assert.notEqual(second, first);

  const stale = await api('/api/auth/verify-email', { method: 'POST', body: { token: first } });
  assert.equal(stale.status, 400, 'a superseded link still verified');
  const fresh = await api('/api/auth/verify-email', { method: 'POST', body: { token: second } });
  assert.equal(fresh.status, 200);

  // Asking again for an address that has nothing to verify answers the same.
  const done = await api('/api/auth/resend-verification-link', {
    method: 'POST',
    body: { email }
  });
  assert.deepEqual(done.body, resent.body);
});

test('signing up with a taken address answers the same and tells only its owner', async () => {
  const email = unique('taken');
  const owner = await register(email);

  const notices = async () =>
    (await outbox(email)).filter((m) => /zaten bir hesab|already have an account/i.test(m.subject));
  const before = (await notices()).length;
  const again = await registerOnly(email, 'Someone-Elses-Passw0rd!', 'Intruder');
  const fresh = await registerOnly(unique('fresh'));
  assert.equal(again.status, fresh.status);
  assert.deepEqual(again.body, fresh.body);
  assert.equal(sessionCookie(again), '');

  // The owner got a notice, not a verification link, and nothing changed.
  // (Set-up mails may arrive meanwhile; only the notice is counted.)
  const mails = await notices();
  assert.equal(mails.length, before + 1);
  assert.doesNotMatch(mails[0].text, /verify-email/);
  const { rows } = await query('SELECT count(*)::int AS n FROM users WHERE email = $1', [email]);
  assert.equal(rows[0].n, 1);
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD }
  });
  assert.equal(login.status, 200, 'the original password still works');
  assert.equal((await api('/api/auth/me', { token: owner.token })).status, 200);
});

test('a second sign-up of an unconfirmed address replaces it; the first link dies', async () => {
  const email = unique('pending');
  await registerOnly(email, 'Squatter-Passw0rd!', 'Squatter');
  const squatterLink = await tokenFromMail(email, '/verify-email');

  const OWNER_PASSWORD = 'Rightful-Owner-9!';
  await registerOnly(email, OWNER_PASSWORD, 'Rightful Owner');
  const ownerLink = await tokenFromMail(email, '/verify-email');
  assert.notEqual(ownerLink, squatterLink);

  const stale = await api('/api/auth/verify-email', {
    method: 'POST',
    body: { token: squatterLink }
  });
  assert.equal(stale.status, 400, 'a link issued for the replaced password still works');

  const verified = await api('/api/auth/verify-email', {
    method: 'POST',
    body: { token: ownerLink }
  });
  assert.equal(verified.status, 200);
  assert.equal(verified.body.user.name, 'Rightful Owner');

  const squatter = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: 'Squatter-Passw0rd!' }
  });
  assert.equal(squatter.status, 401);
  const rightful = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: OWNER_PASSWORD }
  });
  assert.equal(rightful.status, 200);
});

test('sign-up refuses weak passwords and throwaway inboxes', async () => {
  const common = await registerOnly(unique('weak'), 'password123');
  assert.equal(common.status, 400);
  assert.equal(common.body.code, 'PASSWORD_TOO_COMMON');

  const short = await registerOnly(unique('short'), 'Ab1!xyz');
  assert.equal(short.status, 400);
  assert.equal(short.body.code, 'PASSWORD_TOO_SHORT');

  const local = `holder${Date.now()}`;
  const containsEmail = await registerOnly(`${local}@recovery.test`, `${local}-Secret!`);
  assert.equal(containsEmail.status, 400);
  assert.equal(containsEmail.body.code, 'PASSWORD_CONTAINS_EMAIL');

  const disposable = await registerOnly(`someone${Date.now()}@mailinator.com`);
  assert.equal(disposable.status, 400);
  assert.equal(disposable.body.code, 'EMAIL_DISPOSABLE');

  const config = await api('/api/auth/config');
  assert.equal(config.status, 200);
  assert.equal(config.body.passwordMinLength, 10);
});

test('forgot-password answers the same for every address', async () => {
  const email = unique('known');
  await register(email);

  const known = await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
  const unknown = await api('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: unique('nobody') }
  });
  const malformed = await api('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: 'not-an-address' }
  });
  assert.equal(known.status, 200);
  assert.equal(unknown.status, known.status);
  assert.equal(malformed.status, known.status);
  assert.deepEqual(unknown.body, known.body);
  assert.deepEqual(malformed.body, known.body);

  assert.ok(await tokenFromMail(email, '/reset-password'), 'the known address got no mail');
});

test('a reset ends every session and the old password, and works once', async () => {
  const email = unique('reset');
  const owner = await register(email);
  const other = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD }
  });
  const secondDevice = sessionCookie(other);
  assert.equal((await api('/api/auth/me', { token: secondDevice })).status, 200);

  await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
  const token = await tokenFromMail(email, '/reset-password');

  // A reset link is not a verification link, and the reverse.
  const wrongPurpose = await api('/api/auth/verify-email', { method: 'POST', body: { token } });
  assert.equal(wrongPurpose.status, 400);

  const weak = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password: 'short' }
  });
  assert.equal(weak.status, 400);

  const NEW_PASSWORD = 'An0ther-Passw0rd!';
  const reset = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password: NEW_PASSWORD }
  });
  assert.equal(reset.status, 200, JSON.stringify(reset.body));

  assert.equal(
    (await api('/api/auth/me', { token: owner.token })).status,
    401,
    'old session lives'
  );
  assert.equal((await api('/api/auth/me', { token: secondDevice })).status, 401);

  const oldLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD }
  });
  assert.equal(oldLogin.status, 401);
  const newLogin = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: NEW_PASSWORD }
  });
  assert.equal(newLogin.status, 200);
  assert.equal((await api('/api/auth/me', { token: sessionCookie(newLogin) })).status, 200);

  const replay = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password: 'Yet-An0ther-Passw0rd!' }
  });
  assert.equal(replay.status, 400);
  assert.equal(replay.body.code, 'INVALID_TOKEN');
});

test('an expired reset link is refused', async () => {
  const email = unique('expired');
  await register(email);
  await api('/api/auth/forgot-password', { method: 'POST', body: { email } });
  const token = await tokenFromMail(email, '/reset-password');
  await query(
    `UPDATE auth_tokens SET expires_at = now() - interval '1 minute'
      WHERE purpose = 'reset' AND used_at IS NULL
        AND account_id = (SELECT id FROM users WHERE email = $1)`,
    [email]
  );
  const res = await api('/api/auth/reset-password', {
    method: 'POST',
    body: { token, password: 'An0ther-Passw0rd!' }
  });
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'INVALID_TOKEN');
});

test('the database keeps no usable copy of a link', async () => {
  const email = unique('hash');
  await register(email);
  const token = await tokenFromMail(email, '/verify-email');
  const { rows } = await query(
    `SELECT token_hash FROM auth_tokens
      WHERE account_id = (SELECT id FROM users WHERE email = $1)`,
    [email]
  );
  assert.ok(rows.length >= 1);
  for (const row of rows) {
    assert.notEqual(row.token_hash, token);
    assert.match(row.token_hash, /^[0-9a-f]{64}$/);
  }
});
