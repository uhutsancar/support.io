'use strict';

// Plan limits, enforced on the server and race-proof (plan §8, §18):
//
//  - sites and seats per plan, also under concurrent requests
//  - the monthly conversation quota stops at the limit exactly, open
//    conversations keep going, and the visitor sees a plain refusal
//  - the owner is mailed once at 80%
//  - paid features answer PLAN_UPGRADE_REQUIRED on the free plan
//  - GET /api/plans is the table the server enforces
//
// Needs the running API with the console mail transport. Run: npm test

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import type { Socket } from 'socket.io-client';
import { getPool, query } from '../src/db/pool';
import { PLAN_LIMITS } from '../src/domain/plans';
import { currentPeriod } from '../src/services/entitlements';
import { BASE, joinAsVisitor, widgetSession } from './helpers/widget';
import { outbox, setPlan, verifyEmail } from './helpers/accounts';

const PASSWORD = 'E2ePassw0rd!';

interface ApiResponse {
  status: number;
  body: any;
}

async function api(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}
): Promise<ApiResponse & { headers: Headers }> {
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

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

async function tenant(plan: 'FREE' | 'PRO' | 'ENTERPRISE', { site = true } = {}) {
  const email = `owner${stamp()}@limits.test`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Limits Owner', email, password: PASSWORD }
  });
  assert.equal(reg.status, 201);
  await verifyEmail(email);
  const organizationId = String(reg.body.user.organizationId);
  await setPlan(organizationId, plan);
  const token = sessionCookie(reg);
  let created: any = null;
  if (site) {
    const res = await api('/api/sites', {
      method: 'POST',
      token,
      body: { name: 'Limits site', domain: `l${stamp()}.example` }
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    created = res.body.site;
  }
  return { token, email, organizationId, site: created };
}

const sockets: Socket[] = [];
test.after(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await getPool().end();
});

test('GET /api/plans is the table the server enforces', async () => {
  const res = await fetch(`${BASE}/api/plans`);
  assert.equal(res.status, 200);
  const { plans } = (await res.json()) as any;
  for (const plan of plans) {
    const limits = PLAN_LIMITS[plan.type as keyof typeof PLAN_LIMITS];
    assert.equal(plan.sites, limits.sites);
    assert.equal(plan.agents, limits.agents);
    assert.equal(plan.monthlyConversations, limits.monthlyConversations);
    assert.deepEqual(plan.features, limits.features);
  }
});

test('sites: the plan limit holds, also for creations at the same moment', async () => {
  const free = await tenant('FREE');
  const second = await api('/api/sites', {
    method: 'POST',
    token: free.token,
    body: { name: 'second', domain: `s${stamp()}.example` }
  });
  assert.equal(second.status, 403);
  assert.equal(second.body.code, 'PLAN_LIMIT_REACHED');
  assert.equal(second.body.details.resource, 'sites');

  const pro = await tenant('PRO', { site: false });
  const burst = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      api('/api/sites', {
        method: 'POST',
        token: pro.token,
        body: { name: `burst ${i}`, domain: `b${i}${stamp()}.example` }
      })
    )
  );
  assert.equal(burst.filter((r) => r.status === 201).length, PLAN_LIMITS.PRO.sites);
  const { rows } = await query('SELECT count(*)::int AS n FROM sites WHERE organization_id = $1', [
    pro.organizationId
  ]);
  assert.equal(rows[0].n, PLAN_LIMITS.PRO.sites);
});

test('seats: invitations hold seats, and a burst of them stops at the limit', async () => {
  const free = await tenant('FREE');
  const refused = await api('/api/invitations', {
    method: 'POST',
    token: free.token,
    body: { email: `x${stamp()}@limits.test`, role: 'agent' }
  });
  assert.equal(refused.status, 403, 'the free plan has one seat, the owner’s');
  assert.equal(refused.body.code, 'PLAN_LIMIT_REACHED');

  const pro = await tenant('PRO');
  const burst = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      api('/api/invitations', {
        method: 'POST',
        token: pro.token,
        body: { email: `seat${i}${stamp()}@limits.test`, role: 'agent' }
      })
    )
  );
  // The owner holds one seat.
  assert.equal(burst.filter((r) => r.status === 201).length, PLAN_LIMITS.PRO.agents - 1);

  const usage = await query(
    `SELECT count(*)::int AS n FROM invitations
      WHERE organization_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL`,
    [pro.organizationId]
  );
  assert.equal(usage.rows[0].n, PLAN_LIMITS.PRO.agents - 1);

  // Revoking one frees its seat.
  const one = burst.find((r) => r.status === 201)!;
  await api(`/api/invitations/${one.body.invitation._id}`, { method: 'DELETE', token: pro.token });
  const again = await api('/api/invitations', {
    method: 'POST',
    token: pro.token,
    body: { email: `freed${stamp()}@limits.test`, role: 'agent' }
  });
  assert.equal(again.status, 201);
});

test('the conversation quota stops exactly at the limit; open conversations go on', async () => {
  const free = await tenant('FREE');
  const limit = PLAN_LIMITS.FREE.monthlyConversations;

  // A conversation already running before the quota fills.
  const regular = await joinAsVisitor(free.site.siteKey);
  sockets.push(regular.socket);
  const first = await regular.socket
    .timeout(10_000)
    .emitWithAck('send-message', { content: 'ilk', clientMessageId: 'c_q_first' });
  assert.equal(first.ok, true);

  // Three slots left, eight new visitors at once.
  await query(
    `UPDATE organization_usage_monthly SET conversations = $3
      WHERE organization_id = $1 AND period = $2`,
    [free.organizationId, currentPeriod(), limit - 3]
  );
  const visitors = await Promise.all(
    Array.from({ length: 8 }, () => joinAsVisitor(free.site.siteKey))
  );
  sockets.push(...visitors.map((v) => v.socket));
  const replies = await Promise.all(
    visitors.map((v, i) =>
      v.socket
        .timeout(10_000)
        .emitWithAck('send-message', { content: `yeni ${i}`, clientMessageId: `c_q_${i}` })
    )
  );
  assert.equal(replies.filter((r: any) => r.ok).length, 3, JSON.stringify(replies));
  for (const refused of replies.filter((r: any) => !r.ok)) {
    assert.equal(refused.code, 'QUOTA_EXCEEDED');
    assert.doesNotMatch(String(refused.message), /plan|billing|ödeme|upgrade/i);
  }
  const usage = await query(
    `SELECT conversations FROM organization_usage_monthly WHERE organization_id = $1 AND period = $2`,
    [free.organizationId, currentPeriod()]
  );
  assert.equal(usage.rows[0].conversations, limit);

  // The conversation that was already open keeps going.
  const more = await regular.socket
    .timeout(10_000)
    .emitWithAck('send-message', { content: 'devam', clientMessageId: 'c_q_more' });
  assert.equal(more.ok, true);
});

test('the owner is mailed once when 80% of the quota is used', async () => {
  const free = await tenant('FREE');
  const limit = PLAN_LIMITS.FREE.monthlyConversations;
  const line = Math.ceil(limit * 0.8);
  await query(
    `INSERT INTO organization_usage_monthly (organization_id, period, conversations)
     VALUES ($1, $2, $3)
     ON CONFLICT (organization_id, period) DO UPDATE SET conversations = $3`,
    [free.organizationId, currentPeriod(), line - 2]
  );
  for (let i = 0; i < 3; i++) {
    // eslint-disable-next-line no-await-in-loop
    const v = await joinAsVisitor(free.site.siteKey);
    sockets.push(v.socket);
    // eslint-disable-next-line no-await-in-loop
    const r = await v.socket
      .timeout(10_000)
      .emitWithAck('send-message', { content: 'merhaba', clientMessageId: `c_w_${i}` });
    assert.equal(r.ok, true);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
  const warnings = (await outbox(free.email)).filter((m) => /%80|80%/.test(m.subject));
  assert.equal(warnings.length, 1);
});

test('paid features answer PLAN_UPGRADE_REQUIRED on the free plan', async () => {
  const free = await tenant('FREE');
  const checks: Array<[string, string, unknown]> = [
    ['POST', '/api/departments', { name: 'Satış', siteId: free.site._id }],
    [
      'POST',
      '/api/automation-rules',
      { siteId: free.site._id, name: 'r', triggerType: 'message_received', actions: [] }
    ],
    ['POST', '/api/proactive-rules', { siteId: free.site._id, name: 'p' }],
    ['GET', '/api/deals', undefined],
    ['GET', `/api/visitors/site/${free.site._id}`, undefined],
    ['GET', '/api/audit', undefined]
  ];
  for (const [method, path, body] of checks) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api(path, { method, token: free.token, body });
    assert.equal(res.status, 403, `${method} ${path} answered ${res.status}`);
    assert.equal(res.body.code, 'PLAN_UPGRADE_REQUIRED', `${method} ${path}`);
  }
  // Reading departments stays open.
  assert.equal(
    (await api(`/api/departments/site/${free.site._id}`, { token: free.token })).status,
    200
  );

  const pro = await tenant('PRO');
  const dept = await api('/api/departments', {
    method: 'POST',
    token: pro.token,
    body: { name: 'Satış', siteId: pro.site._id }
  });
  assert.ok(dept.status === 200 || dept.status === 201, JSON.stringify(dept.body));
});

test('the free widget says where it comes from; a paid one need not', async () => {
  const free = await tenant('FREE');
  const pro = await tenant('PRO');
  assert.equal((await widgetSession(free.site.siteKey)).body.branding, true);
  assert.equal((await widgetSession(pro.site.siteKey)).body.branding, false);
});
