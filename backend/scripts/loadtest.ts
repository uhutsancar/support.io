'use strict';

// Yük testi.
//
// İki soruyu ölçer:
//   A) Yüksek trafikte panel işlemleri çalışıyor mu?  (eşzamanlı inbox okuması)
//   B) Yüksek trafikte herkes sohbet edebiliyor mu?   (eşzamanlı widget oturumu)
//
// Kullanım:
//   node scripts/loadtest.js                 varsayılan profil
//   node scripts/loadtest.js --agents 40 --visitors 60 --rounds 5
//
// Çalışan bir backend ve tohumlanmış demo verisi gerektirir.

import dotenv from 'dotenv';
import { io } from 'socket.io-client';

dotenv.config();

const BASE = process.env.E2E_BASE_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;
const DEMO_OWNER = { email: 'owner@demo.support.io', password: 'Demo1234!' };

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
}

const AGENTS = arg('agents', 25);
const VISITORS = arg('visitors', 40);
const ROUNDS = arg('rounds', 4);

// Yüzdelikler ortalamadan daha bilgilendiricidir: yavaşlama genelde kuyruğun
// sonunda yaşanır, ortalama onu gizler.
function summarize(label: string, samples: number[], errors: number) {
  if (!samples.length) {
    console.log(`  ${label.padEnd(26)} ölçüm yok (hata: ${errors})`);
    return null;
  }
  const s = [...samples].sort((a: any, b: any) => a - b);
  const at = (p: number) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  const avg = Math.round(s.reduce((a: any, b: any) => a + b, 0) / s.length);
  console.log(
    `  ${label.padEnd(26)} n=${String(s.length).padStart(4)}  ` +
    `ort=${String(avg).padStart(5)}ms  p50=${String(at(50)).padStart(5)}ms  ` +
    `p95=${String(at(95)).padStart(5)}ms  p99=${String(at(99)).padStart(5)}ms  ` +
    `max=${String(s[s.length - 1]).padStart(5)}ms  hata=${errors}`
  );
  return { avg, p50: at(50), p95: at(95), p99: at(99), max: s[s.length - 1], errors, n: s.length };
}

async function login() {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO_OWNER)
  });
  if (!r.ok) throw new Error(`Demo hesabıyla giriş başarısız (${r.status}). Önce: npm run db:seed`);
  return r.json();
}

async function timed(fn: () => Promise<unknown>) {
  const t0 = Date.now();
  try {
    const ok = await fn();
    return { ms: Date.now() - t0, ok };
  } catch (e) {
    return { ms: Date.now() - t0, ok: false, error: e.message };
  }
}

// --- A) Panel: eşzamanlı inbox okuması ------------------------------------
async function scenarioPanel(token: string, siteId: string) {
  const samples: number[] = [];
  let errors = 0;

  for (let round = 0; round < ROUNDS; round++) {
    const batch = Array.from({ length: AGENTS }, () =>
      timed(async () => {
        const r = await fetch(`${BASE}/api/conversations/${siteId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!r.ok) throw new Error(String(r.status));
        await r.json();
        return true;
      })
    );
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r.ok) samples.push(r.ms);
      else errors++;
    }
  }
  return summarize(`inbox okuma (${AGENTS} eşzamanlı)`, samples, errors);
}

// --- B) Widget: eşzamanlı ziyaretçi sohbeti -------------------------------
/** What one simulated visitor reports back. */
interface VisitorResult {
  joinMs: number | null;
  sendMs: number | null;
  ok: boolean;
  error: string | null;
}

function visitorSession(siteKey: string, index: number): Promise<VisitorResult> {
  return new Promise<VisitorResult>((resolve) => {
    const started = Date.now();
    const visitorId = `load-${Date.now()}-${index}`;
    const result: VisitorResult = { joinMs: null, sendMs: null, ok: false, error: null };

    const socket = io(`${BASE}/widget`, {
      transports: ['websocket'],
      forceNew: true,
      timeout: 20000
    });

    const done = (err: any) => {
      result.error = err || null;
      try { socket.close(); } catch (e) { /* zaten kapalı */ }
      resolve(result);
    };

    const guard = setTimeout(() => done('timeout'), 30000);

    socket.on('connect_error', (e) => { clearTimeout(guard); done('connect_error: ' + e.message); });
    socket.on('error', (e) => { clearTimeout(guard); done('error: ' + (e?.message || e)); });

    socket.on('connect', () => {
      socket.emit('join-conversation', {
        siteKey,
        visitorId,
        visitorName: `Yük Ziyaretçisi ${index}`,
        currentPage: '/',
        metadata: { country: 'TR' }
      });
    });

    socket.once('conversation-joined', () => {
      result.joinMs = Date.now() - started;
      const sendStart = Date.now();

      // Gönderilen mesajın kendisine geri yankılanması, sunucunun mesajı
      // gerçekten işlediğinin kanıtıdır.
      socket.on('new-message', (payload) => {
        if (payload?.message?.senderType !== 'visitor') return;
        clearTimeout(guard);
        result.sendMs = Date.now() - sendStart;
        result.ok = true;
        done(null);
      });

      socket.emit('send-message', {
        content: `Yük testi mesajı ${index}`,
        senderName: `Yük Ziyaretçisi ${index}`
      });
    });
  });
}

async function scenarioWidget(siteKey: string) {
  const joins: number[] = [];
  const sends = [];
  let errors = 0;
  const errorKinds = new Map();

  for (let round = 0; round < ROUNDS; round++) {
    const batch = Array.from({ length: VISITORS }, (_, i) => visitorSession(siteKey, round * VISITORS + i));
    const results = await Promise.all(batch);
    for (const r of results) {
      if (r.ok) {
        joins.push(r.joinMs as number);
        sends.push(r.sendMs as number);
      } else {
        errors++;
        const k = (r.error || 'bilinmeyen').split(':')[0];
        errorKinds.set(k, (errorKinds.get(k) || 0) + 1);
      }
    }
  }

  const j = summarize(`widget bağlanma (${VISITORS} eşzamanlı)`, joins, 0);
  const s = summarize('mesaj gönderme', sends, errors);
  if (errorKinds.size) {
    console.log('    hata dağılımı:', [...errorKinds].map(([k, v]) => `${k}=${v}`).join(', '));
  }
  return { join: j, send: s };
}

async function main() {
  console.log(`Hedef: ${BASE}`);
  console.log(`Profil: ${AGENTS} temsilci × ${ROUNDS} tur, ${VISITORS} ziyaretçi × ${ROUNDS} tur\n`);

  const { token } = (await login()) as { token: string };
  const sitesRes = await fetch(`${BASE}/api/sites`, { headers: { Authorization: `Bearer ${token}` } });
  const { sites } = (await sitesRes.json()) as { sites: any[] };
  const site = sites.find((s: any) => s.siteKey === 'demo-site-key-0000-1111-2222') || sites[0];
  if (!site) throw new Error('Site bulunamadı. Önce: npm run db:seed');

  console.log('A) PANEL İŞLEMLERİ');
  const panel = await scenarioPanel(token, site._id);

  console.log('\nB) ZİYARETÇİ SOHBETİ');
  const widget = await scenarioWidget(site.siteKey);

  console.log('\nÖZET');
  const totalErrors = (panel?.errors || 0) + (widget.send?.errors || 0);
  console.log(`  toplam hata: ${totalErrors}`);
  console.log(`  panel p95  : ${panel?.p95 ?? '-'} ms`);
  console.log(`  sohbet p95 : ${widget.send?.p95 ?? '-'} ms`);

  process.exit(totalErrors > 0 ? 1 : 0);
}

main().catch((e: any) => {
  console.error('Yük testi başarısız:', e.message);
  process.exit(1);
});
