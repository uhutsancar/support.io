'use strict';

// End-to-end cover for the automation rule engine.
//
// The engine, its routes and its admin UI all existed before but were never
// wired together, so nothing proved the chain worked. This walks the whole
// path a real rule takes:
//
//   rule created over HTTP -> visitor sends a message over the widget socket
//   -> engine matches the rule -> actions mutate the conversation
//   -> execution log, audit row and bot reply land in PostgreSQL
//
// It also pins the tenant isolation of the rule routes, which previously
// allowed any authenticated user to read and delete another organization's
// rules.
//
// Requires a running backend (npm start) and the PostgreSQL it is configured
// against. Run with: npm test

require('dotenv').config();

const test = require('node:test');
const assert = require('node:assert/strict');
const { io } = require('socket.io-client');
const { query } = require('../src/db/pool');

const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

// Poll until `check` returns something truthy or the budget runs out. The
// engine runs detached from the socket handler on purpose, so assertions on its
// effects cannot be made synchronously after the message is sent.
async function waitFor(check, { timeoutMs = 10000, intervalMs = 200, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await check();
    if (last) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

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

// Registers a throwaway owner and gives them a site, so each run is isolated
// from whatever else is in the database.
async function createTenant(label) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${label}${stamp}@automation.test`;
  const password = 'E2ePassw0rd!';

  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: `${label} owner`, email, password, companyName: `${label} co` }
  });
  assert.ok(reg.status === 200 || reg.status === 201, `register failed: ${JSON.stringify(reg)}`);
  const token = reg.body.token;
  assert.ok(token, 'register returned no token');

  const site = await api('/api/sites', {
    method: 'POST',
    token,
    body: { name: `${label} site`, domain: `${label}${stamp}.test` }
  });
  assert.equal(site.status, 201, `site create failed: ${JSON.stringify(site)}`);

  return { token, email, site: site.body.site };
}

// Resolves only once the server has answered `conversation-joined`. The join
// handler is async and sets socket.siteId partway through, so a send-message
// emitted immediately after connecting would be handled before the socket knows
// which site it belongs to and would be dropped.
function connectVisitor(siteKey, visitorId) {
  const socket = io(`${BASE}/widget`, { transports: ['websocket'], forceNew: true });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('widget socket join timeout')), 15000);
    const fail = (err) => {
      clearTimeout(timer);
      socket.close();
      reject(err instanceof Error ? err : new Error(err?.message || String(err)));
    };

    socket.on('connect_error', fail);
    socket.on('error', fail);

    socket.on('connect', () => {
      socket.emit('join-conversation', {
        siteKey,
        visitorId,
        visitorName: 'E2E Visitor',
        currentPage: '/pricing',
        metadata: { country: 'TR' }
      });
    });

    socket.once('conversation-joined', () => {
      clearTimeout(timer);
      socket.off('error', fail);
      resolve(socket);
    });
  });
}

test('automation rule fires end to end and records its effects', async (t) => {
  const tenant = await createTenant('auto');
  const siteId = tenant.site._id;

  // A rule that both tags the conversation and replies, so one trigger proves
  // two different action types.
  const created = await api('/api/automation-rules', {
    method: 'POST',
    token: tenant.token,
    body: {
      siteId,
      name: 'Refund requests',
      triggerType: 'message_received',
      conditionOperator: 'AND',
      conditions: [{ field: 'message.content', operator: 'contains', value: 'refund' }],
      actions: [
        { type: 'add_tag', payload: { tag: 'refund' } },
        { type: 'send_message', payload: { text: 'We have received your refund request.' } }
      ],
      priority: 10,
      isActive: true
    }
  });
  assert.equal(created.status, 201, `rule create failed: ${JSON.stringify(created.body)}`);
  const ruleId = created.body._id;

  t.after(async () => {
    await api(`/api/automation-rules/${ruleId}`, { method: 'DELETE', token: tenant.token }).catch(() => {});
  });

  // Creating a rule is an audited operation.
  const ruleAudit = await waitFor(async () => {
    const { rows } = await query(
      "SELECT id FROM audit_logs WHERE action = 'AUTOMATION_RULE_CREATED' AND entity_id = $1",
      [ruleId]
    );
    return rows[0];
  }, { label: 'AUTOMATION_RULE_CREATED audit row' });
  assert.ok(ruleAudit, 'rule creation was not audited');

  const visitorId = `e2e-visitor-${Date.now()}`;
  const socket = await connectVisitor(tenant.site.siteKey, visitorId);
  t.after(() => socket.close());

  socket.emit('send-message', { content: 'Hello, I need a refund for my order', senderName: 'E2E Visitor' });

  // The conversation is created by the send-message handler itself.
  const conversation = await waitFor(async () => {
    const { rows } = await query(
      'SELECT id, tags, organization_id FROM conversations WHERE visitor_id = $1',
      [visitorId]
    );
    return rows[0];
  }, { label: 'conversation row' });

  // Action 1: the tag was applied.
  const tagged = await waitFor(async () => {
    const { rows } = await query('SELECT tags FROM conversations WHERE id = $1', [conversation.id]);
    return rows[0] && (rows[0].tags || []).includes('refund') ? rows[0] : null;
  }, { label: "conversation tagged 'refund'" });
  assert.ok(tagged.tags.includes('refund'));

  // Action 2: the automated reply was persisted as a bot message.
  const reply = await waitFor(async () => {
    const { rows } = await query(
      "SELECT content FROM messages WHERE conversation_id = $1 AND sender_type = 'bot' AND sender_id = 'automation-bot'",
      [conversation.id]
    );
    return rows[0];
  }, { label: 'automated bot reply' });
  assert.match(reply.content, /refund request/i);

  // The run was logged as a success and the rule's counters moved.
  const log = await waitFor(async () => {
    const { rows } = await query(
      'SELECT status, execution_time_ms FROM automation_logs WHERE rule_id = $1 AND target_id = $2',
      [ruleId, conversation.id]
    );
    return rows[0];
  }, { label: 'automation_logs row' });
  assert.equal(log.status, 'success');

  const { rows: metricRows } = await query('SELECT metrics FROM automation_rules WHERE id = $1', [ruleId]);
  assert.equal(metricRows[0].metrics.executionsCount, 1);
  assert.equal(metricRows[0].metrics.successCount, 1);

  // And the execution reached the audit trail.
  const execAudit = await waitFor(async () => {
    const { rows } = await query(
      "SELECT metadata FROM audit_logs WHERE action = 'AUTOMATION_EXECUTED' AND entity_id = $1",
      [conversation.id]
    );
    return rows[0];
  }, { label: 'AUTOMATION_EXECUTED audit row' });
  assert.equal(execAudit.metadata.ruleName, 'Refund requests');
});

test('a rule whose condition does not match leaves the conversation alone', async (t) => {
  const tenant = await createTenant('nomatch');

  const created = await api('/api/automation-rules', {
    method: 'POST',
    token: tenant.token,
    body: {
      siteId: tenant.site._id,
      name: 'Only refunds',
      triggerType: 'message_received',
      conditions: [{ field: 'message.content', operator: 'contains', value: 'refund' }],
      actions: [{ type: 'add_tag', payload: { tag: 'refund' } }],
      isActive: true
    }
  });
  assert.equal(created.status, 201);
  const ruleId = created.body._id;
  t.after(async () => {
    await api(`/api/automation-rules/${ruleId}`, { method: 'DELETE', token: tenant.token }).catch(() => {});
  });

  const visitorId = `e2e-nomatch-${Date.now()}`;
  const socket = await connectVisitor(tenant.site.siteKey, visitorId);
  t.after(() => socket.close());

  socket.emit('send-message', { content: 'What are your opening hours?', senderName: 'E2E Visitor' });

  const conversation = await waitFor(async () => {
    const { rows } = await query('SELECT id, tags FROM conversations WHERE visitor_id = $1', [visitorId]);
    return rows[0];
  }, { label: 'conversation row' });

  // Give the engine the same budget it would have had to act, then assert it did not.
  await new Promise((r) => setTimeout(r, 2000));

  const { rows } = await query('SELECT tags FROM conversations WHERE id = $1', [conversation.id]);
  assert.ok(!(rows[0].tags || []).includes('refund'), 'tag was applied despite a non-matching condition');

  const { rows: logs } = await query('SELECT id FROM automation_logs WHERE rule_id = $1', [ruleId]);
  assert.equal(logs.length, 0, 'a non-matching rule should not produce an execution log');
});

test('rule routes are isolated between organizations', async () => {
  const owner = await createTenant('owner');
  const intruder = await createTenant('intruder');

  const created = await api('/api/automation-rules', {
    method: 'POST',
    token: owner.token,
    body: {
      siteId: owner.site._id,
      name: 'Private rule',
      triggerType: 'message_received',
      conditions: [],
      actions: [{ type: 'add_tag', payload: { tag: 'private' } }]
    }
  });
  assert.equal(created.status, 201);
  const ruleId = created.body._id;

  // Listing another organization's site must not disclose its rules.
  const list = await api(`/api/automation-rules/${owner.site._id}`, { token: intruder.token });
  assert.equal(list.status, 404, 'intruder could list rules of a site it does not own');

  // Neither may it modify or destroy them.
  const update = await api(`/api/automation-rules/${ruleId}`, {
    method: 'PUT',
    token: intruder.token,
    body: { name: 'hijacked' }
  });
  assert.equal(update.status, 404, 'intruder could update another organization rule');

  const removed = await api(`/api/automation-rules/${ruleId}`, { method: 'DELETE', token: intruder.token });
  assert.equal(removed.status, 404, 'intruder could delete another organization rule');

  // The rule is untouched and still the owner's.
  const stillThere = await api(`/api/automation-rules/${owner.site._id}`, { token: owner.token });
  assert.equal(stillThere.status, 200);
  assert.equal(stillThere.body.length, 1);
  assert.equal(stillThere.body[0].name, 'Private rule');

  await api(`/api/automation-rules/${ruleId}`, { method: 'DELETE', token: owner.token });
});

test('a rule cannot be moved into another organization through update', async () => {
  const owner = await createTenant('mover');
  const other = await createTenant('target');

  const created = await api('/api/automation-rules', {
    method: 'POST',
    token: owner.token,
    body: {
      siteId: owner.site._id,
      name: 'Stays put',
      triggerType: 'message_received',
      conditions: [],
      actions: [{ type: 'add_tag', payload: { tag: 'x' } }]
    }
  });
  assert.equal(created.status, 201);
  const ruleId = created.body._id;

  // siteId is not an assignable field, so this is accepted but ignored.
  const update = await api(`/api/automation-rules/${ruleId}`, {
    method: 'PUT',
    token: owner.token,
    body: { siteId: other.site._id, name: 'Stays put' }
  });
  assert.equal(update.status, 200);

  const { rows } = await query('SELECT site_id FROM automation_rules WHERE id = $1', [ruleId]);
  assert.equal(rows[0].site_id, owner.site._id, 'siteId was reassignable, breaking tenant isolation');

  await api(`/api/automation-rules/${ruleId}`, { method: 'DELETE', token: owner.token });
});

test('invalid rule bodies are rejected with field level detail', async () => {
  const tenant = await createTenant('valid');

  const badTrigger = await api('/api/automation-rules', {
    method: 'POST',
    token: tenant.token,
    body: {
      siteId: tenant.site._id,
      name: 'Bad',
      triggerType: 'not_a_trigger',
      actions: [{ type: 'add_tag', payload: { tag: 'x' } }]
    }
  });
  assert.equal(badTrigger.status, 400);
  assert.match(JSON.stringify(badTrigger.body.details), /triggerType/);

  const noActions = await api('/api/automation-rules', {
    method: 'POST',
    token: tenant.token,
    body: { siteId: tenant.site._id, name: 'Bad', triggerType: 'message_received', actions: [] }
  });
  assert.equal(noActions.status, 400);

  // change_status naming a status the Conversation model rejects would only
  // fail later inside the trigger, so it is caught at write time.
  const badStatus = await api('/api/automation-rules', {
    method: 'POST',
    token: tenant.token,
    body: {
      siteId: tenant.site._id,
      name: 'Bad status',
      triggerType: 'message_received',
      actions: [{ type: 'change_status', payload: { status: 'archived' } }]
    }
  });
  assert.equal(badStatus.status, 400);
  assert.match(JSON.stringify(badStatus.body.details), /status/);
});

test.after(async () => {
  const { getPool } = require('../src/db/pool');
  await getPool().end();
});
