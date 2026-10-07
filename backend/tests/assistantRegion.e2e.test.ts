'use strict';

// The free tier's regional rule (plan v10 AI-02): while GEMINI_TIER=free, a
// visitor whose CF-IPCountry is in the EEA, Switzerland or the UK is never
// sent to the model — their conversation starts with a person — and in
// production a missing country counts the same. On the paid tier, or for a
// visitor from elsewhere, the assistant answers as usual.
//
// The socket layer runs in-process against a local mock of the model API.
//
// Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
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
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { resetBreaker } from '../src/services/assistant/gemini';
import { stopAssistant } from '../src/services/assistant';
import { resetAvailability } from '../src/services/assistant/availability';
import { regionAllowsAssistant, visitorCountry } from '../src/services/assistant/region';
import {
  newVisitorId,
  newWidgetSessionId,
  signWidgetSession,
  siteKeyVersion
} from '../src/config/tokens';

let calls = 0;
const gemini = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    calls += 1;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        candidates: [
          {
            finishReason: 'STOP',
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    answer: 'Siparişler 1-3 iş günü içinde kargoya verilir.',
                    handoff: false,
                    sources: ['s1']
                  })
                }
              ]
            }
          }
        ]
      })
    );
  });
});

const saved: Record<string, string | undefined> = {};
let server: http.Server;
let ioServer: Server;
let base: string;
let site: { _id: string; siteKey: string };
const sockets: ClientSocket[] = [];

test.before(async () => {
  await new Promise<void>((resolve) => gemini.listen(0, '127.0.0.1', resolve));
  const env = {
    GEMINI_API_KEY: 'test-key-not-a-real-one',
    GEMINI_BASE_URL: `http://127.0.0.1:${(gemini.address() as AddressInfo).port}/v1beta`,
    GEMINI_TIER: 'free',
    GEMINI_RPM: '100000',
    GEMINI_RPD: '100000',
    ASSISTANT_ENABLED: 'true'
  };
  for (const key of Object.keys(env)) saved[key] = process.env[key];
  Object.assign(process.env, env);
  resetAvailability();

  server = http.createServer();
  ioServer = new Server(server);
  new SocketHandler(ioServer);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const org = await new Organization({ name: `region-${generateId()}` }).save();
  await query(`UPDATE organizations SET plan_type = 'PRO', trial_ends_at = NULL WHERE id = $1`, [
    org._id
  ]);
  site = await new Site({
    name: 'Bölge Mağaza',
    domain: `${generateId()}.test`,
    siteKey: `rg-${generateId()}`,
    organizationId: org._id,
    assistantEnabled: true
  }).save();
  await new FAQ({
    siteId: site._id,
    question: 'Kargo ne kadar sürer?',
    answer: 'Siparişler 1-3 iş günü içinde kargoya verilir.',
    keywords: ['kargo']
  }).save();
});

test.beforeEach(() => {
  calls = 0;
  resetBreaker();
});

test.after(async () => {
  for (const s of sockets) s.disconnect();
  stopAssistant();
  await new Promise((resolve) => setTimeout(resolve, 300));
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  ioServer.close();
  server.close();
  gemini.close();
  await closeRedisClient();
  await getPool().end();
});

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A visitor whose handshake carries `country` as Cloudflare would; asks once. */
async function askFrom(country: string | null) {
  const { token } = signWidgetSession({
    siteId: String(site._id),
    visitorId: newVisitorId(),
    sid: newWidgetSessionId(),
    kv: siteKeyVersion(site.siteKey)
  });
  const socket = connect(`${base}/widget`, {
    transports: ['websocket'],
    forceNew: true,
    auth: { token },
    extraHeaders: country ? { 'CF-IPCountry': country } : {}
  });
  sockets.push(socket);
  const fromAssistant: any[] = [];
  socket.on('new-message', (data: { message: any }) => {
    if (data.message.senderId === 'assistant') fromAssistant.push(data.message);
  });
  const joined = new Promise((resolve) => socket.once('conversation-joined', resolve));
  socket.emit('join-conversation', {});
  await joined;
  const sent = await socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Kargo kaç günde gelir?',
    clientMessageId: `c-${generateId()}`
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const conversationId = String(sent.message.conversationId);
  // The assistant waits 800 ms for a second message, then calls the model.
  await sleep(2000);
  const { rows } = await query<{ owner: string }>(
    'SELECT response_owner AS owner FROM conversations WHERE id = $1',
    [conversationId]
  );
  return { fromAssistant, owner: rows[0].owner };
}

test('the rule itself', () => {
  for (const country of ['DE', 'FR', 'IE', 'NO', 'IS', 'LI', 'CH', 'GB']) {
    assert.equal(regionAllowsAssistant(country, 'free'), false, country);
    assert.equal(regionAllowsAssistant(country, 'paid'), true, country);
  }
  for (const country of ['TR', 'US', 'AZ', 'UA']) {
    assert.equal(regionAllowsAssistant(country, 'free'), true, country);
  }
  assert.equal(regionAllowsAssistant(null, 'free', true), false, 'production: no country, no call');
  assert.equal(regionAllowsAssistant(null, 'free', false), true, 'development: no header');
  assert.equal(visitorCountry('de'), 'DE');
  assert.equal(visitorCountry('XX'), null);
  assert.equal(visitorCountry('T1'), null);
  assert.equal(visitorCountry(undefined), null);
});

test('free tier: a visitor from Germany is never sent to the model', async () => {
  const { fromAssistant, owner } = await askFrom('DE');
  assert.equal(calls, 0);
  assert.equal(fromAssistant.length, 0);
  assert.equal(owner, 'human', 'the conversation starts with a person');
});

test('free tier: a visitor from Türkiye gets the assistant', async () => {
  const { fromAssistant } = await askFrom('TR');
  assert.equal(calls, 1);
  assert.equal(fromAssistant.length, 1);
  assert.match(fromAssistant[0].content, /1-3 iş günü/);
});

test('paid tier: a visitor from Germany gets the assistant too', async () => {
  process.env.GEMINI_TIER = 'paid';
  try {
    const { fromAssistant } = await askFrom('DE');
    assert.equal(calls, 1);
    assert.equal(fromAssistant.length, 1);
  } finally {
    process.env.GEMINI_TIER = 'free';
  }
});
