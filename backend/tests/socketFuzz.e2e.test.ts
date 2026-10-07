'use strict';

// Socket payloads that are wrong in every way a client can make them wrong
// (plan v10 SEC-15): 1 000 events, half on a visitor's /widget socket and
// half on an agent's /admin socket — unknown events, payloads that are not
// objects, fields of the wrong type, strings over their limit, two payloads
// in one event, deep junk in unknown fields, prototype keys.
//
//  - every one is answered with a refused acknowledgement — the event's
//    refusal code (INVALID_PAYLOAD, INVALID_MESSAGE, …) or UNKNOWN_EVENT;
//    none reaches a handler
//  - the API is still healthy afterwards, the same sockets still chat, and
//    its heap has not grown by more than a generous margin
//
// The generator is seeded; a failure prints the seed to replay it with
// FUZZ_SEED=<seed>.
//
// Needs the running API (development, for /api/dev/metrics).
// Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { connect } from 'socket.io-client';
import { getPool } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { ADMIN_EVENTS, WIDGET_EVENTS, refusalCode } from '../src/socket/schema';
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

const SEED = Number(process.env.FUZZ_SEED) || Date.now() % 2 ** 31;
const EVENTS = 1000;

/** mulberry32: small, seedable, good enough to pick test cases. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = prng(SEED);
const int = (n: number) => Math.floor(random() * n);
const pick = <T>(items: readonly T[]): T => items[int(items.length)];

function junk(depth = 0): unknown {
  switch (int(depth > 4 ? 5 : 8)) {
    case 0:
      return int(1e9) - 5e8;
    case 1:
      return 'x'.repeat(int(300));
    case 2:
      return random() < 0.5;
    case 3:
      return null;
    case 4:
      return '\u0000\ud800<script>alert(1)</script>';
    case 5:
      return Array.from({ length: int(5) }, () => junk(depth + 1));
    case 6:
      return Object.fromEntries(
        Array.from({ length: int(5) }, () => [`k${int(1000)}`, junk(depth + 1)])
      );
    default: {
      // Nested deep enough to hurt a naive recursive walker.
      let nested: unknown = 'bottom';
      for (let i = 0; i < 60; i += 1) nested = { n: nested };
      return nested;
    }
  }
}

type Shape = Record<string, any>;

/** A value that breaks `rule` for certain. */
function wrongFor(rule: any): unknown {
  switch (rule.t) {
    case 'string':
      return rule.cut
        ? pick([123, true, [], {}])
        : pick([123, true, [], {}, 'y'.repeat(rule.max + 1 + int(5000))]);
    case 'number':
      return pick(['1', rule.max + 1, rule.min - 1, true, [], {}]);
    case 'boolean':
      return pick(['true', 1, [], {}]);
    case 'enum':
      return pick(['definitely-not-allowed', 7, [], {}]);
    case 'object':
      return pick(['text', 42, [1, 2], true]);
    case 'record':
      return pick([
        [1, 2, 3],
        'text',
        Object.fromEntries(Array.from({ length: rule.maxKeys + 1 }, (_, i) => [`k${i}`, 'v'])),
        { ok: 'v', bad: { nested: true } },
        { [`${'k'.repeat(rule.keyMax + 1)}`]: 'v' }
      ]);
  }
  return Symbol('unreachable');
}

/** One event that must be refused, as [event, ...args]. */
function badEvent(events: Record<string, Shape>): unknown[] {
  const names = Object.keys(events);
  switch (int(5)) {
    case 0:
      return [`not-an-event-${int(100)}`, junk()];
    case 1:
      // Not an object at all.
      return [pick(names), pick([42, 'text', [1, 2, 3], true, 'z'.repeat(int(20_000))])];
    case 2: {
      // Two payloads in one event.
      const name = pick(names);
      return [name, {}, {}];
    }
    default: {
      // An object with junk around one field of the wrong type. Nested
      // fields of an object rule are broken one level down.
      const candidates = names.filter((n) => Object.keys(events[n]).length > 0);
      const name = pick(candidates);
      const shape = events[name];
      const field = pick(Object.keys(shape));
      const rule = shape[field];
      const payload: Record<string, unknown> = {};
      for (let i = int(4); i > 0; i -= 1) payload[`extra${int(100)}`] = junk();
      if (random() < 0.3) Object.assign(payload, JSON.parse('{"__proto__": {"polluted": true}}'));
      if (rule.t === 'object' && random() < 0.5) {
        const inner = pick(Object.keys(rule.fields));
        payload[field] = { [inner]: wrongFor(rule.fields[inner]) };
      } else {
        payload[field] = wrongFor(rule);
      }
      return [name, payload];
    }
  }
}

function sessionCookie(res: { headers: Headers }): string {
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

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

async function metrics(): Promise<{ heapUsedMb: number; rssMb: number }> {
  const res = await fetch(`${BASE}/api/dev/metrics`);
  assert.equal(res.status, 200, 'the development API serves /api/dev/metrics');
  return (await res.json()) as { heapUsedMb: number; rssMb: number };
}

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

test(`${EVENTS} malformed socket events are refused, and the server carries on (seed ${SEED})`, async () => {
  const email = `owner${stamp()}@fuzz.test`;
  const reg = await signUp({ name: 'Fuzz Owner', email, password: 'E2ePassw0rd!' });
  const token = sessionCookie(reg);
  const created = await fetch(`${BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Fuzz ${stamp()}`, domain: `f${stamp()}.example` })
  });
  const site = ((await created.json()) as { site: { siteKey: string } }).site;

  const visitor = await joinAsVisitor(site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const agent = await adminSocket(token);
  // Refusals also arrive as `error` events; nobody needs to see them here.
  visitor.socket.on('error', () => undefined);
  agent.on('error', () => undefined);

  const before = await metrics();
  const codes = new Map<string, number>();
  const unexpected: unknown[] = [];

  for (let batch = 0; batch < EVENTS / 50; batch += 1) {
    await Promise.all(
      Array.from({ length: 50 }, async (_, i) => {
        const onWidget = (batch * 50 + i) % 2 === 0;
        const socket = onWidget ? visitor.socket : agent;
        const [event, ...args] = badEvent(onWidget ? WIDGET_EVENTS : ADMIN_EVENTS);
        let reply: any;
        try {
          reply = await socket.timeout(10_000).emitWithAck(event as string, ...args);
        } catch (error) {
          unexpected.push({
            event,
            args: JSON.stringify(args).slice(0, 200),
            error: String(error)
          });
          return;
        }
        const expected =
          typeof event === 'string' && event.startsWith('not-an-event')
            ? 'UNKNOWN_EVENT'
            : refusalCode(event as string);
        if (reply?.ok !== false || reply.code !== expected) {
          unexpected.push({ event, args: JSON.stringify(args).slice(0, 200), reply });
          return;
        }
        codes.set(reply.code, (codes.get(reply.code) || 0) + 1);
      })
    );
  }

  assert.deepEqual(unexpected.slice(0, 5), [], `every event refused (seed ${SEED})`);
  assert.equal(
    [...codes.values()].reduce((a, b) => a + b, 0),
    EVENTS
  );
  assert.ok(EVENTS - (codes.get('UNKNOWN_EVENT') || 0) > EVENTS / 2, 'most were bad payloads');

  // Still alive, and the same sockets still talk.
  assert.equal(visitor.socket.connected, true);
  assert.equal(agent.connected, true);
  const health = await fetch(`${BASE}/health`);
  assert.equal(health.status, 200);
  const sent = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Hâlâ buradayım',
    clientMessageId: crypto.randomUUID(),
    unknownField: { deep: true }
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const reply = await agent.timeout(10_000).emitWithAck('send-message', {
    conversationId: String(sent.message.conversationId),
    content: 'Size nasıl yardımcı olabilirim?',
    clientMessageId: crypto.randomUUID()
  });
  assert.equal(reply.ok, true, JSON.stringify(reply));

  // The heap is not keeping what it refused. A generous margin: other suites
  // may be running against the same API.
  const after = await metrics();
  assert.ok(
    after.heapUsedMb - before.heapUsedMb < 64,
    `heap grew from ${before.heapUsedMb} MB to ${after.heapUsedMb} MB`
  );
});
