'use strict';

// Message delivery that survives a bad connection (plan §6):
//
//  - a resend with the same clientMessageId is the same message, for the
//    visitor and for the agent, and the sender is told so in the ack
//  - the visitor's first messages from two tabs at once open one conversation
//  - a client that was offline catches up with `after` (socket and REST), and
//    an anchor from another conversation reads nothing of it
//  - a refused message is refused in the ack, not only on the `error` event
//  - the per-event socket budget drops what is over it
//
// Needs the running API (except the last test). Run: npm test

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { eventLimiter } from '../src/socket/limits';
import { closeRedisClient } from '../src/config/redis';
import { getPool, query } from '../src/db/pool';
import { BASE, connected, joinAsVisitor, widgetSocket } from './helpers/widget';
import { signUp } from './helpers/accounts';

interface Ack {
  ok: boolean;
  code?: string;
  message?: any;
  duplicate?: boolean;
  messages?: any[];
  hasMore?: boolean;
}

function sessionToken(res: { headers: Headers }): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : '';
}

async function createTenant(label: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const email = `${label}${stamp}@reliability.test`;
  const reg = await signUp({ name: `${label} owner`, email, password: 'E2ePassw0rd!' });
  assert.equal(reg.status, 201);
  const token = sessionToken(reg);
  const site = await fetch(`${BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `${label} site`, domain: `${label}${stamp}.example` })
  });
  assert.equal(site.status, 201);
  return { token, site: ((await site.json()) as any).site };
}

function emitWithAck(socket: Socket, event: string, payload: unknown): Promise<Ack> {
  return socket.timeout(10_000).emitWithAck(event, payload) as Promise<Ack>;
}

function adminSocket(token: string): Promise<Socket> {
  const socket = connect(`${BASE}/admin`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token }
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

const sockets: Socket[] = [];
test.after(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 300));
  // The quota in the last test opened the shared Redis client in this process.
  await closeRedisClient();
  await getPool().end();
});

test('a visitor resend with the same clientMessageId is the same message', async () => {
  const tenant = await createTenant('vdup');
  const visitor = await joinAsVisitor(tenant.site.siteKey);
  sockets.push(visitor.socket);

  const payload = { content: 'Kargom nerede?', clientMessageId: 'c_dup_visitor_1' };
  const first = await emitWithAck(visitor.socket, 'send-message', payload);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(first.message.clientMessageId, 'c_dup_visitor_1');

  const again = await emitWithAck(visitor.socket, 'send-message', payload);
  assert.equal(again.ok, true);
  assert.equal(again.duplicate, true);
  assert.equal(again.message._id, first.message._id);

  const { rows } = await query(
    'SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND client_message_id = $2',
    [first.message.conversationId, 'c_dup_visitor_1']
  );
  assert.equal(rows[0].n, 1);
});

test('an agent resend with the same clientMessageId is the same message', async () => {
  const tenant = await createTenant('adup');
  const visitor = await joinAsVisitor(tenant.site.siteKey);
  sockets.push(visitor.socket);
  const opened = await emitWithAck(visitor.socket, 'send-message', {
    content: 'Merhaba',
    clientMessageId: 'c_open_1'
  });
  const conversationId = opened.message.conversationId;

  const agent = await adminSocket(tenant.token);
  sockets.push(agent);
  const clientMessageId = crypto.randomUUID();
  const reply = { conversationId, content: 'Hemen bakıyorum', clientMessageId };

  const [a, b] = await Promise.all([
    emitWithAck(agent, 'send-message', reply),
    emitWithAck(agent, 'send-message', reply)
  ]);
  assert.equal(a.ok && b.ok, true, JSON.stringify([a, b]));
  assert.equal(a.message._id, b.message._id, 'two rows for one reply');
  assert.ok(a.duplicate || b.duplicate, 'neither answer was marked as the duplicate');

  const { rows } = await query(
    'SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND client_message_id = $2',
    [conversationId, clientMessageId]
  );
  assert.equal(rows[0].n, 1);
});

test("a visitor's first messages from two tabs open one conversation", async () => {
  const tenant = await createTenant('race');
  const tab1 = await joinAsVisitor(tenant.site.siteKey);
  // The second tab of the same browser carries the same session.
  const tab2 = widgetSocket(tab1.token);
  sockets.push(tab1.socket, tab2);
  await connected(tab2);
  await new Promise((resolve) => {
    tab2.once('conversation-joined', resolve);
    tab2.emit('join-conversation', {});
  });

  const results = await Promise.all([
    emitWithAck(tab1.socket, 'send-message', { content: 'ilk', clientMessageId: 'c_race_1' }),
    emitWithAck(tab2, 'send-message', { content: 'ikinci', clientMessageId: 'c_race_2' }),
    emitWithAck(tab1.socket, 'send-message', { content: 'üçüncü', clientMessageId: 'c_race_3' })
  ]);
  for (const r of results) assert.equal(r.ok, true, JSON.stringify(r));
  const ids = new Set(results.map((r) => String(r.message.conversationId)));
  assert.equal(ids.size, 1, `the visitor got ${ids.size} conversations`);

  const { rows } = await query(
    'SELECT count(*)::int AS n FROM conversations WHERE site_id = $1 AND visitor_id = $2',
    [tenant.site._id, tab1.visitorId]
  );
  assert.equal(rows[0].n, 1);
});

test('a refused message is refused in the acknowledgement too', async () => {
  const tenant = await createTenant('refuse');
  const visitor = await joinAsVisitor(tenant.site.siteKey);
  sockets.push(visitor.socket);

  const tooLong = await emitWithAck(visitor.socket, 'send-message', {
    content: 'x'.repeat(4001),
    clientMessageId: 'c_long'
  });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.code, 'INVALID_MESSAGE');

  const badId = await emitWithAck(visitor.socket, 'send-message', {
    content: 'hello',
    clientMessageId: 'bad id with spaces'
  });
  assert.equal(badId.ok, false);
  assert.equal(badId.code, 'INVALID_MESSAGE');

  const fits = await emitWithAck(visitor.socket, 'send-message', {
    content: 'x'.repeat(4000),
    clientMessageId: 'c_fits'
  });
  assert.equal(fits.ok, true);
});

test('a client that was offline catches up with `after`, and only in its own conversation', async () => {
  const tenant = await createTenant('catchup');
  const visitor = await joinAsVisitor(tenant.site.siteKey);
  sockets.push(visitor.socket);

  const sent: any[] = [];
  for (let i = 1; i <= 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    const ack = await emitWithAck(visitor.socket, 'send-message', {
      content: `mesaj ${i}`,
      clientMessageId: `c_catch_${i}`
    });
    sent.push(ack.message);
  }
  const conversationId = sent[0].conversationId;

  // Socket: what came after the second message.
  const page = await emitWithAck(visitor.socket, 'load-messages', { after: sent[1]._id });
  assert.equal(page.ok, true);
  assert.deepEqual(
    page.messages!.map((m: any) => m.content),
    ['mesaj 3', 'mesaj 4', 'mesaj 5']
  );
  const older = await emitWithAck(visitor.socket, 'load-messages', { before: sent[2]._id });
  assert.deepEqual(
    older.messages!.map((m: any) => m.content),
    ['mesaj 1', 'mesaj 2']
  );

  // REST, as the panel catches up.
  const res = await fetch(
    `${BASE}/api/conversations/${tenant.site._id}/${conversationId}/messages?after=${sent[3]._id}`,
    { headers: { Authorization: `Bearer ${tenant.token}` } }
  );
  assert.equal(res.status, 200);
  const body = (await res.json()) as any;
  assert.deepEqual(
    body.messages.map((m: any) => m.content),
    ['mesaj 5']
  );

  // An anchor from somebody else's conversation is ignored: the answer is
  // this conversation's newest page, never the other one's messages.
  const other = await joinAsVisitor(tenant.site.siteKey);
  sockets.push(other.socket);
  const foreign = await emitWithAck(other.socket, 'send-message', {
    content: 'başka biri',
    clientMessageId: 'c_other'
  });
  const crossed = await emitWithAck(visitor.socket, 'load-messages', {
    after: foreign.message._id
  });
  assert.ok(
    crossed.messages!.every((m: any) => String(m.conversationId) === String(conversationId)),
    "another visitor's message came back"
  );
});

test('the per-event socket budget drops what is over it', async () => {
  // In-process: the running API keeps development budgets effectively open.
  const server = http.createServer();
  const io = new Server(server);
  const limit = eventLimiter(`test-${Date.now()}`, { messages: 2, events: 100 });
  io.on('connection', (socket) => {
    limit(socket, `t:${socket.id}`);
    socket.on('send-message', (_payload, ack) => ack({ ok: true }));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const client = connect(`http://127.0.0.1:${port}`, { transports: ['websocket'] });
  try {
    await new Promise<void>((resolve) => client.once('connect', () => resolve()));
    const errors: any[] = [];
    client.on('error', (e) => errors.push(e));
    const replies: Ack[] = [];
    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-await-in-loop
      replies.push(await emitWithAck(client, 'send-message', { content: `m${i}` }));
    }
    assert.deepEqual(
      replies.map((r) => r.ok),
      [true, true, false]
    );
    assert.equal(replies[2].code, 'RATE_LIMITED');
    assert.equal(errors[0]?.code, 'RATE_LIMITED');
  } finally {
    client.disconnect();
    io.close();
    server.close();
  }
});
