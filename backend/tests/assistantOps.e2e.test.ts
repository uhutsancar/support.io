'use strict';

// Running the assistant safely (plan v10 AI-01, AI-07):
//
//  - the model is checked against the API at boot: a model the API does not
//    know, or a refused key, switches the assistant off; a preview model is
//    refused without asking; the check never sends the key in the URL
//  - the kill switch turns it off for every site and back on, through Redis,
//    and leaves an audit row
//  - a workspace gets at most a tenth of its monthly answers in one day; the
//    next question goes to a person with the reason "daily_cap"
//
// The socket layer runs in-process against a local mock of the model API,
// as in assistant.e2e.test.ts.
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
import express from 'express';
import SocketHandler from '../src/socket';
import siteRoutes from '../src/routes/sites';
// The audit trail listens for route events once this is loaded (as in server.ts).
import '../src/services/auditService';
import { errorHandler } from '../src/http';
import { signSession } from '../src/config/tokens';
import { BASE } from './helpers/widget';
import { signUp } from './helpers/accounts';
import Organization from '../src/models/Organization';
import Site from '../src/models/Site';
import FAQ from '../src/models/FAQ';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient, isEnabled as redisEnabled } from '../src/config/redis';
import { resetBreaker } from '../src/services/assistant/gemini';
import { assistantAvailable, dailyAnswerCap, stopAssistant } from '../src/services/assistant';
import {
  checkModel,
  refreshKillSwitch,
  resetAvailability,
  setKillSwitch
} from '../src/services/assistant/availability';
import {
  newVisitorId,
  newWidgetSessionId,
  signWidgetSession,
  siteKeyVersion
} from '../src/config/tokens';

// ------------------------------------------------------------ the mock API

let modelStatus = 200;
const modelChecks: Array<{ url: string; key: unknown }> = [];

function reply(obj: unknown) {
  return {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(obj) }] } }]
  };
}

const gemini = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    if (req.method === 'GET') {
      modelChecks.push({ url: req.url || '', key: req.headers['x-goog-api-key'] });
      res.writeHead(modelStatus, { 'Content-Type': 'application/json' });
      res.end(modelStatus === 200 ? '{"name":"models/x"}' : '{"error":{}}');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify(
        reply({
          answer: 'Siparişler 1-3 iş günü içinde kargoya verilir.',
          handoff: false,
          sources: ['s1']
        })
      )
    );
  });
});

const saved: Record<string, string | undefined> = {};
let server: http.Server;
let ioServer: Server;
let base: string;
const sockets: ClientSocket[] = [];

test.before(async () => {
  await new Promise<void>((resolve) => gemini.listen(0, '127.0.0.1', resolve));
  const env = {
    GEMINI_API_KEY: 'test-key-not-a-real-one',
    GEMINI_BASE_URL: `http://127.0.0.1:${(gemini.address() as AddressInfo).port}/v1beta`,
    GEMINI_MODEL: 'gemini-3.5-flash-lite',
    GEMINI_TIER: 'paid',
    GEMINI_RPM: '100000',
    GEMINI_RPD: '100000',
    ASSISTANT_ENABLED: 'true'
  };
  for (const key of [...Object.keys(env), 'ASSISTANT_KILL_SWITCH']) saved[key] = process.env[key];
  Object.assign(process.env, env);
  delete process.env.ASSISTANT_KILL_SWITCH;

  server = http.createServer();
  ioServer = new Server(server);
  new SocketHandler(ioServer);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.beforeEach(() => {
  resetAvailability();
  resetBreaker();
  modelStatus = 200;
  modelChecks.length = 0;
});

test.after(async () => {
  for (const s of sockets) s.disconnect();
  stopAssistant();
  if (redisEnabled()) await setKillSwitch(false, 'test').catch(() => undefined);
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

async function until(check: () => boolean, ms = 8000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await sleep(25);
  }
}

test('the model is checked at boot; an unknown or preview model switches it off', async () => {
  assert.equal(await checkModel(), 'ok');
  assert.equal(assistantAvailable(), true);
  assert.equal(modelChecks.length, 1);
  assert.match(modelChecks[0].url, /\/v1beta\/models\/gemini-3\.5-flash-lite$/);
  assert.equal(modelChecks[0].key, 'test-key-not-a-real-one', 'the key travels in the header');
  assert.doesNotMatch(modelChecks[0].url, /key=/);

  modelStatus = 404;
  assert.equal(await checkModel(), 'missing');
  assert.equal(assistantAvailable(), false);

  modelStatus = 403;
  assert.equal(await checkModel(), 'key_invalid');
  assert.equal(assistantAvailable(), false);

  modelStatus = 200;
  assert.equal(await checkModel(), 'ok');
  assert.equal(assistantAvailable(), true);

  process.env.GEMINI_MODEL = 'gemini-3.1-pro-preview';
  modelChecks.length = 0;
  assert.equal(await checkModel(), 'preview');
  assert.equal(modelChecks.length, 0, 'a preview model is refused without asking');
  assert.equal(assistantAvailable(), false);
  process.env.GEMINI_MODEL = 'gemini-3.5-flash-lite';

  // The environment switch needs no Redis.
  resetAvailability();
  process.env.ASSISTANT_KILL_SWITCH = 'true';
  assert.equal(assistantAvailable(), false);
  delete process.env.ASSISTANT_KILL_SWITCH;
  assert.equal(assistantAvailable(), true);
});

test(
  'the kill switch stops the assistant everywhere and is audited',
  { skip: !redisEnabled() },
  async () => {
    await setKillSwitch(true, 'e2e');
    assert.equal(await refreshKillSwitch(), true);
    assert.equal(assistantAvailable(), false);
    await setKillSwitch(false, 'e2e');
    assert.equal(await refreshKillSwitch(), false);
    assert.equal(assistantAvailable(), true);

    const { rows } = await query<{ metadata: { on: boolean; operator: string } }>(
      `SELECT metadata FROM audit_logs
      WHERE action = 'ASSISTANT_KILL_SWITCH' AND organization_id IS NULL
        AND metadata->>'operator' = 'e2e'
      ORDER BY created_at DESC LIMIT 2`
    );
    assert.deepEqual(
      rows.map((r) => r.metadata.on),
      [false, true]
    );
  }
);

test('a day may use a tenth of the month; the next question goes to a person', async () => {
  assert.equal(dailyAnswerCap(50), 5);
  assert.equal(dailyAnswerCap(1000), 100);
  assert.equal(dailyAnswerCap(3), 1);

  const org = await new Organization({ name: `daily-${generateId()}` }).save();
  await query(`UPDATE organizations SET plan_type = 'FREE', trial_ends_at = NULL WHERE id = $1`, [
    org._id
  ]);
  const site = await new Site({
    name: 'Günlük Mağaza',
    domain: `${generateId()}.test`,
    siteKey: `dc-${generateId()}`,
    organizationId: org._id,
    assistantEnabled: true
  }).save();
  await new FAQ({
    siteId: site._id,
    question: 'Kargo ne kadar sürer?',
    answer: 'Siparişler 1-3 iş günü içinde kargoya verilir.',
    keywords: ['kargo']
  }).save();

  // Free: 50 answers a month, 3 per conversation, so 5 a day.
  const fromAssistant: any[] = [];
  async function visitor(): Promise<ClientSocket> {
    const { token } = signWidgetSession({
      siteId: String(site._id),
      visitorId: newVisitorId(),
      sid: newWidgetSessionId(),
      kv: siteKeyVersion(site.siteKey)
    });
    const socket = connect(`${base}/widget`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token }
    });
    sockets.push(socket);
    socket.on('new-message', (data: { message: any }) => {
      if (data.message.senderId === 'assistant') fromAssistant.push(data.message);
    });
    const joined = new Promise((resolve) => socket.once('conversation-joined', resolve));
    socket.emit('join-conversation', {});
    await joined;
    return socket;
  }
  const ask = async (socket: ClientSocket) => {
    const before = fromAssistant.length;
    const sent = await socket.timeout(10_000).emitWithAck('send-message', {
      content: 'Kargo kaç günde gelir?',
      clientMessageId: `c-${generateId()}`
    });
    assert.equal(sent.ok, true, JSON.stringify(sent));
    await until(() => fromAssistant.length > before);
  };

  const first = await visitor();
  for (let i = 0; i < 3; i += 1) await ask(first);
  const second = await visitor();
  await ask(second);
  await ask(second);
  assert.equal(fromAssistant.filter((m) => !m.assistant?.handoff).length, 5);

  await ask(second);
  const last = fromAssistant[fromAssistant.length - 1];
  assert.equal(last.assistant.handoff, 'daily_cap');

  const { rows } = await query<{ n: number }>(
    `SELECT assistant_replies AS n FROM organization_usage_monthly WHERE organization_id = $1`,
    [org._id]
  );
  assert.equal(rows[0].n, 5, 'only the answers given were counted');
});

// ------------------------------------------------------- consent (AI-04)

async function ownerWithSite() {
  const email = `owner${Date.now()}${Math.floor(Math.random() * 1e5)}@consent.test`;
  const reg = await signUp({ name: 'Consent Owner', email, password: 'E2ePassw0rd!' });
  const token = /(?:^|,\s*)sc_session=([^;]+)/.exec(reg.headers.get('set-cookie') || '')?.[1];
  const created = await fetch(`${BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Onay ${generateId()}`, domain: `${generateId()}.example` })
  });
  const { site } = (await created.json()) as { site: { _id: string; organizationId: string } };
  const { rows } = await query<{ id: string; session_version: number }>(
    'SELECT id, session_version FROM users WHERE email = $1',
    [email]
  );
  return { token: decodeURIComponent(token || ''), site, user: rows[0] };
}

test('switching the assistant on needs the owner to confirm the notice', async () => {
  const { token, site } = await ownerWithSite();
  const put = (body: unknown) =>
    fetch(`${BASE}/api/sites/${site._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
  const refused = await put({ assistantEnabled: true });
  assert.equal(refused.status, 400);
  assert.equal(((await refused.json()) as { code: string }).code, 'ASSISTANT_CONSENT_REQUIRED');
  // Confirmed, it gets past the notice: on, or "not available" on a stack
  // without a key — never the consent refusal again.
  const confirmed = await put({ assistantEnabled: true, assistantConsent: true });
  const body = (await confirmed.json()) as { code?: string };
  assert.ok(
    confirmed.status === 200 || body.code === 'ASSISTANT_UNAVAILABLE',
    JSON.stringify(body)
  );
  // Switching it off needs nothing.
  const off = await put({ assistantEnabled: false });
  assert.equal(off.status, 200);
});

test('confirmed, it is switched on and audited with who and when', async () => {
  // The sites route runs here, where the assistant is configured.
  const { site, user } = await ownerWithSite();
  const app = express();
  app.use(express.json());
  app.use('/api/sites', siteRoutes);
  app.use(errorHandler);
  const local = http.createServer(app);
  await new Promise<void>((resolve) => local.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(local.address() as AddressInfo).port}`;
  const session = signSession(
    {
      userId: user.id,
      userType: 'user',
      role: 'owner',
      organizationId: String(site.organizationId),
      sv: user.session_version
    },
    600
  );
  try {
    await checkModel();
    const res = await fetch(`${url}/api/sites/${site._id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify({ assistantEnabled: true, assistantConsent: true })
    });
    assert.equal(res.status, 200, await res.clone().text());
    let rows: Array<{ user_id: string; metadata: Record<string, unknown> }> = [];
    for (let i = 0; i < 20 && !rows.length; i += 1) {
      ({ rows } = await query(
        `SELECT user_id, metadata FROM audit_logs
          WHERE organization_id = $1 AND action = 'ASSISTANT_ENABLED'`,
        [String(site.organizationId)]
      ));
      if (!rows.length) await sleep(100);
    }
    assert.equal(rows.length, 1);
    assert.equal(rows[0].user_id, user.id);
    assert.equal(rows[0].metadata.consent, true);
    assert.ok(Date.parse(String(rows[0].metadata.consentedAt)) > Date.now() - 60_000);
  } finally {
    local.close();
  }
});
