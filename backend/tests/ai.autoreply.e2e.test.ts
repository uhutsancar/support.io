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
async function visitor(siteKey: string): Promise<Visitor> {
  const socket = connect(`${base}/widget`, { transports: ['websocket'], forceNew: true });
  sockets.push(socket);
  const messages: any[] = [];
  socket.on('new-message', (data: { message: any }) => messages.push(data.message));
  const joined = new Promise((resolve) => socket.once('conversation-joined', resolve));
  socket.emit('join-conversation', { siteKey, visitorId: `v-${generateId()}` });
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
