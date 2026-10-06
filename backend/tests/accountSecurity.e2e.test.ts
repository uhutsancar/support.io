'use strict';

// The signed-in account's own security (plan v10 SEC-03, SEC-04, SEC-05):
//
//  - changing the password asks for the current one, ends every other
//    session and tells the owner by mail
//  - changing the address goes through a link to the new address; a taken
//    address gets the same answer and no mail
//  - "sign out everywhere" ends the other sessions, not this one
//  - two-step sign-in: enrolment needs the password and a first code;
//    sign-in then needs the second step; a code works once; a recovery
//    code works once; turning it off needs the password and a code
//  - an organization can require it of every member (Enterprise)
//  - a hand-set plan is not moved by a subscription event
//
// Needs the running API with the console mail transport. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { getPool, query } from '../src/db/pool';
import { BASE } from './helpers/widget';
import { outbox, setPlan, signUp, tokenFromMail } from './helpers/accounts';
import { stepAt, totpCode } from '../src/services/totp';

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
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

const unique = (label: string) =>
  `${label}${Date.now()}${Math.floor(Math.random() * 100000)}@account-security.test`;

async function owner(label = 'owner') {
  const email = unique(label);
  const reg = await signUp({ name: 'Security Owner', email, password: PASSWORD });
  return {
    email,
    token: sessionCookie(reg),
    userId: String(reg.body.user._id),
    organizationId: String(reg.body.user.organizationId)
  };
}

const login = (email: string, password = PASSWORD) =>
  api('/api/auth/login', { method: 'POST', body: { email, password } });

async function auditCount(action: string, userId: string): Promise<number> {
  for (let i = 0; i < 20; i++) {
    // Audit rows are written by an event listener after the response.
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await query(
      'SELECT count(*)::int AS n FROM audit_logs WHERE action = $1 AND user_id = $2',
      [action, userId]
    );
    if (rows[0].n > 0) return rows[0].n;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
  }
  return 0;
}

/** Enrols two-step sign-in and returns the secret and the recovery codes. */
async function enrol(token: string) {
  const setup = await api('/api/auth/2fa/setup', {
    method: 'POST',
    token,
    body: { password: PASSWORD }
  });
  assert.equal(setup.status, 200, JSON.stringify(setup.body));
  const secret: string = setup.body.secret;
  const confirm = await api('/api/auth/2fa/confirm', {
    method: 'POST',
    token,
    body: { code: totpCode(secret, stepAt()) }
  });
  assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
  return {
    secret,
    recoveryCodes: confirm.body.recoveryCodes as string[],
    token: sessionCookie(confirm)
  };
}

test.after(async () => {
  await getPool().end();
});

test('changing the password asks for the current one and ends the other sessions', async () => {
  const me = await owner('pw');
  const second = sessionCookie(await login(me.email));
  assert.ok(second);

  const wrong = await api('/api/auth/change-password', {
    method: 'POST',
    token: me.token,
    body: { currentPassword: 'not-the-password', newPassword: 'Brand-New-Passw0rd!' }
  });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, 'PASSWORD_INCORRECT');

  const weak = await api('/api/auth/change-password', {
    method: 'POST',
    token: me.token,
    body: { currentPassword: PASSWORD, newPassword: 'password123' }
  });
  assert.equal(weak.status, 400);
  assert.equal(weak.body.code, 'PASSWORD_TOO_COMMON');

  const NEW_PASSWORD = 'Brand-New-Passw0rd!';
  const changed = await api('/api/auth/change-password', {
    method: 'POST',
    token: me.token,
    body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD }
  });
  assert.equal(changed.status, 200, JSON.stringify(changed.body));
  const fresh = sessionCookie(changed);
  assert.ok(fresh && changed.body.csrfToken, 'this browser gets a new session');

  assert.equal((await api('/api/auth/me', { token: second })).status, 401, 'other device');
  assert.equal((await api('/api/auth/me', { token: me.token })).status, 401, 'old cookie');
  assert.equal((await api('/api/auth/me', { token: fresh })).status, 200);
  assert.equal((await login(me.email)).status, 401);
  assert.equal((await login(me.email, NEW_PASSWORD)).status, 200);

  const mails = await outbox(me.email);
  assert.match(mails[0].subject, /Şifreniz değiştirildi|password was changed/);
  assert.equal(await auditCount('PASSWORD_CHANGED', me.userId), 1);
});

test('changing the address goes through a link to the new address', async () => {
  const me = await owner('mail');
  const other = await owner('taken');
  const target = unique('new');

  const noPassword = await api('/api/auth/change-email', {
    method: 'POST',
    token: me.token,
    body: { newEmail: target, password: 'wrong-password' }
  });
  assert.equal(noPassword.status, 400);
  assert.equal(noPassword.body.code, 'PASSWORD_INCORRECT');

  // A taken address: the same answer, and no mail to its owner.
  const otherMails = (await outbox(other.email)).length;
  const taken = await api('/api/auth/change-email', {
    method: 'POST',
    token: me.token,
    body: { newEmail: other.email, password: PASSWORD }
  });
  const requested = await api('/api/auth/change-email', {
    method: 'POST',
    token: me.token,
    body: { newEmail: target, password: PASSWORD }
  });
  assert.equal(taken.status, 200);
  assert.equal(requested.status, 200);
  assert.deepEqual(taken.body, requested.body);
  assert.equal((await outbox(other.email)).length, otherMails);

  // The old address is told; until the link is opened it stays in force.
  const notice = (await outbox(me.email))[0];
  assert.match(notice.text, new RegExp(target.replace(/[.]/g, '\\.')));
  assert.equal((await login(me.email)).status, 200);

  const token = await tokenFromMail(target, '/confirm-email');
  const confirmed = await api('/api/auth/confirm-email-change', {
    method: 'POST',
    body: { token }
  });
  assert.equal(confirmed.status, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.email, target);
  const reused = await api('/api/auth/confirm-email-change', { method: 'POST', body: { token } });
  assert.equal(reused.status, 400);

  assert.equal((await login(me.email)).status, 401);
  assert.equal((await login(target)).status, 200);
  assert.equal(await auditCount('EMAIL_CHANGED', me.userId), 1);
});

test('signing out everywhere keeps only this browser', async () => {
  const me = await owner('revoke');
  const second = sessionCookie(await login(me.email));
  const revoked = await api('/api/auth/sessions/revoke', { method: 'POST', token: me.token });
  assert.equal(revoked.status, 200);
  assert.equal((await api('/api/auth/me', { token: second })).status, 401);
  assert.equal((await api('/api/auth/me', { token: sessionCookie(revoked) })).status, 200);
  assert.equal(await auditCount('SESSIONS_REVOKED', me.userId), 1);
});

test('two-step sign-in: enrolment, the second step, one use per code', async () => {
  const me = await owner('mfa');

  const noPassword = await api('/api/auth/2fa/setup', {
    method: 'POST',
    token: me.token,
    body: { password: 'wrong-password' }
  });
  assert.equal(noPassword.status, 400);

  const setup = await api('/api/auth/2fa/setup', {
    method: 'POST',
    token: me.token,
    body: { password: PASSWORD }
  });
  assert.equal(setup.status, 200);
  assert.match(setup.body.otpauthUri, /^otpauth:\/\/totp\/Support\.io/);
  assert.equal(setup.headers.get('cache-control'), 'no-store');
  const badConfirm = await api('/api/auth/2fa/confirm', {
    method: 'POST',
    token: me.token,
    body: { code: '000000' }
  });
  assert.equal(badConfirm.status, 400);

  const confirm = await api('/api/auth/2fa/confirm', {
    method: 'POST',
    token: me.token,
    body: { code: totpCode(setup.body.secret, stepAt()) }
  });
  assert.equal(confirm.status, 200, JSON.stringify(confirm.body));
  const recovery: string[] = confirm.body.recoveryCodes;
  assert.equal(recovery.length, 10);
  const secret: string = setup.body.secret;

  // Nothing about the secret or the codes is stored in the clear.
  const { rows } = await query('SELECT totp_secret_enc, recovery_codes FROM users WHERE id = $1', [
    me.userId
  ]);
  assert.ok(!String(rows[0].totp_secret_enc).includes(secret));
  assert.ok(!JSON.stringify(rows[0].recovery_codes).includes(recovery[0]));

  // The password alone now earns only a pending token, which is no session.
  const first = await login(me.email);
  assert.equal(first.status, 200);
  assert.equal(first.body.mfaRequired, true);
  assert.equal(sessionCookie(first), '');
  assert.equal((await api('/api/auth/me', { token: first.body.mfaToken })).status, 401);

  const wrong = await api('/api/auth/login/2fa', {
    method: 'POST',
    body: { mfaToken: first.body.mfaToken, code: '123456' }
  });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.code, 'MFA_CODE_INVALID');

  const code = totpCode(secret, stepAt() + 1);
  const second = await api('/api/auth/login/2fa', {
    method: 'POST',
    body: { mfaToken: first.body.mfaToken, code }
  });
  assert.equal(second.status, 200, JSON.stringify(second.body));
  const session = sessionCookie(second);
  assert.equal((await api('/api/auth/me', { token: session })).body.user.mfaEnabled, true);

  // The same code a second time is refused.
  const again = await login(me.email);
  const replay = await api('/api/auth/login/2fa', {
    method: 'POST',
    body: { mfaToken: again.body.mfaToken, code }
  });
  assert.equal(replay.status, 400, 'a used code worked twice');

  // A recovery code works, once.
  const viaRecovery = await api('/api/auth/login/2fa', {
    method: 'POST',
    body: { mfaToken: again.body.mfaToken, recoveryCode: recovery[0].toUpperCase() }
  });
  assert.equal(viaRecovery.status, 200);
  const third = await login(me.email);
  const recoveryReplay = await api('/api/auth/login/2fa', {
    method: 'POST',
    body: { mfaToken: third.body.mfaToken, recoveryCode: recovery[0] }
  });
  assert.equal(recoveryReplay.status, 400);
  assert.equal(await auditCount('MFA_RECOVERY_USED', me.userId), 1);

  const status = await api('/api/auth/2fa', { token: session });
  assert.deepEqual(status.body, {
    enabled: true,
    recoveryCodesLeft: 9,
    enforcedByOrganization: false
  });

  // Off again: the password and a code.
  const offWithoutCode = await api('/api/auth/2fa/disable', {
    method: 'POST',
    token: session,
    body: { password: PASSWORD }
  });
  assert.equal(offWithoutCode.status, 400);
  const off = await api('/api/auth/2fa/disable', {
    method: 'POST',
    token: session,
    body: { password: PASSWORD, recoveryCode: recovery[1] }
  });
  assert.equal(off.status, 200);
  const plain = await login(me.email);
  assert.ok(sessionCookie(plain), 'the password alone signs in again');
  assert.equal(await auditCount('MFA_ENABLED', me.userId), 1);
  assert.equal(await auditCount('MFA_DISABLED', me.userId), 1);
});

test('a pending sign-in dies with a password change', async () => {
  const me = await owner('pending');
  const { secret, token } = await enrol(me.token);
  const pending = await login(me.email);
  assert.equal(pending.body.mfaRequired, true);

  const changed = await api('/api/auth/change-password', {
    method: 'POST',
    token,
    body: { currentPassword: PASSWORD, newPassword: 'Another-Passw0rd-9' }
  });
  assert.equal(changed.status, 200);
  const late = await api('/api/auth/login/2fa', {
    method: 'POST',
    body: { mfaToken: pending.body.mfaToken, code: totpCode(secret, stepAt() + 1) }
  });
  assert.equal(late.status, 401);
  assert.equal(late.body.code, 'MFA_EXPIRED');

  // A token from another key never passes.
  const forged = await api('/api/auth/login/2fa', {
    method: 'POST',
    body: { mfaToken: crypto.randomBytes(40).toString('base64url'), code: '123456' }
  });
  assert.equal(forged.status, 401);
});

test('an organization can require two-step sign-in of every member', async () => {
  const boss = await owner('enforce');

  // Free plan: not available.
  await setPlan(boss.organizationId, 'FREE');
  const onFree = await api('/api/auth/organization-security', {
    method: 'PUT',
    token: boss.token,
    body: { enforce2fa: true }
  });
  assert.equal(onFree.status, 403);
  assert.equal(onFree.body.code, 'PLAN_FEATURE_REQUIRED');

  await setPlan(boss.organizationId, 'ENTERPRISE');
  const first = await api('/api/auth/organization-security', {
    method: 'PUT',
    token: boss.token,
    body: { enforce2fa: true }
  });
  assert.equal(first.status, 409, 'whoever switches it on needs it first');
  assert.equal(first.body.code, 'MFA_REQUIRED_FIRST');

  const enrolled = await enrol(boss.token);
  const site = await api('/api/sites', {
    method: 'POST',
    token: enrolled.token,
    body: { name: 'Enforced', domain: `${Date.now()}enforced.example` }
  });
  assert.equal(site.status, 201, JSON.stringify(site.body));
  const memberEmail = unique('member');
  const created = await api('/api/team', {
    method: 'POST',
    token: enrolled.token,
    body: {
      name: 'Member',
      email: memberEmail,
      password: PASSWORD,
      role: 'agent',
      assignedSites: [site.body.site._id]
    }
  });
  assert.ok(created.status === 200 || created.status === 201, JSON.stringify(created.body));

  const on = await api('/api/auth/organization-security', {
    method: 'PUT',
    token: enrolled.token,
    body: { enforce2fa: true }
  });
  assert.equal(on.status, 200, JSON.stringify(on.body));

  const member = sessionCookie(await login(memberEmail));
  const me = await api('/api/auth/me', { token: member });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.mfaSetupRequired, true);
  const blocked = await api('/api/sites', { token: member });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.code, 'MFA_SETUP_REQUIRED');

  // Setting it up is still possible, and opens the rest.
  const setup = await api('/api/auth/2fa/setup', {
    method: 'POST',
    token: member,
    body: { password: PASSWORD }
  });
  assert.equal(setup.status, 200);
  const confirm = await api('/api/auth/2fa/confirm', {
    method: 'POST',
    token: member,
    body: { code: totpCode(setup.body.secret, stepAt()) }
  });
  assert.equal(confirm.status, 200);
  const open = await api('/api/sites', { token: sessionCookie(confirm) });
  assert.equal(open.status, 200);

  // And it cannot be switched off while the organization asks for it.
  const off = await api('/api/auth/2fa/disable', {
    method: 'POST',
    token: sessionCookie(confirm),
    body: { password: PASSWORD, recoveryCode: confirm.body.recoveryCodes[0] }
  });
  assert.equal(off.status, 403);
  assert.equal(off.body.code, 'MFA_ENFORCED');
});

test('the security mails carry no code, secret or token', async () => {
  const me = await owner('mails');
  const { secret, recoveryCodes } = await enrol(me.token);
  const mails = await outbox(me.email);
  for (const mail of mails) {
    assert.ok(!mail.text.includes(secret));
    for (const code of recoveryCodes) assert.ok(!mail.text.includes(code));
  }
  assert.ok(
    mails.some((m) => /İki adımlı doğrulama açıldı|Two-step verification is on/.test(m.subject))
  );
});
