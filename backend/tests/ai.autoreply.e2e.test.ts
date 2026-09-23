'use strict';

// The widget's automatic answer, end to end, without a GPU.
//
// A real Socket.IO server with the real widget handlers runs inside this test
// process against the real database; only the model is replaced, by a scripted
// provider that records every call. The visitor side is socket.io-client, the
// same library the widget uses. What is pinned here is the contract the
// product makes to a customer and to an agent:
//
//   * one visitor message gets at most one automatic answer, and a resend
//     gets none;
//   * a request for a person or a card number never reaches the model;
//   * an answer the checks refuse, or a model that fails, becomes a handoff;
//   * an answer is dropped when an agent took over, the thread closed or the
//     site left auto mode while the model was writing;
//   * off and copilot sites keep the FAQ bot exactly as it was, auto sites
//     never get it.
//
// Needs PostgreSQL (DATABASE_URL); does not need the compose backend.

import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import type { Socket as ClientSocket } from 'socket.io-client';
import SocketHandler from '../src/socket';
import Organization from '../src/models/Organization';
import Site from '../src/models/Site';
import FAQ from '../src/models/FAQ';
import { AIProvider, AIError } from '../src/services/ai/provider';
import type { AICompletion, AICompletionRequest } from '../src/services/ai/provider';
import { setProvider, resetProvider } from '../src/services/ai';
import { resetAIConfig } from '../src/config/ai';
import { setResponseOwner, stopAutoReplies } from '../src/services/ai/autoReply';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { seal } from '../src/config/secretBox';
import { userHashFor } from '../src/services/identity';

// ------------------------------------------------------------------ harness

type Script = (request: AICompletionRequest) => Promise<string> | string;

/** Answers with whatever the current test scripted, and remembers the questions. */
class ScriptedProvider extends AIProvider {
  script: Script = () => reply('small_talk', 'Merhaba! Size nasıl yardımcı olabilirim?');
  calls: AICompletionRequest[] = [];

  override get name(): string {
    return 'scripted';
  }
  override get isConfigured(): boolean {
    return true;
  }
  override get model(): string {
    return 'scripted-model';
  }
  override async complete(request: AICompletionRequest): Promise<AICompletion> {
    this.calls.push(request);
    const text = await this.script(request);
    return { text, model: 'scripted-model', usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

function reply(
  decision: string,
  answer: string | null,
  extra: { sourceIds?: string[]; orderNumber?: string | null; language?: string } = {}
): string {
  return JSON.stringify({
    decision,
    answer,
    sourceIds: extra.sourceIds ?? [],
    orderNumber: extra.orderNumber ?? null,
    language: extra.language ?? 'tr'
  });
}

const provider = new ScriptedProvider();
const saved: Record<string, string | undefined> = {};
let server: http.Server;
let ioServer: Server;
let base: string;
let orgId: string;
const sockets: ClientSocket[] = [];

test.before(async () => {
  for (const key of ['AI_ENABLED', 'AI_API_KEY', 'AI_MODEL', 'AI_AUTO_REPLY_ENABLED']) {
    saved[key] = process.env[key];
  }
  Object.assign(process.env, {
    AI_ENABLED: 'true',
    AI_API_KEY: 'k'.repeat(40),
    AI_MODEL: 'scripted-model',
    AI_AUTO_REPLY_ENABLED: 'true'
  });
  resetAIConfig();
  setProvider(provider);

  server = http.createServer();
  ioServer = new Server(server);
  new SocketHandler(ioServer);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const org = await new Organization({ name: `autoreply-${Date.now()}` }).save();
  orgId = org._id;
});

test.after(async () => {
  for (const s of sockets) s.disconnect();
  // The server's disconnect handlers write to the database; let them finish
  // before the pool is closed under them.
  await sleep(400);
  stopAutoReplies();
  await new Promise<void>((resolve) => ioServer.close(() => resolve()));
  await query('DELETE FROM organizations WHERE id = $1', [orgId]);
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  resetAIConfig();
  resetProvider();
  await closeRedisClient();
  await getPool().end();
});

async function createSite(mode: 'off' | 'copilot' | 'auto') {
  const site = await new Site({
    name: 'Deneme Mağaza',
    domain: `${generateId()}.test`,
    siteKey: `ar-${generateId()}`,
    organizationId: orgId,
    aiSettings: {
      mode,
      answerLength: 'normal',
      tone: 'professional',
      maxBotReplies: 8,
      blockedTerms: [],
      botName: 'Asistan',
      handoffMessage: null
    }
  }).save();
  const faq = await new FAQ({
    siteId: site._id,
    question: 'İade koşulları nelerdir?',
    answer: 'Ürünü teslim aldıktan sonra 14 gün içinde iade edebilirsiniz.',
    keywords: ['iade']
  }).save();
  return { site, faqId: String(faq._id) };
}

interface Visitor {
  socket: ClientSocket;
  messages: any[];
  send(content: string, clientMessageId?: string): void;
  conversationId(): string;
}

/** A visitor with an open widget on the site, collecting everything it hears. */
async function visitor(
  siteKey: string,
  identity: { userId: string; userHash: string } | null = null
): Promise<Visitor> {
  const socket = connect(`${base}/widget`, { transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  const messages: any[] = [];
  socket.on('new-message', (data: { message: any }) => messages.push(data.message));
  const joined = new Promise((resolve) => socket.once('conversation-joined', resolve));
  socket.emit('join-conversation', { siteKey, visitorId: `v-${generateId()}`, ...identity });
  await joined;
  return {
    socket,
    messages,
    send(content, clientMessageId) {
      socket.emit('send-message', {
        content,
        clientMessageId: clientMessageId ?? `c-${generateId()}`
      });
    },
    conversationId() {
      const own = messages.find((m) => m.senderType === 'visitor');
      assert.ok(own, 'the visitor message was never echoed');
      return String(own.conversationId);
    }
  };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(check: () => boolean, ms = 4000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await sleep(25);
  }
}

const bots = (v: Visitor) => v.messages.filter((m) => m.senderType === 'bot');

async function owner(conversationId: string): Promise<string> {
  const { rows } = await query('SELECT response_owner FROM conversations WHERE id = $1', [
    conversationId
  ]);
  return rows[0].response_owner;
}

async function storedBotReplies(conversationId: string): Promise<any[]> {
  const { rows } = await query(
    `SELECT content, ai_metadata FROM messages
      WHERE conversation_id = $1 AND sender_type = 'bot' ORDER BY created_at`,
    [conversationId]
  );
  return rows;
}

function beforeEach(script: Script) {
  provider.calls = [];
  provider.script = script;
}

// -------------------------------------------------------------------- tests

test('small talk gets one short, warm answer from the assistant', async () => {
  beforeEach(() => reply('small_talk', 'Merhaba, iyiyim! Size nasıl yardımcı olabilirim?'));
  const { site } = await createSite('auto');
  const v = await visitor(site.siteKey);

  v.send('Selam, nasılsınız?');
  await until(() => bots(v).length === 1);
  await sleep(300);

  assert.equal(bots(v).length, 1, 'exactly one automatic answer');
  assert.equal(bots(v)[0].content, 'Merhaba, iyiyim! Size nasıl yardımcı olabilirim?');
  assert.equal(bots(v)[0].senderName, 'Asistan');
  assert.equal(provider.calls.length, 1);
  assert.equal(await owner(v.conversationId()), 'ai');

  const [stored] = await storedBotReplies(v.conversationId());
  assert.equal(stored.ai_metadata.decision, 'small_talk');
  assert.ok(stored.ai_metadata.promptVersion);
});

test('an FAQ answer cites its source, and the FAQ is what the model was given', async () => {
  const { site, faqId } = await createSite('auto');
  beforeEach((request) => {
    assert.match(request.prompt, /14 gün içinde iade/, 'the matching FAQ must be in the prompt');
    return reply('answer', 'Ürünü teslim aldıktan sonra 14 gün içinde iade edebilirsiniz.', {
      sourceIds: [faqId]
    });
  });
  const v = await visitor(site.siteKey);

  v.send('iade suresi kac gun');
  await until(() => bots(v).length === 1);

  const [stored] = await storedBotReplies(v.conversationId());
  assert.equal(stored.ai_metadata.decision, 'answer');
  assert.deepEqual(stored.ai_metadata.sourceIds, [faqId]);
  assert.deepEqual(stored.ai_metadata.sources, ['İade koşulları nelerdir?']);
});

test('an answer with a fact that is not in the sources is never sent; the visitor is handed over', async () => {
  const { site, faqId } = await createSite('auto');
  beforeEach(() => reply('answer', 'İade süreniz 30 gündür.', { sourceIds: [faqId] }));
  const v = await visitor(site.siteKey);

  v.send('İade süresi kaç gün?');
  await until(() => bots(v).length === 1);

  assert.doesNotMatch(bots(v)[0].content, /30/);
  assert.match(bots(v)[0].content, /temsilci/);
  assert.equal(await owner(v.conversationId()), 'human');
  const [stored] = await storedBotReplies(v.conversationId());
  assert.equal(stored.ai_metadata.reason, 'rejected:unsupported_fact');
});

test('a failing or busy model hands over with the fixed text', async () => {
  for (const code of ['ai_unreachable', 'ai_busy', 'ai_timeout']) {
    const { site } = await createSite('auto');
    beforeEach(() => {
      throw new AIError('down', { code });
    });
    const v = await visitor(site.siteKey);

    v.send('Kargo ne zaman gelir?');
    await until(() => bots(v).length === 1);
    assert.match(bots(v)[0].content, /otomatik yanıt veremiyorum/);
    assert.equal(await owner(v.conversationId()), 'human');
    const [stored] = await storedBotReplies(v.conversationId());
    assert.equal(stored.ai_metadata.reason, code);
  }
});

test('asking for a person or pasting a card number never reaches the model', async () => {
  for (const [text, reason] of [
    ['Temsilciyle görüşmek istiyorum', 'human_requested'],
    ['Kartım 4111 1111 1111 1111 çekim olmadı', 'sensitive_data']
  ]) {
    const { site } = await createSite('auto');
    beforeEach(() => reply('small_talk', 'should never be produced'));
    const v = await visitor(site.siteKey);

    v.send(text);
    await until(() => bots(v).length === 1);

    assert.equal(provider.calls.length, 0, `${reason}: the model was called`);
    assert.doesNotMatch(bots(v)[0].content, /4111/, 'the card number must not be repeated');
    assert.equal(await owner(v.conversationId()), 'human');
    const [stored] = await storedBotReplies(v.conversationId());
    assert.equal(stored.ai_metadata.reason, reason);
  }
});

test('a resend with the same client id is one message and one answer', async () => {
  beforeEach(() => reply('small_talk', 'Merhaba! Size nasıl yardımcı olabilirim?'));
  const { site } = await createSite('auto');
  const v = await visitor(site.siteKey);

  v.send('Merhaba', 'client-dup-1');
  await until(() => v.messages.some((m) => m.senderType === 'visitor'));
  v.send('Merhaba', 'client-dup-1');
  await until(() => bots(v).length === 1);
  await sleep(1200);

  const { rows } = await query(
    `SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1 AND sender_type = 'visitor'`,
    [v.conversationId()]
  );
  assert.equal(rows[0].n, 1, 'the resend was stored twice');
  assert.equal(bots(v).length, 1);
  assert.equal(provider.calls.length, 1);
});

test('two messages within the debounce window get one answer, to the second', async () => {
  beforeEach((request) =>
    reply('small_talk', request.prompt.includes('garanti') ? 'Tamam!' : 'Yanlış mesaj.')
  );
  const { site } = await createSite('auto');
  const v = await visitor(site.siteKey);

  v.send('selam');
  await sleep(150);
  v.send('garanti kaç yıl?');
  await until(() => bots(v).length === 1);
  await sleep(1200);

  assert.equal(bots(v).length, 1);
  assert.equal(provider.calls.length, 1);
  assert.match(provider.calls[0].prompt, /CEVAPLANACAK MESAJ: garanti kaç yıl\?/);
});

test('an answer still being written is dropped when an agent takes over, the thread closes or the site leaves auto', async () => {
  const interruptions: Array<
    [string, (conversationId: string, siteId: string) => Promise<unknown>]
  > = [
    ['takeover', (id, siteId) => setResponseOwner(ioServer, { _id: id, siteId }, 'human')],
    ['closed', (id) => query(`UPDATE conversations SET status = 'resolved' WHERE id = $1`, [id])],
    [
      'site off',
      (_id, siteId) =>
        query(`UPDATE sites SET ai_settings = ai_settings || '{"mode":"off"}' WHERE id = $1`, [
          siteId
        ])
    ]
  ];

  for (const [label, interrupt] of interruptions) {
    const { site } = await createSite('auto');
    let release!: () => void;
    const started = new Promise<void>((resolve) => (release = resolve));
    beforeEach(async () => {
      release();
      await sleep(500);
      return reply('small_talk', 'Geç kalmış cevap.');
    });
    const v = await visitor(site.siteKey);

    v.send('Merhaba');
    await started;
    await interrupt(v.conversationId(), site._id);
    await sleep(1000);

    assert.equal(bots(v).length, 0, `${label}: a stale answer reached the visitor`);
    assert.equal((await storedBotReplies(v.conversationId())).length, 0, `${label}: stored`);
  }
});

test('off and copilot sites keep the FAQ keyword bot; an auto site never gets it', async () => {
  for (const mode of ['off', 'copilot'] as const) {
    const { site } = await createSite(mode);
    beforeEach(() => reply('small_talk', 'should never be produced'));
    const v = await visitor(site.siteKey);

    v.send('iade koşulları nelerdir');
    await until(() => bots(v).length === 1);
    assert.match(bots(v)[0].content, /14 gün/, `${mode}: the FAQ bot did not answer`);
    assert.equal(bots(v)[0].senderId, 'auto-faq');
    assert.equal(provider.calls.length, 0, `${mode}: the model was called`);
    assert.equal(await owner(v.conversationId()), 'human');
  }

  const { site } = await createSite('auto');
  beforeEach(() => reply('handoff', null));
  const v = await visitor(site.siteKey);
  v.send('iade koşulları nelerdir');
  await until(() => bots(v).length === 1);
  await sleep(500);
  assert.equal(bots(v).length, 1, 'the FAQ bot answered next to the assistant');
  assert.notEqual(bots(v)[0].senderId, 'auto-faq');
});

test('an order question from a visitor who is not signed in asks them to sign in', async () => {
  const { site } = await createSite('auto');
  beforeEach(() => reply('order_lookup', null, { orderNumber: '12345' }));
  const v = await visitor(site.siteKey);

  v.send('12345 nolu siparişim nerede?');
  await until(() => bots(v).length === 1);
  assert.match(bots(v)[0].content, /giriş yapın/);
  assert.equal(await owner(v.conversationId()), 'ai', 'asking to sign in is not a handoff');
});

test('the "talk to a person" button hands over at once', async () => {
  beforeEach(() => reply('small_talk', 'Merhaba! Size nasıl yardımcı olabilirim?'));
  const { site } = await createSite('auto');
  const v = await visitor(site.siteKey);

  v.send('Merhaba');
  await until(() => bots(v).length === 1);
  v.socket.emit('request-human', { language: 'tr' });
  await until(() => bots(v).length === 2);

  assert.match(bots(v)[1].content, /temsilci/);
  assert.equal(await owner(v.conversationId()), 'human');

  // With a person in charge the assistant stays quiet.
  const calls = provider.calls.length;
  v.send('Hâlâ bekliyorum');
  await sleep(1500);
  assert.equal(bots(v).length, 2);
  assert.equal(provider.calls.length, calls);
});

// ------------------------------------------------------------ order lookup

const IDENTITY_KEY = 'i'.repeat(64);
const SIGNING_KEY = 'o'.repeat(64);

/** An auto site whose shop verifies identities and answers order lookups at `shopUrl`. */
async function createShopSite(shopUrl: string) {
  const { site } = await createSite('auto');
  site.integrations = {
    identitySecret: seal(IDENTITY_KEY),
    orderLookup: { enabled: true, url: shopUrl, signingSecret: seal(SIGNING_KEY) }
  };
  await site.save();
  return site;
}

async function fakeShop(orders: unknown[] | null) {
  const requests: any[] = [];
  const shop = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      requests.push(JSON.parse(body));
      if (!orders) {
        res.writeHead(500);
        res.end();
        return;
      }
      const wanted = JSON.parse(body).orderNumber;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          orders: orders.filter((o: any) => !wanted || o.orderNumber === wanted)
        })
      );
    });
  });
  await new Promise<void>((resolve) => shop.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(shop.address() as AddressInfo).port}/orders`;
  return { url, requests, close: () => new Promise<void>((r) => shop.close(() => r())) };
}

const SHOP_ORDER = {
  orderNumber: '12345',
  statusText: 'Kargoya verildi',
  carrier: 'Örnek Kargo',
  trackingNumber: 'TR123456789',
  estimatedDelivery: '2026-09-25',
  shippingAddress: 'Gizli Mah. 1 Sok.',
  phone: '05551112233'
};

const signedIn = () => ({
  userId: 'customer-9',
  userHash: userHashFor(IDENTITY_KEY, 'customer-9')
});

test('a signed-in customer gets their real order, and only its public fields reach the model', async (t) => {
  const shop = await fakeShop([SHOP_ORDER]);
  t.after(shop.close);
  const site = await createShopSite(shop.url);
  beforeEach((request) => {
    if (request.responseSchema?.name === 'auto_reply') {
      return reply('order_lookup', null);
    }
    assert.doesNotMatch(request.prompt, /Gizli|05551112233/, 'address or phone reached the model');
    return JSON.stringify({
      decision: 'answer',
      answer:
        'Siparişiniz Örnek Kargo ile kargoya verildi, takip numarası TR123456789. Tahmini teslim 2026-09-25.'
    });
  });
  const v = await visitor(site.siteKey, signedIn());

  v.send('Siparişim nerede?');
  await until(() => bots(v).length === 1);

  assert.match(bots(v)[0].content, /TR123456789/);
  assert.equal(provider.calls.length, 2);
  assert.deepEqual(shop.requests, [{ userId: 'customer-9', orderNumber: null }]);
  const [stored] = await storedBotReplies(v.conversationId());
  assert.equal(stored.ai_metadata.decision, 'order_answer');
  assert.ok(!JSON.stringify(stored.ai_metadata).includes('TR123456789'), 'order data in metadata');
});

test('an order number the customer does not have is "not found", never invented', async (t) => {
  const shop = await fakeShop([SHOP_ORDER]);
  t.after(shop.close);
  const site = await createShopSite(shop.url);
  beforeEach(() => reply('order_lookup', null, { orderNumber: '999999' }));
  const v = await visitor(site.siteKey, signedIn());

  v.send('999999 nolu siparişim nerede?');
  await until(() => bots(v).length === 1);
  assert.match(bots(v)[0].content, /bulamadım/);
  assert.equal(provider.calls.length, 1, 'no second model call without data');
});

test('a forged identity asks to sign in and never reaches the shop', async (t) => {
  const shop = await fakeShop([SHOP_ORDER]);
  t.after(shop.close);
  const site = await createShopSite(shop.url);
  beforeEach(() => reply('order_lookup', null));
  const v = await visitor(site.siteKey, { userId: 'customer-9', userHash: 'f'.repeat(64) });

  v.send('Siparişim nerede?');
  await until(() => bots(v).length === 1);
  assert.match(bots(v)[0].content, /giriş yapın/);
  assert.equal(shop.requests.length, 0);
});

test('an order service that fails hands over with a short note', async (t) => {
  const shop = await fakeShop(null);
  t.after(shop.close);
  const site = await createShopSite(shop.url);
  beforeEach(() => reply('order_lookup', null));
  const v = await visitor(site.siteKey, signedIn());

  v.send('Siparişim nerede?');
  await until(() => bots(v).length === 1);
  assert.match(bots(v)[0].content, /ulaşamıyorum/);
  assert.equal(await owner(v.conversationId()), 'human');
});
