'use strict';

// E-mail verification and password reset, end to end (plan §7.2).
//
//  - sign-up mails a verification link; until it is followed the panel works
//    but the widget gets no session
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
import { BASE, widgetSession } from './helpers/widget';
import { outbox, tokenFromMail } from './helpers/accounts';

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
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Recovery Owner', email, password: PASSWORD }
  });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  return { token: sessionCookie(reg), user: reg.body.user, sent: reg.body.verificationSent };
}

test.after(async () => {
  await getPool().end();
});

test('sign-up mails a link; the widget waits for it; the link works once', async () => {
  const email = unique('verify');
  const owner = await register(email);
  assert.equal(owner.sent, true);
  assert.equal(owner.user.emailVerified, false);

  const mails = await outbox(email);
  assert.equal(mails.length, 1);
  assert.match(mails[0].text, /\/verify-email\?token=/);
  assert.ok(!mails[0].html.includes('<script'), 'the mail carries markup it should not');

  // The panel works, but no page gets a widget session yet.
  const site = await api('/api/sites', {
    method: 'POST',
    token: owner.token,
    body: { name: 'Unverified', domain: `${Date.now()}.example` }
  });
  assert.equal(site.status, 201);
  const refused = await widgetSession(site.body.site.siteKey);
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'ACCOUNT_NOT_VERIFIED');

  const token = await tokenFromMail(email, '/verify-email');
  const verified = await api('/api/auth/verify-email', { method: 'POST', body: { token } });
  assert.equal(verified.status, 200);

  const me = await api('/api/auth/me', { token: owner.token });
  assert.equal(me.body.user.emailVerified, true);
  assert.equal((await widgetSession(site.body.site.siteKey)).status, 200);

  const again = await api('/api/auth/verify-email', { method: 'POST', body: { token } });
  assert.equal(again.status, 400);
  assert.equal(again.body.code, 'INVALID_TOKEN');

  const audit = await query(
    `SELECT count(*)::int AS n FROM audit_logs WHERE action = 'EMAIL_VERIFIED' AND user_id = $1`,
    [owner.user._id]
  );
  assert.equal(audit.rows[0].n, 1);
});

test('only the newest verification link works', async () => {
  const email = unique('resend');
  const owner = await register(email);
  const first = await tokenFromMail(email, '/verify-email');

  const resent = await api('/api/auth/resend-verification', {
    method: 'POST',
    token: owner.token
  });
  assert.equal(resent.status, 200);
  assert.equal(resent.body.sent, true);
  const second = await tokenFromMail(email, '/verify-email');
  assert.notEqual(second, first);

  const stale = await api('/api/auth/verify-email', { method: 'POST', body: { token: first } });
  assert.equal(stale.status, 400, 'a superseded link still verified');
  const fresh = await api('/api/auth/verify-email', { method: 'POST', body: { token: second } });
  assert.equal(fresh.status, 200);

  const done = await api('/api/auth/resend-verification', { method: 'POST', token: owner.token });
  assert.equal(done.body.alreadyVerified, true);
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

  assert.equal((await api('/api/auth/me', { token: owner.token })).status, 401, 'old session lives');
  assert.equal((await api('/api/auth/me', { token: secondDevice })).status, 401);

  const oldLogin = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
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
