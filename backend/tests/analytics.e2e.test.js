'use strict';

// Cover for GET /api/analytics/overview.
//
// The admin panel used to build these figures in the browser from
// GET /api/conversations/:siteId, which is hard capped at 50 rows. Any tenant
// past that cap saw understated charts with no indication anything was missing,
// and two tiles were hardcoded constants. These tests pin the replacement:
// the aggregate is computed server side over every matching row, it respects
// the window, and it never crosses a tenant boundary.
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
      email: `${label}${stamp}@analytics.test`,
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

  const user = reg.body.user;
  return { token: reg.body.token, userId: user._id || user.id, site: site.body.site };
}

async function seedConversation({ site, agentId = null, ageHours, status, priority = 'normal', channel = 'web-chat', firstResponseMinutes = null, ratingScore = null, slaStatus = 'pending' }) {
  const id = generateId();
  const ticketNumber = await Conversation.nextTicketNumber();
  const createdAt = new Date(Date.now() - ageHours * 3600 * 1000);
  const firstResponseAt = firstResponseMinutes === null
    ? null
    : new Date(createdAt.getTime() + firstResponseMinutes * 60 * 1000);
  const terminal = ['resolved', 'closed'].includes(status);

  await query(
    `INSERT INTO conversations
       (id, ticket_number, ticket_id, site_id, organization_id, visitor_id, visitor_name,
        assigned_agent_id, status, priority, sla, rating, channel, current_page,
        metadata, tags, last_message_at, first_response_at, resolved_at, created_at, updated_at)
     VALUES ($1, $13, $2, $3, $4, $5, 'Analytics Visitor',
             $6, $7, $14, $8::jsonb, $9::jsonb, $15, '/',
             '{}'::jsonb, '{}', $10, $11, $12, $10, $10)`,
    [
      id,
      `#${String(ticketNumber).padStart(4, '0')}`,
      site._id,
      site.organizationId,
      `analytics-${id}`,
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
      terminal ? createdAt : null,
      ticketNumber,
      priority,
      channel
    ]
  );
  return id;
}

test('the aggregate covers more rows than the conversation list endpoint returns', async (t) => {
  const tenant = await createTenant('cap');

  // 60 conversations: past the 50 row cap the old client-side aggregation hit.
  const ids = [];
  for (let i = 0; i < 60; i++) {
    ids.push(await seedConversation({
      site: tenant.site,
      ageHours: 1 + (i % 20),
      status: i % 2 === 0 ? 'resolved' : 'open',
      slaStatus: i % 2 === 0 ? 'met' : 'pending'
    }));
  }
  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = ANY($1)', [ids]);
  });

  // The list endpoint still stops at 50; that is what analytics used to read.
  const list = await api(`/api/conversations/${tenant.site._id}`, { token: tenant.token });
  assert.equal(list.status, 200);
  assert.equal(list.body.conversations.length, 50, 'list endpoint cap changed; this test assumed 50');

  const res = await api('/api/analytics/overview?range=7days', { token: tenant.token });
  assert.equal(res.status, 200, JSON.stringify(res.body));

  // The aggregate sees all 60.
  assert.equal(res.body.stats.totalConversations, 60);
  assert.equal(res.body.stats.resolvedConversations, 30);
  assert.equal(res.body.stats.openTickets, 30);
});

test('overview figures agree with the rows behind them', async (t) => {
  const tenant = await createTenant('figures');
  const ids = [];

  // Two resolved with known response times and ratings, one open and breached.
  ids.push(await seedConversation({ site: tenant.site, agentId: tenant.userId, ageHours: 5, status: 'resolved', priority: 'high', firstResponseMinutes: 10, ratingScore: 5, slaStatus: 'met' }));
  ids.push(await seedConversation({ site: tenant.site, agentId: tenant.userId, ageHours: 6, status: 'closed', priority: 'low', firstResponseMinutes: 20, ratingScore: 3, slaStatus: 'breached' }));
  ids.push(await seedConversation({ site: tenant.site, ageHours: 7, status: 'open', priority: 'urgent', slaStatus: 'breached' }));

  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = ANY($1)', [ids]);
  });

  const res = await api('/api/analytics/overview?range=7days', { token: tenant.token });
  assert.equal(res.status, 200);
  const { stats, slaCompliance, byStatus, byPriority, channelDistribution } = res.body;

  assert.equal(stats.totalConversations, 3);
  assert.equal(stats.resolvedConversations, 2);
  assert.equal(stats.openTickets, 1);
  assert.equal(stats.unassigned, 1);
  assert.equal(stats.slaBreaches, 2);
  assert.equal(stats.avgFirstResponseMinutes, 15); // mean of 10 and 20
  assert.equal(stats.csat, 4);                     // mean of 5 and 3
  assert.equal(stats.satisfaction, 80);            // 4 / 5 as a percentage
  assert.equal(stats.ratedCount, 2);

  const firstResponse = slaCompliance.find((r) => r.key === 'firstResponse');
  assert.equal(firstResponse.met, 1);
  assert.equal(firstResponse.breached, 2);

  const statusTotal = byStatus.reduce((sum, r) => sum + r.value, 0);
  assert.equal(statusTotal, 3, 'status breakdown must account for every conversation');

  const priorityTotal = byPriority.reduce((sum, r) => sum + r.value, 0);
  assert.equal(priorityTotal, 3);

  const channelTotal = channelDistribution.reduce((sum, r) => sum + r.value, 0);
  assert.equal(channelTotal, 3);
});

test('agent headcount tiles are real, not the old hardcoded 4 and 5', async (t) => {
  const tenant = await createTenant('agents');

  // Two agents, one of them online.
  const mk = async (name, status) => {
    const r = await api('/api/team', {
      method: 'POST',
      token: tenant.token,
      body: {
        name,
        email: `${name.toLowerCase()}${Date.now()}${Math.floor(Math.random() * 1000)}@analytics.test`,
        password: 'E2ePassw0rd!',
        role: 'agent',
        siteIds: [tenant.site._id]
      }
    });
    assert.ok(r.status === 200 || r.status === 201, `team create failed: ${JSON.stringify(r.body)}`);
    const created = r.body.teamMember || r.body.member || r.body.user || r.body;
    const id = created._id || created.id;
    if (status !== 'offline') {
      await query('UPDATE teams SET status = $2 WHERE id = $1', [id, status]);
    }
    return id;
  };

  const onlineId = await mk('Ada', 'online');
  await mk('Bora', 'offline');

  t.after(async () => {
    await query('DELETE FROM teams WHERE organization_id = $1', [tenant.site.organizationId]);
  });

  const res = await api('/api/analytics/overview?range=7days', { token: tenant.token });
  assert.equal(res.status, 200);
  assert.equal(res.body.stats.totalAgents, 2);
  assert.equal(res.body.stats.activeAgents, 1);

  // The per-agent table lists both, including the one with no conversations.
  assert.equal(res.body.agentPerformance.length, 2);
  const ada = res.body.agentPerformance.find((a) => a._id === onlineId);
  assert.ok(ada, 'the online agent is missing from the breakdown');
  assert.equal(ada.resolved, 0);
  assert.equal(ada.rating, null, 'an unrated agent must report null, not a made-up score');
});

test('the window filter actually excludes older conversations', async (t) => {
  const tenant = await createTenant('window');
  const ids = [];
  ids.push(await seedConversation({ site: tenant.site, ageHours: 2, status: 'resolved', slaStatus: 'met' }));
  ids.push(await seedConversation({ site: tenant.site, ageHours: 24 * 20, status: 'resolved', slaStatus: 'met' }));
  ids.push(await seedConversation({ site: tenant.site, ageHours: 24 * 60, status: 'resolved', slaStatus: 'met' }));

  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = ANY($1)', [ids]);
  });

  const week = await api('/api/analytics/overview?range=7days', { token: tenant.token });
  assert.equal(week.body.stats.totalConversations, 1);
  assert.equal(week.body.dailyTickets.length, 8);

  const month = await api('/api/analytics/overview?range=30days', { token: tenant.token });
  assert.equal(month.body.stats.totalConversations, 2);
  assert.equal(month.body.dailyTickets.length, 31);

  const quarter = await api('/api/analytics/overview?range=90days', { token: tenant.token });
  assert.equal(quarter.body.stats.totalConversations, 3);
});

test('analytics never crosses a tenant boundary', async (t) => {
  const owner = await createTenant('owner');
  const intruder = await createTenant('intruder');

  const ids = [];
  for (let i = 0; i < 4; i++) {
    ids.push(await seedConversation({ site: owner.site, ageHours: 2, status: 'resolved', slaStatus: 'met' }));
  }
  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = ANY($1)', [ids]);
  });

  // The intruder's own overview must not include the owner's conversations.
  const theirs = await api('/api/analytics/overview?range=7days', { token: intruder.token });
  assert.equal(theirs.status, 200);
  assert.equal(theirs.body.stats.totalConversations, 0);

  // Nor may they scope the report to a site they do not own.
  const scoped = await api(
    `/api/analytics/overview?range=7days&siteId=${owner.site._id}`,
    { token: intruder.token }
  );
  assert.equal(scoped.status, 404);

  // The owner does see their own four.
  const mine = await api('/api/analytics/overview?range=7days', { token: owner.token });
  assert.equal(mine.body.stats.totalConversations, 4);
});

test('range is validated against an allow list', async () => {
  const tenant = await createTenant('range');

  const bad = await api('/api/analytics/overview?range=all', { token: tenant.token });
  assert.equal(bad.status, 400);

  const injection = await api("/api/analytics/overview?range=7days'; DROP TABLE conversations; --", { token: tenant.token });
  assert.equal(injection.status, 400);

  const { rows } = await query("SELECT to_regclass('public.conversations') AS t");
  assert.ok(rows[0].t, 'conversations table must still exist');
});

test('analytics requires authentication', async () => {
  const res = await api('/api/analytics/overview?range=7days');
  assert.equal(res.status, 401);
});

test.after(async () => {
  const { getPool } = require('../src/db/pool');
  await getPool().end();
});
