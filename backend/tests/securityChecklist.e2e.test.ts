'use strict';

// The plan (6) §49 items that had no test of their own, and the audit rows
// of §21 added with them:
//
//  - the panel API answers no CORS preflight from an unknown origin
//  - SQL-looking search text is just text, and stays inside the tenant
//  - an error answer carries no stack trace
//  - adding, changing and deleting a site, and assigning a conversation,
//    leave audit rows that say what changed but not the content
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { BASE, joinAsVisitor } from './helpers/widget';
import { verifyEmail } from './helpers/accounts';

const PASSWORD = 'Rt5!checklist';
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

async function owner() {
  const email = `owner${stamp()}@checklist.test`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Checklist Owner', email, password: PASSWORD }
  });
  assert.equal(reg.status, 201);
  await verifyEmail(email);
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(reg.headers.get('set-cookie') || '');
  return {
    token: match ? decodeURIComponent(match[1]) : '',
    userId: String(reg.body.user._id || reg.body.user.id),
    organizationId: String(reg.body.user.organizationId)
  };
}

async function waitFor<T>(check: () => Promise<T>, label: string): Promise<T> {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const auditRow = (action: string, entityId: string) =>
  waitFor(async () => {
    const { rows } = await query(
      'SELECT user_id, metadata FROM audit_logs WHERE action = $1 AND entity_id = $2',
      [action, entityId]
    );
    return rows[0];
  }, `${action} audit row`);

test.after(async () => {
  await getPool().end();
});

test('the panel API gives no CORS grant to an unknown origin', async () => {
  const res = await fetch(`${BASE}/api/auth/me`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization'
    }
  });
  const allowed = res.headers.get('access-control-allow-origin');
  assert.ok(allowed !== '*' && allowed !== 'https://evil.example', `granted to ${allowed}`);
  assert.notEqual(res.headers.get('access-control-allow-credentials'), 'true');
});

test('SQL-looking search text is only text, and stays in the tenant', async () => {
  const a = await owner();
  const site = await api('/api/sites', {
    method: 'POST',
    token: a.token,
    body: { name: 'A', domain: `a-${stamp()}.example` }
  });
  assert.equal(site.status, 201);
  for (const search of ["' OR 1=1 --", '%', '_', '\\', "'); DROP TABLE messages; --"]) {
    const res = await api(
      `/api/conversations/${site.body.site._id}?search=${encodeURIComponent(search)}`,
      { token: a.token }
    );
    assert.equal(res.status, 200, `search ${JSON.stringify(search)} -> ${res.status}`);
    assert.equal(res.body.conversations.length, 0, `search ${JSON.stringify(search)} matched`);
  }
  const tables = await query("SELECT to_regclass('public.messages') AS t");
  assert.ok(tables.rows[0].t, 'the messages table is gone');
});

test('an error answer carries no stack trace', async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{"email": "broken'
  });
  assert.ok(res.status >= 400 && res.status < 500, `status ${res.status}`);
  const text = await res.text();
  assert.doesNotMatch(text, /\bat \S+ \(|node_modules|SyntaxError|"stack"/);
});

test('site changes and assignment leave audit rows without the content', async () => {
  const a = await owner();
  const created = await api('/api/sites', {
    method: 'POST',
    token: a.token,
    body: { name: 'Audited', domain: `audited-${stamp()}.example` }
  });
  assert.equal(created.status, 201);
  const siteId = String(created.body.site._id);
  const createdRow: any = await auditRow('SITE_CREATED', siteId);
  assert.equal(createdRow.user_id, a.userId);

  const updated = await api(`/api/sites/${siteId}`, {
    method: 'PUT',
    token: a.token,
    body: { name: 'Audited and renamed' }
  });
  assert.equal(updated.status, 200);
  const updatedRow: any = await auditRow('SITE_UPDATED', siteId);
  assert.deepEqual(updatedRow.metadata.fields, ['name']);

  const widget = await api(`/api/widget-config/site/${siteId}`, {
    method: 'PUT',
    token: a.token,
    body: { messages: { welcomeMessage: 'Hoş geldiniz' } }
  });
  assert.equal(widget.status, 200, JSON.stringify(widget.body));
  const widgetRow: any = await auditRow('WIDGET_SETTINGS_UPDATED', siteId);
  assert.deepEqual(widgetRow.metadata.sections, ['messages']);
  assert.doesNotMatch(JSON.stringify(widgetRow.metadata), /Hoş geldiniz/);

  // A visitor writes; the owner takes the conversation.
  const { socket, joined } = await joinAsVisitor(created.body.site.siteKey);
  assert.ok(joined);
  const sent: any = await new Promise((resolve) =>
    socket.emit(
      'send-message',
      { content: 'Gizli içerik', clientMessageId: `sc-${stamp()}` },
      resolve
    )
  );
  socket.close();
  const conversationId = String(sent.message.conversationId);
  const assigned = await api(`/api/conversations/${conversationId}/assign`, {
    method: 'PUT',
    token: a.token,
    body: { agentId: a.userId }
  });
  assert.equal(assigned.status, 200, JSON.stringify(assigned.body));
  const assignRow: any = await auditRow('CONVERSATION_ASSIGNED', conversationId);
  assert.equal(assignRow.metadata.to, a.userId);
  assert.doesNotMatch(JSON.stringify(assignRow.metadata), /Gizli/);

  const deleted = await api(`/api/sites/${siteId}`, { method: 'DELETE', token: a.token });
  assert.equal(deleted.status, 200);
  await auditRow('SITE_DELETED', siteId);
});
