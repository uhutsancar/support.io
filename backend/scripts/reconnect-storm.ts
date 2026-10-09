'use strict';

// Reconnect storm (plan v10 PERF-06): visitors and agents are connected, the
// backend restarts (as during a deploy), and everyone comes back.
//
// Measured:
//   downtime       how long /ready did not answer 200
//   reconnection   per client, from the restart to its socket being back
//                  (the spread shows the back-off jitter at work)
//   CPU            the backend container's CPU, sampled every 2 s for 30 s
//                  after it is back (docker CLI)
//   loss           every visitor writes one message during the outage and
//                  re-sends it under the same clientMessageId until it is
//                  acknowledged, as the widget does; afterwards each must be
//                  in the database exactly once
//
// The clients use the widget's own back-off: 1 s to 30 s, ±50 % jitter.
// Run it against a stack with nothing else on it. The result describes the
// machine it ran on, not production capacity (docs/load-test.md).
//
//   npm run reconnect-storm -- --visitors 300 --agents 20
//   (restart command: --restart "docker compose restart backend")

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import { exec, execFile } from 'child_process';
import crypto from 'crypto';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getPool, query } from '../src/db/pool';
import { BASE, widgetToken } from '../tests/helpers/widget';
import { setPlan, signUp } from '../tests/helpers/accounts';

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : String(process.argv[i + 1]);
}

const VISITORS = Number(arg('visitors', '300'));
const AGENTS = Number(arg('agents', '20'));
const RESTART = arg('restart', 'docker compose restart backend');
const CONTAINER = arg('container', 'support_chat_app-backend-1');
const ORIGIN = 'http://localhost:3001';
const BACKOFF = { reconnectionDelay: 1000, reconnectionDelayMax: 30000, randomizationFactor: 0.5 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stats(samples: number[]) {
  if (!samples.length) return 'none';
  const s = [...samples].sort((a, b) => a - b);
  const at = (p: number) => Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
  return `n=${s.length} min=${Math.round(s[0])} p50=${at(50)} p95=${at(95)} max=${Math.round(s[s.length - 1])} ms`;
}

async function ready(): Promise<boolean> {
  try {
    return (await fetch(`${BASE}/ready`, { signal: AbortSignal.timeout(1000) })).ok;
  } catch {
    return false;
  }
}

function containerCpu(): Promise<number | null> {
  return new Promise((resolve) => {
    execFile(
      'docker',
      ['stats', '--no-stream', '--format', '{{.CPUPerc}}', CONTAINER],
      { timeout: 5000 },
      (error, stdout) => resolve(error ? null : Number(String(stdout).replace('%', '').trim()) || 0)
    );
  });
}

async function main() {
  const email = `storm${Date.now()}@load.test`;
  const reg = await signUp({ name: 'Storm Owner', email, password: 'LoadPassw0rd!' });
  const session = decodeURIComponent(
    /sc_session=([^;]+)/.exec(reg.headers.get('set-cookie') || '')?.[1] || ''
  );
  const created = await fetch(`${BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
    body: JSON.stringify({ name: 'Storm', domain: `storm${Date.now()}.example` })
  });
  const { site } = (await created.json()) as {
    site: { _id: string; siteKey: string; organizationId: string };
  };
  await setPlan(String(site.organizationId), 'ENTERPRISE');

  console.log(`connecting ${VISITORS} visitors and ${AGENTS} agent sockets…`);
  const visitors: Array<{ socket: Socket; back: number | null }> = [];
  for (let i = 0; i < VISITORS; i += 10) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(10, VISITORS - i) }, async () => {
        const { token } = await widgetToken(site.siteKey, { origin: ORIGIN });
        const socket = connect(`${BASE}/widget`, {
          transports: ['websocket'],
          forceNew: true,
          auth: { token },
          extraHeaders: { Origin: ORIGIN },
          ...BACKOFF
        });
        await new Promise<void>((resolve, reject) => {
          socket.once('connect', () => resolve());
          socket.once('connect_error', reject);
        });
        socket.on('connect', () => socket.emit('join-conversation', {}));
        socket.emit('join-conversation', {});
        return { socket, back: null as number | null };
      })
    );
    visitors.push(...batch);
  }
  const agents: Array<{ socket: Socket; back: number | null }> = [];
  for (let i = 0; i < AGENTS; i += 1) {
    const socket = connect(`${BASE}/admin`, {
      transports: ['websocket'],
      forceNew: true,
      auth: { token: session },
      ...BACKOFF
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', () => resolve());
      socket.once('connect_error', reject);
    });
    agents.push({ socket, back: null });
  }

  console.log(`restarting: ${RESTART}`);
  const restartAt = Date.now();
  for (const client of [...visitors, ...agents]) {
    client.socket.once('disconnect', () => {
      client.socket.once('connect', () => {
        client.back = Date.now() - restartAt;
      });
    });
  }
  // Each visitor writes once during the outage, and keeps re-sending the
  // same message until it is acknowledged.
  const messageIds = visitors.map(() => `storm-${crypto.randomUUID()}`);
  const delivered = new Array<boolean>(visitors.length).fill(false);
  visitors.forEach((v, i) => {
    const attempt = () => {
      if (delivered[i]) return;
      if (!v.socket.connected) return void setTimeout(attempt, 500);
      v.socket
        .timeout(10_000)
        .emitWithAck('send-message', {
          content: 'Bağlantı koptu mu?',
          clientMessageId: messageIds[i]
        })
        .then((reply: { ok?: boolean }) => {
          if (reply?.ok) delivered[i] = true;
          else setTimeout(attempt, 1000);
        })
        .catch(() => setTimeout(attempt, 1000));
    };
    setTimeout(attempt, 200 + Math.random() * 2000);
  });

  // Downtime: /ready polled every 250 ms.
  const restarting = new Promise<void>((resolve) => exec(RESTART, () => resolve()));
  let downSince: number | null = null;
  let downtime = 0;
  const poller = setInterval(async () => {
    const ok = await ready();
    if (!ok && downSince === null) downSince = Date.now();
    if (ok && downSince !== null) {
      downtime += Date.now() - downSince;
      downSince = null;
    }
  }, 250);
  await restarting;

  // Wait for everyone, at most 3 minutes.
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const missing = [...visitors, ...agents].filter((c) => c.back === null).length;
    if (!missing && delivered.every(Boolean)) break;
    await sleep(500);
  }
  const backAt = Date.now();
  const cpu: number[] = [];
  while (Date.now() - backAt < 30_000) {
    const value = await containerCpu();
    if (value !== null) cpu.push(value);
    await sleep(2000);
  }
  clearInterval(poller);

  const { rows } = await query<{ client_message_id: string; n: number }>(
    `SELECT client_message_id, count(*)::int AS n FROM messages
      WHERE client_message_id = ANY($1) GROUP BY client_message_id`,
    [messageIds]
  );
  const stored = new Map(rows.map((r) => [r.client_message_id, r.n]));
  const lost = messageIds.filter((id) => !stored.has(id)).length;
  const doubled = rows.filter((r) => r.n > 1).length;

  console.log('');
  console.log(`downtime (/ready not 200):  ${downtime} ms`);
  console.log(
    `visitors back:               ${stats(visitors.filter((v) => v.back !== null).map((v) => v.back!))}`
  );
  console.log(
    `agents back:                 ${stats(agents.filter((a) => a.back !== null).map((a) => a.back!))}`
  );
  console.log(
    `never back:                  ${[...visitors, ...agents].filter((c) => c.back === null).length}`
  );
  console.log(
    `backend CPU, 30 s after:     ${cpu.length ? `avg ${Math.round(cpu.reduce((a, b) => a + b, 0) / cpu.length)} %, max ${Math.round(Math.max(...cpu))} %` : 'no docker stats'}`
  );
  console.log(`messages: ${messageIds.length} sent, ${lost} lost, ${doubled} stored twice`);

  for (const c of [...visitors, ...agents]) c.socket.disconnect();
  await getPool().end();
  if (lost || doubled) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
