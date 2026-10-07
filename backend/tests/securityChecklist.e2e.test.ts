'use strict';

// The plan (6) §49 items that had no test of their own, and the audit rows
// of §21 added with them:
//
//  - the panel API answers no CORS preflight from an unknown origin
//  - SQL-looking search text is just text, and stays inside the tenant
//  - an error answer carries no stack trace
//  - adding, changing and deleting a site, and assigning a conversation,
//    leave audit rows that say what changed but not the content
//  - /.well-known/security.txt names where to report a vulnerability (SEC-10)
//  - the CSP names a report endpoint that answers 204 and logs no URL (SEC-11)
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { BASE, joinAsVisitor } from './helpers/widget';
import { signUp } from './helpers/accounts';
import { summarize } from '../src/routes/cspReport';

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
  const reg = await signUp({ name: 'Checklist Owner', email, password: PASSWORD });
  assert.equal(reg.status, 201);
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

// proxy-addr below 2.0.8 could be talked into trusting an IPv4-mapped IPv6
// address, and every per-IP limit, the account lock and the 90-day IP log
// key on the address Express resolves. The backend trusts exactly one hop
// (Caddy, which overwrites X-Forwarded-For with the address it resolved), so
// whatever a client prepends must not move the key, and the mapped and plain
// forms of one IPv4 address must land in the same bucket.
test('a forged X-Forwarded-For does not change the rate-limit key', async () => {
  const express = (await import('express')).default;
  const { identifyClient } = await import('../src/middleware/rateLimit');
  const app = express();
  app.set('trust proxy', 1);
  app.get('/key', (req, res) => {
    res.json({ ip: req.ip, key: identifyClient(req) });
  });
  const server = app.listen(0);
  try {
    const { port } = server.address() as { port: number };
    const keyFor = async (forwardedFor: string) => {
      const res = await fetch(`http://127.0.0.1:${port}/key`, {
        headers: { 'X-Forwarded-For': forwardedFor }
      });
      return (await res.json()) as { ip: string; key: string };
    };

    // What Caddy sends: one entry, the resolved visitor.
    const real = await keyFor('9.9.9.9');
    assert.equal(real.key, 'ip:9.9.9.9');

    // A client that writes its own header in front of Caddy's entry.
    for (const forged of [
      '::ffff:1.2.3.4, 9.9.9.9',
      '1.2.3.4, 9.9.9.9',
      '10.0.0.1, ::ffff:9.9.9.9'
    ]) {
      const seen = await keyFor(forged);
      assert.equal(seen.key, real.key, `forged header "${forged}" moved the key to ${seen.key}`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('security.txt names a contact, an expiry under a year and the policy', async () => {
  const res = await fetch(`${BASE}/.well-known/security.txt`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /^text\/plain/);
  const text = await res.text();
  assert.match(text, /^Contact: mailto:\S+@\S+$/m);
  assert.match(text, /^Preferred-Languages: tr, en$/m);
  assert.match(text, /^Canonical: https?:\/\/\S+\/\.well-known\/security\.txt$/m);
  assert.match(text, /^Policy: https?:\/\/\S+\/kullanim-sartlari#guvenlik$/m);
  const expires = Date.parse(/^Expires: (\S+)$/m.exec(text)?.[1] || '');
  assert.ok(expires > Date.now(), 'not expired');
  assert.ok(expires < Date.now() + 365 * 24 * 60 * 60 * 1000, 'less than a year ahead');

  const legacy = await fetch(`${BASE}/security.txt`, { redirect: 'manual' });
  assert.equal(legacy.status, 301);
  assert.equal(legacy.headers.get('location'), '/.well-known/security.txt');
});

test('CSP violations are reported to an endpoint that keeps no URL', async () => {
  const page = await fetch(`${BASE}/api/plans`);
  const policy = page.headers.get('content-security-policy') || '';
  assert.match(policy, /report-uri \/api\/csp-report/);
  assert.match(policy, /report-to csp/);
  assert.equal(page.headers.get('reporting-endpoints'), 'csp="/api/csp-report"');

  const legacy = await fetch(`${BASE}/api/csp-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/csp-report' },
    body: JSON.stringify({
      'csp-report': {
        'document-uri': 'https://app.example/verify-email?token=secret',
        'violated-directive': 'script-src',
        'blocked-uri': 'https://evil.example/x.js?mail=a@b.example'
      }
    })
  });
  assert.equal(legacy.status, 204);
  const modern = await fetch(`${BASE}/api/csp-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/reports+json' },
    body: JSON.stringify([{ type: 'csp-violation', body: { effectiveDirective: 'img-src' } }])
  });
  assert.equal(modern.status, 204);
  const huge = await fetch(`${BASE}/api/csp-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/csp-report' },
    body: JSON.stringify({ 'csp-report': { 'blocked-uri': 'x'.repeat(9000) } })
  });
  assert.equal(huge.status, 413);

  // What would be logged: the directive and origins, never a query string.
  const [line] = summarize({
    'csp-report': {
      'document-uri': 'https://app.example/verify-email?token=secret',
      'effective-directive': 'script-src-elem',
      'blocked-uri': 'https://evil.example/x.js?mail=a@b.example'
    }
  });
  assert.deepEqual(line, {
    directive: 'script-src-elem',
    blocked: 'https://evil.example',
    page: '/verify-email',
    disposition: null
  });
  assert.deepEqual(
    summarize([{ type: 'csp-violation', body: { blockedURL: 'inline' } }])[0].blocked,
    'inline'
  );
});
