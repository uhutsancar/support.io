'use strict';

// "Wrong answer" on an assistant answer (plan v10 AI-06):
//
//  - an agent of the workspace marks it; a row lands in assistant_feedback
//    and the answer carries `flagged`; the mark can be taken back
//  - another workspace, a handoff note or a visitor's message cannot be
//    marked (404)
//  - the overview counts the marked answers
//
// The assistant's answer is written straight into the database here: the
// running stack has no model to produce one.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { generateId } from '../src/db/objectId';
import { BASE, joinAsVisitor, LOCAL_ORIGIN } from './helpers/widget';
import { signUp } from './helpers/accounts';
import type { Socket } from 'socket.io-client';

const sockets: Socket[] = [];
test.after(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await closeRedisClient();
  await getPool().end();
});

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

async function api(path: string, token: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

async function tenant() {
  const reg = await signUp({
    name: 'Feedback Owner',
    email: `owner${stamp()}@feedback.test`,
    password: 'E2ePassw0rd!'
  });
  const token = decodeURIComponent(
    /(?:^|,\s*)sc_session=([^;]+)/.exec(reg.headers.get('set-cookie') || '')?.[1] || ''
  );
  const site = await api('/api/sites', token, 'POST', {
    name: `Shop ${stamp()}`,
    domain: `f${stamp()}.example`
  });
  return { token, site: site.body.site };
}

test('an agent marks an assistant answer as wrong, and can take it back', async () => {
  const shop = await tenant();
  const visitor = await joinAsVisitor(shop.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const sent = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Kargo kaç günde gelir?',
    clientMessageId: `c-${stamp()}`
  });
  const conversationId = String(sent.message.conversationId);
  const answerId = generateId();
  const handoffId = generateId();
  for (const [id, note] of [
    [answerId, { sources: ['Kargo ne kadar sürer?'], handoff: null }],
    [handoffId, { sources: [], handoff: 'no_answer' }]
  ] as const) {
    await query(
      `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, content,
                             message_type, is_read, assistant)
       VALUES ($1, $2, 'bot', 'assistant', 'Asistan', 'Bir yanıt', 'text', true, $3)`,
      [id, conversationId, JSON.stringify(note)]
    );
  }

  const other = await tenant();
  assert.equal(
    (await api('/api/assistant/feedback', other.token, 'POST', { messageId: answerId })).status,
    404,
    'another workspace cannot see it'
  );
  assert.equal(
    (await api('/api/assistant/feedback', shop.token, 'POST', { messageId: handoffId })).status,
    404,
    'a handoff note is not an answer'
  );
  assert.equal(
    (await api('/api/assistant/feedback', shop.token, 'POST', { messageId: sent.message._id }))
      .status,
    404,
    "a visitor's message is not an answer"
  );

  const marked = await api('/api/assistant/feedback', shop.token, 'POST', {
    messageId: answerId,
    note: 'Teslimat süresi yanlış'
  });
  assert.equal(marked.status, 200, JSON.stringify(marked.body));
  assert.deepEqual(marked.body, { flagged: true });
  const { rows } = await query<{ note: string; flagged: boolean }>(
    `SELECT f.note, (m.assistant->>'flagged')::boolean AS flagged
       FROM assistant_feedback f JOIN messages m ON m.id = f.message_id
      WHERE f.message_id = $1`,
    [answerId]
  );
  assert.deepEqual(rows, [{ note: 'Teslimat süresi yanlış', flagged: true }]);
  // Marking twice keeps one row.
  await api('/api/assistant/feedback', shop.token, 'POST', { messageId: answerId });
  const count = await query('SELECT 1 FROM assistant_feedback WHERE message_id = $1', [answerId]);
  assert.equal(count.rows.length, 1);

  const overview = await api('/api/assistant/overview', shop.token);
  assert.equal(overview.body.flagged, 1);

  const undone = await api(`/api/assistant/feedback/${answerId}`, shop.token, 'DELETE');
  assert.deepEqual(undone.body, { flagged: false });
  const after = await query<{ flagged: boolean }>(
    `SELECT (assistant->>'flagged')::boolean AS flagged FROM messages WHERE id = $1`,
    [answerId]
  );
  assert.equal(after.rows[0].flagged, false);
  assert.equal((await api('/api/assistant/overview', shop.token)).body.flagged, 0);
});
