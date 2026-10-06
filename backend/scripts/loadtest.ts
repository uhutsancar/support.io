'use strict';

// Yük testi (plan §18).
//
// Her aşamada N ziyaretçi gerçek widget yolundan bağlanır (POST
// /api/widget/session → /widget soketi → join) ve bağlı kalır. Hepsi
// bağlıyken kısa bir mesaj patlaması gönderilir (varsayılan 50 mesaj/sn,
// 10 sn); her mesaj sunucunun ACK'iyle, yani veritabanına yazıldıktan
// sonra kapanır.
//
// Ölçülenler:
//   istemci   bağlanma+join süresi, ACK süresi (p50/p95/p99), hatalar
//   sunucu    mesaj insert süresi, event-loop gecikmesi, sürecin CPU'su ve
//             RAM'i (GET /api/dev/metrics, yalnızca production dışında)
//   docker    aşamanın ortasında backend ve postgres konteynerlerinin
//             CPU/RAM'i (docker CLI varsa)
//
// Sonuç ölçüldüğü makineyi anlatır; üretim kapasitesi değildir. İstemci ile
// sunucu aynı makinedeyse ikisi aynı CPU'yu paylaşır.
//
// Kullanım (compose yığını ayaktayken, başka yük yokken):
//   npm run loadtest
//   npm run loadtest -- --stages 100,500,1000 --rate 50 --seconds 10

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import { execFile } from 'child_process';
import type { Socket } from 'socket.io-client';
import { BASE, connected, widgetSocket, widgetToken } from '../tests/helpers/widget';
import { setPlan, verifyEmail } from '../tests/helpers/accounts';
import type { metricsSnapshot } from '../src/config/metrics';

type Metrics = ReturnType<typeof metricsSnapshot>;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : String(process.argv[i + 1]);
}

const STAGES = arg('stages', '100,500,1000').split(',').map(Number).filter(Boolean);
const RATE = Number(arg('rate', '50'));
const SECONDS = Number(arg('seconds', '10'));
const CONCURRENCY = Number(arg('concurrency', '50'));
const ACK_TIMEOUT_MS = 15000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function stats(samples: number[]) {
  if (!samples.length) return null;
  const s = [...samples].sort((a, b) => a - b);
  const at = (p: number) => Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]);
  return { n: s.length, p50: at(50), p95: at(95), p99: at(99), max: Math.round(s[s.length - 1]) };
}

const fmt = (x: ReturnType<typeof stats>) =>
  x ? `n=${x.n} p50=${x.p50}ms p95=${x.p95}ms p99=${x.p99}ms max=${x.max}ms` : 'ölçüm yok';

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    })
  ]).finally(() => clearTimeout(timer));
}

async function json<T>(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  const body = (res.status === 204 ? null : await res.json().catch(() => null)) as T | null;
  return { status: res.status, body, headers: res.headers };
}

/** A fresh, verified owner with one site, on the plan with the most room. */
async function setup(): Promise<{ siteKey: string }> {
  const email = `load${Date.now()}@load.test`;
  const reg = await json<{ user: { organizationId: string } }>('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Load Owner', email, password: 'LoadPassw0rd!' })
  });
  if (reg.status !== 201) throw new Error(`kayıt başarısız: ${reg.status}`);
  const session = /sc_session=([^;]+)/.exec(reg.headers.get('set-cookie') || '')?.[1];
  const auth = { Authorization: `Bearer ${decodeURIComponent(session || '')}` };
  await verifyEmail(email);
  const onboarded = await json('/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({ websiteUrl: 'http://localhost:3001', title: 'Load Owner' })
  });
  if (onboarded.status >= 300) throw new Error(`onboarding başarısız: ${onboarded.status}`);
  await setPlan(String(reg.body?.user.organizationId), 'ENTERPRISE');
  const { body } = await json<{ sites: { siteKey: string }[] }>('/api/sites', { headers: auth });
  const siteKey = body?.sites[0]?.siteKey;
  if (!siteKey) throw new Error('site oluşturulamadı');
  return { siteKey };
}

/** Runs `task(i)` for i < total, at most `limit` at a time. */
async function inPool(total: number, limit: number, task: (i: number) => Promise<void>) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, total) }, async () => {
    while (next < total) {
      const i = next++;
      await task(i);
    }
  });
  await Promise.all(workers);
}

function dockerStats(): Promise<string[]> {
  return new Promise((resolve) => {
    execFile(
      'docker',
      ['stats', '--no-stream', '--format', '{{.Name}}  cpu={{.CPUPerc}}  mem={{.MemUsage}}'],
      { timeout: 15000 },
      (error, stdout) => {
        if (error) return resolve([]);
        resolve(
          stdout
            .split(/\r?\n/)
            .filter((line) => /backend|postgres/i.test(line))
            .map((line) => line.trim())
        );
      }
    );
  });
}

async function stage(siteKey: string, sockets: number, index: number) {
  console.log(`\n=== ${sockets} eşzamanlı soket, ${RATE} mesaj/sn × ${SECONDS} sn ===`);
  await json('/api/dev/metrics/reset', { method: 'POST' });

  // --- bağlanma
  const visitors: Socket[] = [];
  const joins: number[] = [];
  const connectErrors = new Map<string, number>();
  const connectStarted = Date.now();
  await inPool(sockets, CONCURRENCY, async () => {
    const started = performance.now();
    try {
      const { token } = await widgetToken(siteKey);
      const socket = widgetSocket(token);
      await withTimeout(connected(socket), 20000, 'connect');
      await withTimeout(
        new Promise((resolve) => {
          socket.once('conversation-joined', resolve);
          socket.emit('join-conversation', {});
        }),
        20000,
        'join'
      );
      joins.push(performance.now() - started);
      visitors.push(socket);
    } catch (error) {
      const kind = (error instanceof Error ? error.message : String(error)).slice(0, 60);
      connectErrors.set(kind, (connectErrors.get(kind) || 0) + 1);
    }
  });
  const connectSeconds = ((Date.now() - connectStarted) / 1000).toFixed(1);
  console.log(`bağlanma+join   ${fmt(stats(joins))}  (${connectSeconds} sn)`);
  if (connectErrors.size) console.log('  bağlanma hataları:', Object.fromEntries(connectErrors));
  if (!visitors.length) return { ok: false };

  // --- mesaj patlaması
  const total = RATE * SECONDS;
  const acks: number[] = [];
  const ackErrors = new Map<string, number>();
  const pending: Promise<void>[] = [];
  let docker: Promise<string[]> = Promise.resolve([]);
  const burstStarted = performance.now();
  for (let k = 0; k < total; k++) {
    const due = burstStarted + (k * 1000) / RATE;
    const wait = due - performance.now();
    if (wait > 0) await sleep(wait);
    if (k === Math.floor(total / 2)) docker = dockerStats();
    const socket = visitors[k % visitors.length];
    const sent = performance.now();
    pending.push(
      new Promise<void>((resolve) => {
        socket
          .timeout(ACK_TIMEOUT_MS)
          .emit(
            'send-message',
            { content: `Yük testi mesajı ${k}`, clientMessageId: `load-${index}-${k}` },
            (err: Error | null, reply: { ok?: boolean; code?: string } | undefined) => {
              if (err || !reply?.ok) {
                const kind = err ? 'ack timeout' : reply?.code || 'refused';
                ackErrors.set(kind, (ackErrors.get(kind) || 0) + 1);
              } else {
                acks.push(performance.now() - sent);
              }
              resolve();
            }
          );
      })
    );
  }
  const sendSeconds = ((performance.now() - burstStarted) / 1000).toFixed(1);
  await Promise.all(pending);
  const achieved = (total / Number(sendSeconds)).toFixed(1);
  console.log(
    `mesaj ACK       ${fmt(stats(acks))}  (${total} mesaj ${sendSeconds} sn'de, ${achieved}/sn)`
  );
  if (ackErrors.size) console.log('  ACK hataları:', Object.fromEntries(ackErrors));

  // --- sunucu ve konteynerler
  const { body: m } = await json<Metrics>('/api/dev/metrics');
  if (m) {
    const insert = m.timings?.['message.insert'];
    console.log(
      `sunucu          insert p50=${insert?.p50}ms p95=${insert?.p95}ms p99=${insert?.p99}ms max=${insert?.max}ms (n=${insert?.n})`
    );
    console.log(
      `                event-loop gecikmesi p50=${m.eventLoopDelayMs.p50}ms p99=${m.eventLoopDelayMs.p99}ms max=${m.eventLoopDelayMs.max}ms`
    );
    console.log(
      `                süreç CPU ort=%${m.cpuPercent} (tek çekirdeğe göre, ${Math.round(m.windowMs / 1000)} sn)  RSS=${m.rssMb}MB  heap=${m.heapUsedMb}MB`
    );
  } else {
    console.log('sunucu          /api/dev/metrics yok (production modunda mı?)');
  }
  for (const line of await docker) console.log(`docker          ${line}`);

  for (const socket of visitors) socket.close();
  await sleep(2000);
  return { ok: connectErrors.size === 0 && ackErrors.size === 0 };
}

async function main() {
  console.log(`Hedef: ${BASE}`);
  console.log(`Aşamalar: ${STAGES.join(', ')} soket; patlama ${RATE} mesaj/sn × ${SECONDS} sn`);
  console.log('Not: sonuç bu makineyi anlatır, üretim kapasitesi değildir.');
  const { siteKey } = await setup();
  let ok = true;
  for (const [index, sockets] of STAGES.entries()) {
    const result = await stage(siteKey, sockets, index);
    ok = ok && result.ok;
  }
  process.exit(ok ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('Yük testi başarısız:', error instanceof Error ? error.message : error);
  process.exit(1);
});
