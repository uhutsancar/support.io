'use strict';

// What the server writes while people use it (plan v10 SEC-16): a sign-in
// with a wrong and then the right password, a visitor who leaves their
// address and writes a message, and the assistant asked about it — once
// failing, once answering. Every structured log line and everything older
// code prints with console.* is collected in memory, and none of it may
// contain the account's e-mail address or password, the visitor's address,
// the message text or the model's API key. A database error carrying an
// address in its detail, and a structured line carrying one, come out masked.
//
// The HTTP routes and the socket layer run in this process, as in
// production, on the e2e database; the model is a local mock (GEMINI_BASE_URL),
// as in assistant.e2e.test.ts. The account is created through the running API.
//
// Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import util from 'node:util';
import express from 'express';
import cookieParser from 'cookie-parser';
import { Server } from 'socket.io';
import { io as connect } from 'socket.io-client';
import type { AddressInfo } from 'node:net';
import type { Socket as ClientSocket } from 'socket.io-client';

// Console output is collected after it has been scrubbed: the collectors go
// in first, the scrubber wraps them.
const printed: string[] = [];
for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
  console[method] = (...args: unknown[]) => {
    printed.push(util.format(...args));
  };
}

import { captureLogs, installConsoleRedaction, logger } from '../src/config/logger';
import authRoutes from '../src/routes/auth';
import { errorHandler } from '../src/http';
import { requestLogging } from '../src/config/logger';
import SocketHandler from '../src/socket';
import Organization from '../src/models/Organization';
import Site from '../src/models/Site';
import FAQ from '../src/models/FAQ';
import { generateId } from '../src/db/objectId';
import { getPool } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { resetBreaker } from '../src/services/assistant/gemini';
import { stopAssistant } from '../src/services/assistant';
import {
  newVisitorId,
  newWidgetSessionId,
  signWidgetSession,
  siteKeyVersion
} from '../src/config/tokens';
import { signUp } from './helpers/accounts';

installConsoleRedaction();
const structured = captureLogs();

const MARK = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
// Shaped like a real Google key, so the console scrubber is exercised too.
const API_KEY = `AIza${`Sy${MARK}`.padEnd(35, 'Q').slice(0, 35)}`;
const OWNER_EMAIL = `owner${MARK}@logs.test`;
const PASSWORD = `Gizli-${MARK}-Pass!`;
const WRONG_PASSWORD = `Yanlis-${MARK}-Pass!`;
const VISITOR_EMAIL = `ziyaretci${MARK}@example.com`;
// Letters, not digits: a long number would read as a card or ID number, and
// the assistant would not send the message to the model at all.
const WORD = MARK.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]);
const MESSAGE = `Siparişim ${WORD} nerede?`;

// ------------------------------------------------------------ the mock model

let failing = true;
let calls = 0;
const gemini = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => {
    calls += 1;
    if (failing) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":{"message":"internal"}}');
      return;
    }
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

// ------------------------------------------------------------ the app

const saved: Record<string, string | undefined> = {};
let server: http.Server;
let ioServer: Server;
let base: string;
const sockets: ClientSocket[] = [];

test.before(async () => {
  await new Promise<void>((resolve) => gemini.listen(0, '127.0.0.1', resolve));
  const mockUrl = `http://127.0.0.1:${(gemini.address() as AddressInfo).port}/v1beta`;
  const env = {
    GEMINI_API_KEY: API_KEY,
    GEMINI_BASE_URL: mockUrl,
    GEMINI_RPM: '100000',
    GEMINI_RPD: '100000',
    GEMINI_TIMEOUT_MS: '2000',
    ASSISTANT_ENABLED: 'true'
  };
  for (const key of Object.keys(env)) saved[key] = process.env[key];
  Object.assign(process.env, env);

  const app = express();
  app.set('trust proxy', 1);
  app.use(requestLogging);
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);

  server = http.createServer(app);
  ioServer = new Server(server);
  new SocketHandler(ioServer);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  resetBreaker();
});

test.after(async () => {
  structured.stop();
  for (const s of sockets) s.disconnect();
  stopAssistant();
  await new Promise((resolve) => setTimeout(resolve, 400));
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

async function until(check: () => boolean, ms = 10_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (!check()) {
    if (Date.now() > deadline) throw new Error('timed out waiting');
    await sleep(25);
  }
}

const login = (password: string) =>
  fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: OWNER_EMAIL, password })
  });

test('sign-in, a visitor message and the assistant leave no personal data in the logs', async () => {
  // The account, created the way a person signs up.
  await signUp({ name: 'Log Owner', email: OWNER_EMAIL, password: PASSWORD });

  const wrong = await login(WRONG_PASSWORD);
  assert.equal(wrong.status, 401);
  const right = await login(PASSWORD);
  assert.equal(right.status, 200, await right.clone().text());

  // A site whose assistant answers first.
  const org = await new Organization({ name: `logs-${generateId()}` }).save();
  const site = await new Site({
    name: 'Log Mağaza',
    domain: `${generateId()}.test`,
    siteKey: `lg-${generateId()}`,
    organizationId: org._id,
    assistantEnabled: true
  }).save();
  await new FAQ({
    siteId: site._id,
    question: 'Kargo ne kadar sürer?',
    answer: 'Siparişler 1-3 iş günü içinde kargoya verilir.',
    keywords: ['kargo', 'sipariş']
  }).save();

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
  const joined = new Promise((resolve) => socket.once('conversation-joined', resolve));
  socket.emit('join-conversation', { visitorName: 'Ayşe', visitorEmail: VISITOR_EMAIL });
  await joined;

  // The model fails once (the assistant logs the failure and hands over)…
  const first = await socket.timeout(10_000).emitWithAck('send-message', {
    content: MESSAGE,
    clientMessageId: `c-${generateId()}`
  });
  assert.equal(first.ok, true, JSON.stringify(first));
  await until(() => calls >= 1);
  await sleep(500);

  // …and answers on a fresh conversation.
  failing = false;
  resetBreaker();
  const other = connect(`${base}/widget`, {
    transports: ['websocket'],
    forceNew: true,
    auth: {
      token: signWidgetSession({
        siteId: String(site._id),
        visitorId: newVisitorId(),
        sid: newWidgetSessionId(),
        kv: siteKeyVersion(site.siteKey)
      }).token
    }
  });
  sockets.push(other);
  const answered = new Promise<void>((resolve) =>
    other.on('new-message', (data: { message: { senderId: string } }) => {
      if (data.message.senderId === 'assistant') resolve();
    })
  );
  const joinedOther = new Promise((resolve) => other.once('conversation-joined', resolve));
  other.emit('join-conversation', { visitorEmail: VISITOR_EMAIL });
  await joinedOther;
  await other.timeout(10_000).emitWithAck('send-message', {
    content: `Kargo ${MESSAGE}`,
    clientMessageId: `c-${generateId()}`
  });
  await answered;

  // What older code does with a database error, and a careless structured line.
  console.error(
    '[test] insert failed',
    Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), {
      code: '23505',
      detail: `Key (email)=(${OWNER_EMAIL}) already exists.`
    })
  );
  logger.warn(
    { user: { email: OWNER_EMAIL, password: PASSWORD }, headers: { 'x-goog-api-key': API_KEY } },
    'careless line'
  );
  await sleep(200);

  const everything = [...structured.lines, ...printed].join('\n');
  // The capture works: the sign-in requests were logged, by path.
  assert.match(everything, /"path":"\/api\/auth\/login"/);
  assert.match(everything, /\[assistant\]/, 'the assistant failure was logged');
  // …and the address came out masked where it was written at all.
  assert.match(everything, /o\*\*\*@l\*\*\*\.test/);

  for (const [what, secret] of [
    ['the account e-mail', OWNER_EMAIL],
    ['the password', PASSWORD],
    ['the wrong password', WRONG_PASSWORD],
    ['the visitor e-mail', VISITOR_EMAIL],
    ['the message text', WORD],
    ['the API key', API_KEY]
  ]) {
    assert.ok(!everything.includes(secret), `${what} is not in the logs`);
  }
});
