'use strict';

// Blocking a visitor and spam protection (plan v10 SEC-09):
//
//  - an agent blocks the visitor of a conversation: their open widget hears
//    it and is disconnected; their session, socket and widget endpoints are
//    refused with VISITOR_BLOCKED; a fresh browser from the same address is
//    refused too; the refusal still carries the widget's look
//  - another workspace can neither block that conversation nor lift the block
//  - lifting the block lets the visitor back in; both steps are audited
//  - more than three links, or the same text a third time, tags the
//    conversation "spam"
//  - with spam mode on, a visitor nobody has answered yet writes three
//    messages a minute and one link every five minutes; an answer lifts it
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { connect } from 'socket.io-client';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import {
  BASE,
  connected,
  joinAsVisitor,
  LOCAL_ORIGIN,
  widgetSession,
  widgetSocket
} from './helpers/widget';
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

function sessionCookie(res: { headers: Headers }): string {
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

async function api(
  path: string,
  {
    method = 'GET',
    token,
    body,
    headers = {}
  }: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, body: json };
}

async function tenant() {
  const email = `owner${stamp()}@blocks.test`;
  const reg = await signUp({ name: 'Block Owner', email, password: 'E2ePassw0rd!' });
  const token = sessionCookie(reg);
  const site = await api('/api/sites', {
    method: 'POST',
    token,
    body: { name: `Shop ${stamp()}`, domain: `b${stamp()}.example` }
  });
  assert.equal(site.status, 201);
  return { email, token, site: site.body.site };
}

const ack = (socket: Socket, event: string, payload: unknown): Promise<any> =>
  socket.timeout(10_000).emitWithAck(event, payload);

function adminSocket(token: string): Promise<Socket> {
  const socket = connect(`${BASE}/admin`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token }
  });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

const send = (socket: Socket, content: string) =>
  ack(socket, 'send-message', { content, clientMessageId: `c-${stamp()}` });

async function auditRows(organizationId: string, action: string): Promise<any[]> {
  // Audit rows are written by an event listener, just after the response.
  for (let i = 0; i < 20; i += 1) {
    const { rows } = await query(
      'SELECT entity_id, metadata FROM audit_logs WHERE organization_id = $1 AND action = $2',
      [organizationId, action]
    );
    if (rows.length) return rows;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

async function tagsOf(conversationId: string): Promise<string[]> {
  const { rows } = await query('SELECT tags FROM conversations WHERE id = $1', [conversationId]);
  return rows[0].tags;
}

test('a blocked visitor is shut out by id and by address, until the block is lifted', async () => {
  const shop = await tenant();
  const visitor = await joinAsVisitor(shop.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const opened = await send(visitor.socket, 'Bedava kupon için tıkla');
  assert.equal(opened.ok, true, JSON.stringify(opened));
  const conversationId = String(opened.message.conversationId);

  // Another workspace cannot block somebody else's visitor.
  const other = await tenant();
  const foreign = await api('/api/visitors/block', {
    method: 'POST',
    token: other.token,
    body: { conversationId }
  });
  assert.equal(foreign.status, 404);

  const bad = await api('/api/visitors/block', {
    method: 'POST',
    token: shop.token,
    body: { conversationId, days: 0 }
  });
  assert.equal(bad.status, 400);

  const told = new Promise((resolve) => visitor.socket.once('visitor-blocked', resolve));
  const gone = new Promise((resolve) => visitor.socket.once('disconnect', resolve));
  const blocked = await api('/api/visitors/block', {
    method: 'POST',
    token: shop.token,
    body: { conversationId, reason: 'Kupon spamı' }
  });
  assert.equal(blocked.status, 201, JSON.stringify(blocked.body));
  assert.equal(blocked.body.days, 30);
  await told;
  await gone;

  // The same browser: no session, but the widget's look comes along.
  const again = await widgetSession(shop.site.siteKey, { token: visitor.token });
  assert.equal(again.status, 403);
  assert.equal(again.body.code, 'VISITOR_BLOCKED');
  assert.ok(again.body.details?.config?.branding, 'the refusal carries the widget config');
  assert.equal(again.body.token, undefined);

  // A fresh browser from the same address.
  const fresh = await widgetSession(shop.site.siteKey);
  assert.equal(fresh.status, 403);
  assert.equal(fresh.body.code, 'VISITOR_BLOCKED');

  // The session the page still holds no longer opens a socket…
  const socket = widgetSocket(visitor.token);
  sockets.push(socket);
  await assert.rejects(connected(socket), /VISITOR_BLOCKED/);

  // …nor reaches the widget endpoints.
  const installed = await api('/api/widget/installed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${visitor.token}`, Origin: LOCAL_ORIGIN },
    body: { url: 'http://localhost:3001/' }
  });
  assert.equal(installed.status, 403);
  assert.equal(installed.body.code, 'VISITOR_BLOCKED');

  // Another site of another workspace is not affected.
  const elsewhere = await widgetSession(other.site.siteKey);
  assert.equal(elsewhere.status, 200);

  const stored = await query(
    'SELECT visitor_id, ip_hash, reason, expires_at FROM visitor_blocks WHERE id = $1',
    [blocked.body.id]
  );
  assert.equal(stored.rows[0].visitor_id, visitor.visitorId);
  assert.match(stored.rows[0].ip_hash, /^[0-9a-f]{32}$/, 'only a hash of the address');
  assert.equal(stored.rows[0].reason, 'Kupon spamı');
  const days = (new Date(stored.rows[0].expires_at).getTime() - Date.now()) / 86_400_000;
  assert.ok(days > 29.9 && days <= 30, `30 days, got ${days}`);

  const audited = await auditRows(String(shop.site.organizationId), 'VISITOR_BLOCKED');
  assert.equal(audited.length, 1);
  assert.equal(audited[0].metadata.conversationId, conversationId);

  const list = await api(`/api/visitors/blocks/${shop.site._id}`, { token: shop.token });
  assert.equal(list.status, 200);
  assert.equal(list.body.blocks.length, 1);
  assert.equal(list.body.blocks[0]._id, blocked.body.id);
  const foreignList = await api(`/api/visitors/blocks/${shop.site._id}`, { token: other.token });
  assert.equal(foreignList.status, 404);

  // Only the workspace that blocked can lift it.
  const foreignLift = await api(`/api/visitors/blocks/${blocked.body.id}`, {
    method: 'DELETE',
    token: other.token
  });
  assert.equal(foreignLift.status, 404);
  const lifted = await api(`/api/visitors/blocks/${blocked.body.id}`, {
    method: 'DELETE',
    token: shop.token
  });
  assert.equal(lifted.status, 200);
  assert.equal((await auditRows(String(shop.site.organizationId), 'VISITOR_UNBLOCKED')).length, 1);

  const back = await widgetSession(shop.site.siteKey, { token: visitor.token });
  assert.equal(back.status, 200);
  assert.equal(back.body.visitorId, visitor.visitorId);
});

test('many links, or the same text a third time, tag the conversation "spam"', async () => {
  const shop = await tenant();

  const links = await joinAsVisitor(shop.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(links.socket);
  const first = await send(links.socket, 'Merhaba, bir sorum var');
  const linkConversation = String(first.message.conversationId);
  assert.deepEqual(await tagsOf(linkConversation), []);
  const three = await send(links.socket, 'https://a.example https://b.example www.c.example');
  assert.equal(three.ok, true);
  assert.deepEqual(await tagsOf(linkConversation), [], 'three links are fine');
  await send(
    links.socket,
    'https://a.example https://b.example https://c.example https://d.example'
  );
  assert.deepEqual(await tagsOf(linkConversation), ['spam']);

  const repeat = await joinAsVisitor(shop.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(repeat.socket);
  const once = await send(repeat.socket, 'Ucuz takipçi al');
  const repeatConversation = String(once.message.conversationId);
  await send(repeat.socket, 'Ucuz takipçi al');
  assert.deepEqual(await tagsOf(repeatConversation), [], 'twice is not yet spam');
  await send(repeat.socket, 'Ucuz takipçi al');
  assert.deepEqual(await tagsOf(repeatConversation), ['spam']);
});

test('spam mode slows a visitor nobody has answered, until somebody does', async () => {
  const shop = await tenant();
  const on = await api(`/api/sites/${shop.site._id}/chat-settings`, {
    method: 'PUT',
    token: shop.token,
    body: { spamMode: true }
  });
  assert.equal(on.status, 200, JSON.stringify(on.body));
  assert.equal(on.body.settings.spamMode, true);

  const visitor = await joinAsVisitor(shop.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const first = await send(visitor.socket, 'Fiyat listesi: https://shop.example/fiyat');
  assert.equal(first.ok, true, JSON.stringify(first));
  const conversationId = String(first.message.conversationId);

  // A second link waits five minutes.
  const link = await send(visitor.socket, 'Bir de şuna bakın https://shop.example/x');
  assert.equal(link.ok, false);
  assert.equal(link.code, 'SLOW_DOWN');
  // Three messages a minute, the refused one counted.
  const third = await send(visitor.socket, 'Orada mısınız?');
  assert.equal(third.ok, true, JSON.stringify(third));
  const fourth = await send(visitor.socket, 'Merhaba?');
  assert.equal(fourth.code, 'SLOW_DOWN');

  // An agent answers: from now on the visitor writes at the normal pace.
  const agent = await adminSocket(shop.token);
  const reply = await ack(agent, 'send-message', {
    conversationId,
    content: 'Buradayım, nasıl yardımcı olabilirim?',
    clientMessageId: crypto.randomUUID()
  });
  assert.equal(reply.ok, true, JSON.stringify(reply));
  const after = await send(visitor.socket, 'Şu ürün: https://shop.example/y');
  assert.equal(after.ok, true, JSON.stringify(after));
});
