'use strict';

// Inviting agents (plan §7.3): the invited person chooses their own password,
// a link works once, and the rules about who may hand out which role hold.
//
// Needs the running API with the console mail transport. Run: npm test

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { BASE } from './helpers/widget';
import { setPlan, tokenFromMail } from './helpers/accounts';

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
  `${label}${Date.now()}${Math.floor(Math.random() * 100000)}@invite.test`;

async function owner(plan: 'FREE' | 'PRO' | 'ENTERPRISE' = 'PRO') {
  const email = unique('owner');
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Invite Owner', email, password: PASSWORD }
  });
  assert.equal(reg.status, 201);
  await setPlan(reg.body.user.organizationId, plan);
  const site = await api('/api/sites', {
    method: 'POST',
    token: sessionCookie(reg),
    body: { name: 'Invite site', domain: `${Date.now()}${Math.random()}.example`.replace('0.', '') }
  });
  assert.equal(site.status, 201, JSON.stringify(site.body));
  return {
    token: sessionCookie(reg),
    organizationId: String(reg.body.user.organizationId),
    site: site.body.site
  };
}

async function invite(token: string, body: Record<string, unknown>) {
  return api('/api/invitations', { method: 'POST', token, body });
}

async function accept(token: string, name = 'Invited Agent', password = PASSWORD) {
  return api('/api/invitations/accept', { method: 'POST', body: { token, name, password } });
}

test.after(async () => {
  await getPool().end();
});

test('an invited agent chooses their own password and is signed in', async () => {
  const org = await owner();
  const email = unique('agent');
  const sent = await invite(org.token, { email, role: 'agent', assignedSites: [org.site._id] });
  assert.equal(sent.status, 201, JSON.stringify(sent.body));
  assert.equal(sent.body.sent, true);
  assert.equal(sent.body.invitation.status, 'pending');

  const token = await tokenFromMail(email, '/invite/accept');
  const preview = await api(`/api/invitations/accept?token=${encodeURIComponent(token)}`);
  assert.equal(preview.status, 200);
  assert.equal(preview.body.email, email);
  assert.equal(preview.body.role, 'agent');

  const accepted = await accept(token, 'Ayşe Temsilci');
  assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
  assert.equal(accepted.body.user.emailVerified, true);
  const session = sessionCookie(accepted);
  const me = await api('/api/auth/me', { token: session });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.userType, 'team');
  assert.equal(me.body.user.role, 'agent');

  // The password is theirs: it signs them in.
  const login = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  assert.equal(login.status, 200);

  // The site restriction travelled with the invitation.
  const { rows } = await query(
    `SELECT array_agg(s.site_id) AS sites FROM team_assigned_sites s
       JOIN teams t ON t.id = s.team_id WHERE t.email = $1`,
    [email]
  );
  assert.deepEqual(rows[0].sites, [org.site._id]);

  const list = await api('/api/invitations', { token: org.token });
  assert.equal(list.body.invitations.find((i: any) => i.email === email).status, 'accepted');

  const replay = await accept(token, 'Someone Else');
  assert.equal(replay.status, 400);
  assert.equal(replay.body.code, 'INVALID_INVITATION');
});

test('a link accepted twice at once makes one account', async () => {
  const org = await owner();
  const email = unique('twice');
  await invite(org.token, { email, role: 'agent' });
  const token = await tokenFromMail(email, '/invite/accept');

  const results = await Promise.all([accept(token), accept(token), accept(token)]);
  assert.equal(results.filter((r) => r.status === 201).length, 1, JSON.stringify(results.map((r) => r.status)));
  const { rows } = await query('SELECT count(*)::int AS n FROM teams WHERE email = $1', [email]);
  assert.equal(rows[0].n, 1);
});

test('revoked, replaced and expired invitations do not work', async () => {
  const org = await owner();

  const revokedEmail = unique('revoked');
  const revoked = await invite(org.token, { email: revokedEmail, role: 'agent' });
  const revokedToken = await tokenFromMail(revokedEmail, '/invite/accept');
  const del = await api(`/api/invitations/${revoked.body.invitation._id}`, {
    method: 'DELETE',
    token: org.token
  });
  assert.equal(del.status, 200);
  assert.equal((await accept(revokedToken)).status, 400);

  const replacedEmail = unique('replaced');
  await invite(org.token, { email: replacedEmail, role: 'agent' });
  const first = await tokenFromMail(replacedEmail, '/invite/accept');
  await invite(org.token, { email: replacedEmail, role: 'manager' });
  // The newest mail carries the newest link.
  const second = await tokenFromMail(replacedEmail, '/invite/accept');
  assert.notEqual(first, second);
  assert.equal((await accept(first)).status, 400, 'a replaced invitation still worked');
  const ok = await accept(second);
  assert.equal(ok.status, 201);
  assert.equal(ok.body.user.role, 'manager');

  const expiredEmail = unique('expired');
  await invite(org.token, { email: expiredEmail, role: 'agent' });
  const expiredToken = await tokenFromMail(expiredEmail, '/invite/accept');
  await query(
    `UPDATE invitations SET expires_at = now() - interval '1 minute' WHERE lower(email) = $1`,
    [expiredEmail]
  );
  assert.equal((await accept(expiredToken)).status, 400);
});

test('who may invite whom', async () => {
  const org = await owner();

  // An admin, through an invitation.
  const adminEmail = unique('admin');
  await invite(org.token, { email: adminEmail, role: 'admin' });
  const admin = await accept(await tokenFromMail(adminEmail, '/invite/accept'));
  const adminToken = sessionCookie(admin);

  const peer = await invite(adminToken, { email: unique('peer'), role: 'admin' });
  assert.equal(peer.status, 403, 'an admin invited a peer admin');
  const agent = await invite(adminToken, { email: unique('byadmin'), role: 'agent' });
  assert.equal(agent.status, 201, 'an admin could not invite an agent');

  // An agent cannot invite anyone.
  const agentEmail = unique('agentx');
  await invite(org.token, { email: agentEmail, role: 'agent' });
  const agentSession = sessionCookie(await accept(await tokenFromMail(agentEmail, '/invite/accept')));
  assert.equal((await invite(agentSession, { email: unique('nope'), role: 'agent' })).status, 403);

  // Nobody invites an address that already has an account.
  const taken = await invite(org.token, { email: adminEmail, role: 'agent' });
  assert.equal(taken.status, 409);

  // Creating an agent with a typed password is the owner's alone now.
  const direct = await api('/api/team', {
    method: 'POST',
    token: adminToken,
    body: { email: unique('direct'), password: PASSWORD, name: 'Direct', role: 'agent' }
  });
  assert.equal(direct.status, 403);
});

test("an organization cannot see or revoke another's invitations", async () => {
  const a = await owner();
  const b = await owner();
  const sent = await invite(a.token, { email: unique('cross'), role: 'agent' });
  const id = sent.body.invitation._id;

  const list = await api('/api/invitations', { token: b.token });
  assert.ok(!JSON.stringify(list.body).includes(id));
  assert.equal((await api(`/api/invitations/${id}`, { method: 'DELETE', token: b.token })).status, 404);
  assert.equal(
    (await api(`/api/invitations/${id}/resend`, { method: 'POST', token: b.token })).status,
    404
  );
  const foreignSite = await invite(a.token, {
    email: unique('foreignsite'),
    role: 'agent',
    assignedSites: [b.site._id]
  });
  assert.equal(foreignSite.status, 400, "another organization's site was accepted");
});
