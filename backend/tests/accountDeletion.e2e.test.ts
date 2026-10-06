'use strict';

// Deleting the workspace (plan (6) §22). The owner's "delete account" takes
// the organization and everything in it: sites stop answering, the visitors'
// details and the conversations are gone, the accounts are anonymous and
// signed out. It wants the password again, and a live subscription has to be
// cancelled first. Anyone else deleting their account leaves only themselves.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { BASE, joinAsVisitor, widgetSession } from './helpers/widget';
import { setPlan, verifyEmail } from './helpers/accounts';
import crypto from 'crypto';

const PASSWORD = 'Wq7!delete-me';
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

async function api(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  let json: any = null;
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

/** A verified owner with one site and one visitor conversation. */
async function workspace() {
  const email = `owner${stamp()}@deletion.test`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Deletion Owner', email, password: PASSWORD }
  });
  assert.equal(reg.status, 201);
  await verifyEmail(email);
  const token = sessionCookie(reg);
  const organizationId = String(reg.body.user.organizationId);
  const site = await api('/api/sites', {
    method: 'POST',
    token,
    body: { name: 'Shop', domain: `shop-${stamp()}.example` }
  });
  assert.equal(site.status, 201);
  const { socket, visitorId } = await joinAsVisitor(site.body.site.siteKey, {
    visitorName: 'Ayşe',
    visitorEmail: 'ayse@example.com'
  });
  const sent: any = await new Promise((resolve) =>
    socket.emit('send-message', { content: 'Merhaba', clientMessageId: `del-${stamp()}` }, resolve)
  );
  assert.equal(sent?.ok, true);
  socket.close();
  return { email, token, organizationId, siteKey: site.body.site.siteKey, visitorId };
}

const count = async (sql: string, params: unknown[]) =>
  (await query<{ n: number }>(sql, params)).rows[0].n;

test.after(async () => {
  await getPool().end();
});

test('the owner deletes the workspace only with the password', async () => {
  const w = await workspace();

  const without = await api('/api/auth/account', { method: 'DELETE', token: w.token });
  assert.equal(without.status, 403);
  assert.equal(without.body.code, 'PASSWORD_INCORRECT');

  const wrong = await api('/api/auth/account', {
    method: 'DELETE',
    token: w.token,
    body: { password: 'not-the-password' }
  });
  assert.equal(wrong.status, 403);
  assert.equal(
    await count('SELECT count(*)::int AS n FROM organizations WHERE id = $1', [w.organizationId]),
    1
  );
});

test('a live subscription has to be cancelled first', async () => {
  const w = await workspace();
  await query(
    `INSERT INTO subscriptions (id, organization_id, provider_subscription_id,
                                plan_type, status, last_event_at)
     VALUES ($1, $2, $3, 'PRO', 'active', now())`,
    [crypto.randomBytes(12).toString('hex'), w.organizationId, `sub_del_${stamp()}`]
  );
  const res = await api('/api/auth/account', {
    method: 'DELETE',
    token: w.token,
    body: { password: PASSWORD }
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, 'SUBSCRIPTION_ACTIVE');
  assert.equal(
    await count('SELECT count(*)::int AS n FROM organizations WHERE id = $1', [w.organizationId]),
    1
  );
});

test('deleting the workspace removes its data and closes the widget', async () => {
  const w = await workspace();
  const org = [w.organizationId];
  assert.equal(
    await count('SELECT count(*)::int AS n FROM conversations WHERE organization_id = $1', org),
    1
  );

  const res = await api('/api/auth/account', {
    method: 'DELETE',
    token: w.token,
    body: { password: PASSWORD }
  });
  assert.equal(res.status, 200);
  assert.equal(res.body.workspaceDeleted, true);

  for (const table of ['organizations', 'sites', 'conversations', 'visitors', 'audit_logs']) {
    const column = table === 'organizations' ? 'id' : 'organization_id';
    assert.equal(
      await count(`SELECT count(*)::int AS n FROM ${table} WHERE ${column} = $1`, org),
      0,
      `${table} still has rows of the deleted workspace`
    );
  }
  assert.equal(
    await count(
      `SELECT count(*)::int AS n FROM messages m
        WHERE NOT EXISTS (SELECT 1 FROM conversations c WHERE c.id = m.conversation_id)`,
      []
    ),
    0
  );

  // The account is anonymous and cannot sign in or act any more.
  assert.equal(
    await count('SELECT count(*)::int AS n FROM users WHERE lower(email) = lower($1)', [w.email]),
    0
  );
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email: w.email, password: PASSWORD }
  });
  assert.equal(login.status, 401);
  assert.equal((await api('/api/sites', { token: w.token })).status, 401);

  // The site's widget no longer opens.
  assert.equal((await widgetSession(w.siteKey)).status, 404);
});

test('a teammate deleting their own account leaves the workspace alone', async () => {
  const w = await workspace();
  await setPlan(w.organizationId, 'PRO');
  const email = `agent${stamp()}@deletion.test`;
  const agent = await api('/api/team', {
    method: 'POST',
    token: w.token,
    body: { name: 'Agent', email, password: PASSWORD, role: 'agent' }
  });
  assert.equal(agent.status, 201, JSON.stringify(agent.body));
  const login = await api('/api/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD }
  });
  const agentToken = sessionCookie(login);
  const res = await api('/api/auth/account', { method: 'DELETE', token: agentToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.workspaceDeleted, undefined);
  assert.equal(
    await count('SELECT count(*)::int AS n FROM organizations WHERE id = $1', [w.organizationId]),
    1
  );
});
