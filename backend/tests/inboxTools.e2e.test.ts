'use strict';

// The inbox tools of plan v10 PRD-07: tags, snoozing, merging two
// conversations of one visitor, bulk moves and word search with Turkish
// stemming. Each is held to the rules of the single routes it builds on —
// tenant filter, role, the read-only site — and to what the visitor's
// widget sees afterwards.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { wakeSnoozed } from '../src/services/slaSweeper';
import { call, conversationOf, tenant, twoTenants } from './helpers/idor';
import { joinAsVisitor, LOCAL_ORIGIN } from './helpers/widget';
import type { Tenant } from './helpers/idor';
import type { Socket } from 'socket.io-client';

const sockets: Socket[] = [];

test.after(async () => {
  for (const socket of sockets) socket.disconnect();
  await closeRedisClient();
  await getPool().end();
});

const json = (res: { text: string }) => JSON.parse(res.text);

async function inbox(t: Tenant, qs = '') {
  const res = await call(t.token, `/api/conversations/${t.site._id}${qs}`);
  assert.equal(res.status, 200, res.text);
  return json(res) as { conversations: Array<{ _id: string }>; counts?: Record<string, number> };
}

const ids = (list: { conversations: Array<{ _id: string }> }) =>
  list.conversations.map((c) => String(c._id));

/** A conversation of a given visitor, with one visitor message, written directly. */
async function conversationFor(t: Tenant, visitorId: string, content: string): Promise<string> {
  const id = generateId();
  await query(
    `INSERT INTO conversations (id, site_id, organization_id, visitor_id, visitor_name, status,
                                last_message_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'Ziyaretçi', 'open', now(), now(), now())`,
    [id, t.site._id, t.organizationId, visitorId]
  );
  await query(
    `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, content,
                           message_type, created_at, updated_at)
     VALUES ($1, $2, 'visitor', $4, 'Ziyaretçi', $3, 'text', now(), now())`,
    [generateId(), id, content, visitorId]
  );
  return id;
}

async function auditRows(organizationId: string, action: string): Promise<any[]> {
  // Audit rows are written by an event listener, just after the response.
  for (let i = 0; i < 20; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await query(
      'SELECT entity_id, metadata FROM audit_logs WHERE organization_id = $1 AND action = $2',
      [organizationId, action]
    );
    if (rows.length) return rows;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

test('tags: one list per workspace, on conversations, in the filter, renamed and deleted', async () => {
  const t = await tenant('tags');
  const first = await conversationOf(t, 'Kargo nerede?');
  const second = await conversationOf(t, 'Fatura istiyorum');

  const created = await call(t.token, '/api/conversation-tags', 'POST', {
    name: 'Kargo',
    color: '#10b981'
  });
  assert.equal(created.status, 201, created.text);
  assert.equal(json(created).tag.color, '#10B981');
  // The same name in another case is the same tag.
  const again = await call(t.token, '/api/conversation-tags', 'POST', { name: 'kargo' });
  assert.equal(again.status, 200, again.text);
  assert.equal(json(again).tag._id, json(created).tag._id);
  assert.equal(
    (await call(t.token, '/api/conversation-tags', 'POST', { name: '<b>' })).status,
    400
  );

  // Tagging uses the list's spelling and adds a new name to the list.
  const tagged = await call(t.token, `/api/conversations/${first}/tags`, 'PUT', {
    tags: ['kargo', 'Acil müşteri', 'KARGO']
  });
  assert.equal(tagged.status, 200, tagged.text);
  assert.deepEqual(json(tagged).conversation.tags, ['Kargo', 'Acil müşteri']);
  const catalog = json(await call(t.token, '/api/conversation-tags')).tags;
  assert.deepEqual(
    catalog.map((c: { name: string }) => c.name),
    ['Acil müşteri', 'Kargo']
  );
  const eleven = Array.from({ length: 11 }, (_, i) => `t${i}`);
  assert.equal(
    (await call(t.token, `/api/conversations/${first}/tags`, 'PUT', { tags: eleven })).status,
    400
  );

  // The filter.
  assert.deepEqual(ids(await inbox(t, '?tag=Kargo')), [first]);
  assert.ok(ids(await inbox(t)).includes(second));

  // A rename follows the conversations; a delete takes it off them.
  const kargo = json(created).tag._id;
  const renamed = await call(t.token, `/api/conversation-tags/${kargo}`, 'PUT', {
    name: 'Teslimat'
  });
  assert.equal(renamed.status, 200, renamed.text);
  assert.deepEqual(ids(await inbox(t, '?tag=Teslimat')), [first]);
  assert.equal((await inbox(t, '?tag=Kargo')).conversations.length, 0);
  const acil = catalog.find((c: { name: string }) => c.name === 'Acil müşteri')._id;
  const clash = await call(t.token, `/api/conversation-tags/${acil}`, 'PUT', { name: 'teslimat' });
  assert.equal(clash.status, 409);
  assert.equal((await call(t.token, `/api/conversation-tags/${kargo}`, 'DELETE')).status, 204);
  const { rows } = await query<{ tags: string[] }>('SELECT tags FROM conversations WHERE id = $1', [
    first
  ]);
  assert.deepEqual(rows[0].tags, ['Acil müşteri']);
});

test('snooze: out of the inbox until its time, back by the sweep or a new visitor message', async () => {
  const t = await tenant('snooze');
  const visitor = await joinAsVisitor(t.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const sent = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Yarın tekrar yazacağım',
    clientMessageId: `c-${generateId()}`
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const id = String(sent.message.conversationId);
  const other = await conversationOf(t);

  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  assert.equal(
    (await call(t.token, `/api/conversations/${id}/snooze`, 'PUT', { until: '2020-01-01' })).status,
    400,
    'a time in the past'
  );
  const snoozed = await call(t.token, `/api/conversations/${id}/snooze`, 'PUT', {
    until: tomorrow
  });
  assert.equal(snoozed.status, 200, snoozed.text);

  const list = await inbox(t);
  assert.ok(!ids(list).includes(id), 'a snoozed conversation is not in the inbox');
  assert.ok(ids(list).includes(other));
  assert.equal(list.counts?.snoozed, 1);
  assert.equal(list.counts?.open, 1, 'the status counts leave it out');
  assert.deepEqual(ids(await inbox(t, '?view=snoozed')), [id]);

  // The visitor writes again: it is back at once.
  const more = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Aslında şimdi sorayım',
    clientMessageId: `c-${generateId()}`
  });
  assert.equal(more.ok, true);
  assert.ok(ids(await inbox(t)).includes(id));

  // Its time comes: the sweep brings it back.
  await call(t.token, `/api/conversations/${other}/snooze`, 'PUT', { until: tomorrow });
  await query(
    `UPDATE conversations SET snoozed_until = now() - interval '1 minute' WHERE id = $1`,
    [other]
  );
  assert.ok((await wakeSnoozed(null)) >= 1);
  const { rows } = await query('SELECT snoozed_until FROM conversations WHERE id = $1', [other]);
  assert.equal(rows[0].snoozed_until, null);

  // A closed conversation is not snoozed.
  await call(t.token, `/api/conversations/${other}/status`, 'PUT', { status: 'closed' });
  const closed = await call(t.token, `/api/conversations/${other}/snooze`, 'PUT', {
    until: tomorrow
  });
  assert.equal(closed.status, 409);
});

test("merge: one visitor's two conversations become one, and the widget follows", async () => {
  const t = await tenant('merge');
  const visitor = await joinAsVisitor(t.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const sent = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'İlk konuşmadaki soru',
    clientMessageId: `c-${generateId()}`
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const source = String(sent.message.conversationId);
  const target = await conversationFor(t, visitor.visitorId, 'Önceki konuşmadaki soru');
  const stranger = await conversationOf(t, 'Başka bir ziyaretçi');

  const candidates = await call(
    t.token,
    `/api/conversations/${t.site._id}/${source}/merge-candidates`
  );
  assert.equal(candidates.status, 200, candidates.text);
  assert.deepEqual(
    json(candidates).conversations.map((c: { _id: string }) => c._id),
    [target],
    'only the same visitor'
  );

  const refused = await call(t.token, `/api/conversations/${source}/merge`, 'POST', {
    intoId: stranger
  });
  assert.equal(refused.status, 400);
  assert.equal(json(refused).code, 'NOT_SAME_VISITOR');

  const merged = await call(t.token, `/api/conversations/${source}/merge`, 'POST', {
    intoId: target
  });
  assert.equal(merged.status, 200, merged.text);

  const { rows: messages } = await query<{ conversation_id: string; content: string }>(
    `SELECT conversation_id, content FROM messages WHERE conversation_id = ANY($1)
      ORDER BY created_at`,
    [[source, target]]
  );
  assert.equal(messages.length, 2);
  assert.ok(messages.every((m) => m.conversation_id === target));
  const { rows: closed } = await query(
    'SELECT status, merged_into_id FROM conversations WHERE id = $1',
    [source]
  );
  assert.equal(closed[0].status, 'closed');
  assert.equal(closed[0].merged_into_id, target);
  assert.equal((await auditRows(t.organizationId, 'CONVERSATIONS_MERGED')).length, 1);

  const twice = await call(t.token, `/api/conversations/${source}/merge`, 'POST', {
    intoId: target
  });
  assert.equal(twice.status, 409);

  // The visitor's widget is still on the closed conversation; its next
  // message lands in the merged one.
  const after = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Birleştikten sonra',
    clientMessageId: `c-${generateId()}`
  });
  assert.equal(after.ok, true, JSON.stringify(after));
  assert.equal(String(after.message.conversationId), target);
});

test('bulk: the same move on many, each by its own rules', async () => {
  const { a, b } = await twoTenants();
  const one = await conversationOf(a);
  const two = await conversationOf(a);
  const theirs = await conversationOf(b);

  const resolved = await call(a.token, '/api/conversations/bulk', 'POST', {
    action: 'status',
    status: 'resolved',
    conversationIds: [one, two, theirs]
  });
  assert.equal(resolved.status, 200, resolved.text);
  const body = json(resolved);
  assert.equal(body.changed, 2);
  assert.deepEqual(
    body.results.find((r: { id: string }) => r.id === theirs),
    { id: theirs, ok: false, code: 'NOT_FOUND' }
  );
  const { rows } = await query<{ id: string; status: string }>(
    'SELECT id, status FROM conversations WHERE id = ANY($1)',
    [[one, two, theirs]]
  );
  const status = Object.fromEntries(rows.map((r) => [r.id, r.status]));
  assert.equal(status[one], 'resolved');
  assert.equal(status[two], 'resolved');
  assert.equal(status[theirs], 'open', "the other workspace's conversation is untouched");

  const tagged = await call(a.token, '/api/conversations/bulk', 'POST', {
    action: 'tag',
    tag: 'Toplu',
    conversationIds: [one, two]
  });
  assert.equal(json(tagged).changed, 2);
  assert.equal((await inbox(a, '?tag=Toplu')).conversations.length, 2);

  for (const bad of [
    { action: 'delete', conversationIds: [one] },
    { action: 'status', status: 'nope', conversationIds: [one] },
    { action: 'tag', conversationIds: [one] },
    { action: 'status', status: 'closed', conversationIds: [] },
    {
      action: 'status',
      status: 'closed',
      conversationIds: Array.from({ length: 101 }, () => generateId())
    }
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const res = await call(a.token, '/api/conversations/bulk', 'POST', bad);
    assert.equal(res.status, 400, JSON.stringify(bad));
  }
});

test('search finds words in other forms (Turkish stemming)', async () => {
  const t = await tenant('fts');
  const found = await conversationOf(t, 'Siparişim hâlâ gelmedi, kargom nerede?');
  await conversationOf(t, 'Fatura adresimi değiştirmek istiyorum');

  // Neither text is a substring of the message; both are its words.
  for (const term of ['siparişler', 'kargolarım']) {
    // eslint-disable-next-line no-await-in-loop
    const list = await inbox(t, `?search=${encodeURIComponent(term)}`);
    assert.deepEqual(ids(list), [found], term);
  }
  // Search syntax a person types (an open quote, a minus, 'or') is not an error;
  // inbox() asserts the 200.
  await inbox(t, `?search=${encodeURIComponent('"kargo -fatura or')}`);
  await inbox(t, `?search=${encodeURIComponent('kargo & | ! :*')}`);
});

test('a site over the plan limit is read-only in the inbox REST routes too', async () => {
  const t = await tenant('held');
  const id = await conversationOf(t);
  await query('UPDATE sites SET suspended_at = now() WHERE id = $1', [t.site._id]);
  try {
    for (const [method, path, body] of [
      ['PUT', `/api/conversations/${id}/status`, { status: 'resolved' }],
      ['PUT', `/api/conversations/${id}/tags`, { tags: ['x'] }],
      ['POST', `/api/conversations/${id}/notes`, { note: 'not now' }]
    ] as const) {
      // eslint-disable-next-line no-await-in-loop
      const res = await call(t.token, path, method, body);
      assert.equal(res.status, 403, `${method} ${path}`);
      assert.equal(JSON.parse(res.text).code, 'SITE_SUSPENDED');
    }
    // Reading still works.
    assert.equal((await call(t.token, `/api/conversations/${t.site._id}/${id}`)).status, 200);
  } finally {
    await query('UPDATE sites SET suspended_at = NULL WHERE id = $1', [t.site._id]);
  }
});
