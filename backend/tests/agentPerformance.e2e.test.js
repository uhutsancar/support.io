'use strict';

// Cover for GET /api/team/me/performance.
//
// The admin panel's "My performance" page used to generate every figure with
// Math.random() in the browser. These tests pin the replacement to real rows:
// conversations are written directly to PostgreSQL, then the endpoint is asked
// for the numbers and must agree with what was written.
//
// Requires a running backend. Run with: npm test

require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const { query } = require('../src/db/pool');
const { generateId } = require('../src/db/objectId');
const Conversation = require('../src/models/Conversation');

const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* empty body */ }
  return { status: res.status, body: json };
}

async function createTenant(label) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: `${label} owner`,
      email: `${label}${stamp}@perf.test`,
      password: 'E2ePassw0rd!',
      companyName: `${label} co`
    }
  });
  assert.ok(reg.status === 200 || reg.status === 201, `register failed: ${JSON.stringify(reg)}`);

  const site = await api('/api/sites', {
    method: 'POST',
    token: reg.body.token,
    body: { name: `${label} site`, domain: `${label}${stamp}.test` }
  });
  assert.equal(site.status, 201);

  // /api/auth/register answers with `user.id` while /api/sites answers with
  // `site._id`; both spellings are accepted here so the test does not depend on
  // that inconsistency being fixed.
  const user = reg.body.user;
  return { token: reg.body.token, userId: user._id || user.id, site: site.body.site };
}

// Writes a conversation straight to the database so the test controls exactly
// the timings and outcomes the aggregate is computed from.
async function seedConversation({ site, agentId, ageHours, status, firstResponseMinutes, ratingScore, slaStatus }) {
  const id = generateId();
  // Reuses the application's atomic counter so seeded rows never collide with
  // ticket numbers handed out by the running server.
  const ticketNumber = await Conversation.nextTicketNumber();
  const createdAt = new Date(Date.now() - ageHours * 3600 * 1000);
  const firstResponseAt = firstResponseMinutes === null
    ? null
    : new Date(createdAt.getTime() + firstResponseMinutes * 60 * 1000);

  await query(
    `INSERT INTO conversations
       (id, ticket_number, ticket_id, site_id, organization_id, visitor_id, visitor_name,
        assigned_agent_id, status, priority, sla, rating, channel, current_page,
        metadata, tags, last_message_at, first_response_at, resolved_at, created_at, updated_at)
     VALUES ($1, $13, $2, $3, $4, $5, 'Perf Visitor',
             $6, $7, 'normal', $8::jsonb, $9::jsonb, 'web-chat', '/',
             '{}'::jsonb, '{}', $10, $11, $12, $10, $10)`,
    [
      id,
      `#${String(ticketNumber).padStart(4, '0')}`,
      site._id,
      site.organizationId,
      `perf-${id}`,
      agentId,
      status,
      JSON.stringify({
        firstResponseTarget: 15,
        resolutionTarget: 240,
        firstResponseStatus: slaStatus,
        resolutionStatus: 'pending'
      }),
      JSON.stringify({ score: ratingScore, feedback: null, ratedAt: ratingScore ? new Date() : null }),
      createdAt,
      firstResponseAt,
      ['resolved', 'closed'].includes(status) ? createdAt : null,
      ticketNumber
    ]
  );
  return id;
}

test('performance endpoint reports figures derived from real conversations', async (t) => {
  const tenant = await createTenant('perf');
  const agentId = tenant.userId;

  // Four conversations inside the 7 day window with known outcomes:
  //   two resolved, first responses of 10 and 20 minutes, ratings 5 and 3,
  //   one SLA met / one breached, plus one still open.
  const ids = [];
  ids.push(await seedConversation({ site: tenant.site, agentId, ageHours: 24, status: 'resolved', firstResponseMinutes: 10, ratingScore: 5, slaStatus: 'met' }));
  ids.push(await seedConversation({ site: tenant.site, agentId, ageHours: 48, status: 'closed', firstResponseMinutes: 20, ratingScore: 3, slaStatus: 'breached' }));
  ids.push(await seedConversation({ site: tenant.site, agentId, ageHours: 12, status: 'assigned', firstResponseMinutes: null, ratingScore: null, slaStatus: 'pending' }));
  // Outside the window, so it must not affect the 7 day numbers.
  ids.push(await seedConversation({ site: tenant.site, agentId, ageHours: 24 * 40, status: 'resolved', firstResponseMinutes: 90, ratingScore: 1, slaStatus: 'breached' }));

  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = ANY($1)', [ids]);
  });

  const res = await api('/api/team/me/performance?range=7d', { token: tenant.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const p = res.body.performance;

  // Two of the three in-window conversations reached a terminal state.
  assert.equal(p.totalResolved, 2);

  // Mean of 10 and 20 minutes; the unanswered one is excluded, not counted as 0.
  assert.equal(p.avgResponseTime, 15);

  // Mean of 5 and 3.
  assert.equal(p.csatScore, 4);

  // One met out of two decided; the pending one is not counted either way.
  assert.equal(p.slaCompliance, 50);

  // Live workload ignores the window.
  assert.equal(p.activeChats, 1);

  // One point per day across the window, inclusive of both ends.
  assert.equal(p.dailyActivity.length, 8);
  assert.equal(p.responseTrend.length, 8);
  const totalAssigned = p.dailyActivity.reduce((sum, d) => sum + d.assigned, 0);
  assert.equal(totalAssigned, 3, 'the out-of-window conversation leaked into the 7 day series');
});

test('a 90 day range includes conversations the 7 day range excludes', async (t) => {
  const tenant = await createTenant('perfwide');
  const id = await seedConversation({
    site: tenant.site,
    agentId: tenant.userId,
    ageHours: 24 * 40,
    status: 'resolved',
    firstResponseMinutes: 30,
    ratingScore: 4,
    slaStatus: 'met'
  });
  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = $1', [id]);
  });

  const week = await api('/api/team/me/performance?range=7d', { token: tenant.token });
  assert.equal(week.body.performance.totalResolved, 0);

  const quarter = await api('/api/team/me/performance?range=90d', { token: tenant.token });
  assert.equal(quarter.body.performance.totalResolved, 1);
  assert.equal(quarter.body.performance.avgResponseTime, 30);
});

test('an agent with no conversations gets nulls rather than invented numbers', async () => {
  const tenant = await createTenant('perfempty');

  const res = await api('/api/team/me/performance?range=7d', { token: tenant.token });
  assert.equal(res.status, 200);
  const p = res.body.performance;

  assert.equal(p.totalResolved, 0);
  assert.equal(p.activeChats, 0);
  // Null means "nothing to measure"; a zero here would read as perfect speed
  // and zero satisfaction, which is what the old random version implied.
  assert.equal(p.avgResponseTime, null);
  assert.equal(p.csatScore, null);
  assert.equal(p.slaCompliance, null);
});

test('the range parameter only accepts the supported windows', async () => {
  const tenant = await createTenant('perfrange');

  const bad = await api('/api/team/me/performance?range=1y', { token: tenant.token });
  assert.equal(bad.status, 400);

  // An injection attempt is rejected by the same allow-list, never interpolated.
  const injection = await api("/api/team/me/performance?range=7d'; DROP TABLE conversations; --", { token: tenant.token });
  assert.equal(injection.status, 400);

  const { rows } = await query("SELECT to_regclass('public.conversations') AS t");
  assert.ok(rows[0].t, 'conversations table must still exist');
});

test('performance requires authentication', async () => {
  const res = await api('/api/team/me/performance?range=7d');
  assert.equal(res.status, 401);
});

test.after(async () => {
  const { getPool } = require('../src/db/pool');
  await getPool().end();
});
