'use strict';

// `npm run ai:bench` — a short, light benchmark of the self-hosted model doing
// this product's job, with an HTML report.
//
// It runs the real code path — prompts.ts → the configured provider →
// replyPolicy.ts, through services/ai/autoReply.composeReply — over the
// fictional scenarios in ai/golden, one at a time. Then a small concurrency
// sweep (1, 2 and 4 at once, 20 requests each). Nothing here sweeps the GPU
// for minutes; the whole run is meant to finish well inside 15 minutes.
//
// Needs the model up (COMPOSE_PROFILES=ai, `docker compose up`) and the AI_*
// variables of the root .env; from the host, AI_BASE_URL=http://127.0.0.1:8000/v1.
//
//   npm run ai:bench                 scenarios + concurrency
//   npm run ai:bench -- --e2e        also 5 virtual visitors on the demo site
//   npm run ai:bench -- --baseline   also write ai/benchmarks/baseline.json
//
// Output goes to ai/.artifacts/reports/<timestamp>/ (not committed).

import '../src/config/env';
import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { io as connect } from 'socket.io-client';
import { aiConfig } from '../src/config/ai';
import { getProvider } from '../src/services/ai';
import { composeReply } from '../src/services/ai/autoReply';
import { PROMPT_VERSION } from '../src/services/ai/prompts';
import type { KnowledgeSource } from '../src/services/ai/knowledge';
import type { OrderSummary } from '../src/services/orderLookup';

const ROOT = path.join(__dirname, '../../ai');
const PERSONA = {
  botName: 'Asistan',
  siteName: 'Örnek Elektronik',
  tone: 'professional' as const,
  answerLength: 'normal' as const
};
const CONCURRENCY_LEVELS = [1, 2, 4];
const REQUESTS_PER_LEVEL = 20;

interface Scenario {
  id: string;
  category: string;
  question: string;
  faq?: string[];
  verified?: boolean;
  expected: string | string[];
  mustInclude: string[];
  mustNotInclude: string[];
}

interface ScenarioResult {
  id: string;
  category: string;
  expected: string[];
  decision: string;
  reason: string | null;
  content: string | null;
  ms: number;
  correct: boolean;
  missing: string[];
  forbidden: string[];
}

// ------------------------------------------------------------------ inputs

const fixtures = JSON.parse(fs.readFileSync(path.join(ROOT, 'golden/fixtures.json'), 'utf8')) as {
  faqs: Record<string, { question: string; answer: string }>;
  orders: OrderSummary[];
};
const scenarios: Scenario[] = fs
  .readFileSync(path.join(ROOT, 'golden/scenarios.jsonl'), 'utf8')
  .split('\n')
  .filter((line) => line.trim())
  .map((line) => JSON.parse(line));

/** The sources a scenario gets: the named entries, or — like a small site with
 *  no match in production — every entry. */
function sourcesFor(scenario: Scenario): KnowledgeSource[] {
  const keys = scenario.faq ?? Object.keys(fixtures.faqs);
  return keys.map((key) => ({ id: key, category: '', ...fixtures.faqs[key] }));
}

async function decide(question: string, sources: KnowledgeSource[], verified: boolean) {
  return composeReply({
    question,
    transcript: `Müşteri: ${question}`,
    sources,
    persona: PERSONA,
    verifiedUserId: verified ? 'bench-customer' : null,
    history: { botReplies: 0, recentDecisions: [] },
    settings: { maxBotReplies: 8, blockedTerms: [] },
    lookupOrders: async (_userId, orderNumber) => ({
      ok: true,
      orders: fixtures.orders.filter((o) => !orderNumber || o.orderNumber === orderNumber)
    })
  });
}

// ----------------------------------------------------------------- helpers

/** A term at the start of a word: "Aras" must not match inside "numarası". */
function mentions(text: string, term: string): boolean {
  const escaped = term.toLocaleLowerCase('tr-TR').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}`, 'u').test(text.toLocaleLowerCase('tr-TR'));
}

const percentile = (values: number[], p: number): number | null => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

/** Peak GPU memory while the run lasts, from nvidia-smi; null without one. */
function watchVram() {
  let peak: { usedMb: number; totalMb: number } | null = null;
  const sample = () =>
    execFile(
      'nvidia-smi',
      ['--query-gpu=memory.used,memory.total', '--format=csv,noheader,nounits'],
      (error, stdout) => {
        if (error) return;
        const [used, total] = stdout
          .split('\n')[0]
          .split(',')
          .map((v) => Number(v.trim()));
        if (Number.isFinite(used) && (!peak || used > peak.usedMb))
          peak = { usedMb: used, totalMb: total };
      }
    );
  sample();
  const timer = setInterval(sample, 2000);
  return {
    stop: () => {
      clearInterval(timer);
      return peak;
    }
  };
}

// ------------------------------------------------------------------ stages

async function runScenarios(): Promise<ScenarioResult[]> {
  const results: ScenarioResult[] = [];
  for (const [i, scenario] of scenarios.entries()) {
    const started = Date.now();
    const outcome = await decide(
      scenario.question,
      sourcesFor(scenario),
      Boolean(scenario.verified)
    );
    const ms = Date.now() - started;
    const decision = !outcome ? 'aborted' : outcome.handOver ? 'handoff' : outcome.decision;
    const content = outcome?.content ?? null;
    const text = content ?? '';
    const expected = ([] as string[]).concat(scenario.expected);
    results.push({
      id: scenario.id,
      category: scenario.category,
      expected,
      decision,
      reason: outcome?.reason ?? null,
      content,
      ms,
      correct: expected.includes(decision),
      missing: scenario.mustInclude.filter((m) => !mentions(text, m)),
      forbidden: scenario.mustNotInclude.filter((m) => mentions(text, m))
    });
    process.stdout.write(`\r${i + 1}/${scenarios.length} ${scenario.id}          `);
  }
  process.stdout.write('\n');
  return results;
}

async function runConcurrency() {
  const out: Array<{ level: number; p50: number | null; p95: number | null; errors: number }> = [];
  for (const level of CONCURRENCY_LEVELS) {
    const latencies: number[] = [];
    let errors = 0;
    let next = 0;
    const worker = async () => {
      while (next < REQUESTS_PER_LEVEL) {
        next++;
        const started = Date.now();
        const outcome = await decide('Merhaba, nasılsınız?', [], false);
        if (outcome?.handOver && outcome.reason?.startsWith('ai_')) errors++;
        else latencies.push(Date.now() - started);
      }
    };
    await Promise.all(Array.from({ length: level }, worker));
    out.push({ level, p50: percentile(latencies, 50), p95: percentile(latencies, 95), errors });
    console.log(`concurrency ${level}: p95=${percentile(latencies, 95)} ms, errors=${errors}`);
  }
  return out;
}

/**
 * Five visitors on the demo site (which must be in auto mode, with the backend
 * at E2E_BASE_URL), two messages each. Every visitor message must get exactly
 * one automatic answer and be stored exactly once.
 */
async function runVisitors() {
  const base = process.env.E2E_BASE_URL || 'http://localhost:5050';
  const siteKey = process.env.BENCH_SITE_KEY || 'demo-site-key-0000-1111-2222';
  const visitors = await Promise.all(
    Array.from({ length: 5 }, async (_, n) => {
      const socket = connect(`${base}/widget`, { transports: ['websocket'], forceNew: true });
      const seen: Array<{ _id: string; senderType: string }> = [];
      socket.on('new-message', (data: { message: { _id: string; senderType: string } }) =>
        seen.push(data.message)
      );
      await new Promise((resolve) => {
        socket.once('conversation-joined', resolve);
        socket.emit('join-conversation', { siteKey, visitorId: `bench-${Date.now()}-${n}` });
      });
      for (const [i, content] of ['Merhaba', 'Garanti süresi ne kadar?'].entries()) {
        socket.emit('send-message', { content, clientMessageId: `bench-${n}-${i}` });
        await new Promise((resolve) => setTimeout(resolve, 12000));
      }
      socket.disconnect();
      const unique = new Set(seen.map((m) => m._id));
      return {
        duplicates: seen.length - unique.size,
        visitorMessages: seen.filter((m) => m.senderType === 'visitor').length,
        botMessages: seen.filter((m) => m.senderType === 'bot').length
      };
    })
  );
  return {
    visitors: visitors.length,
    duplicates: visitors.reduce((n, v) => n + v.duplicates, 0),
    missingAnswers: visitors.reduce(
      (n, v) => n + Math.max(0, v.visitorMessages - v.botMessages),
      0
    ),
    extraAnswers: visitors.reduce((n, v) => n + Math.max(0, v.botMessages - v.visitorMessages), 0)
  };
}

// ------------------------------------------------------------------ report

const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!
  );

/** Horizontal bars, one series; the value is written at the end of each bar. */
function barChart(rows: Array<[string, number]>, max: number, unit = '') {
  const rowH = 26;
  const width = 560;
  const labelW = 170;
  const barW = width - labelW - 60;
  const bars = rows
    .map(([label, value], i) => {
      const w = max > 0 ? Math.max(2, (value / max) * barW) : 2;
      const y = i * rowH;
      return `<g><title>${esc(label)}: ${esc(value)}${unit}</title>
        <text x="${labelW - 8}" y="${y + 17}" text-anchor="end" class="t2">${esc(label)}</text>
        <rect x="${labelW}" y="${y + 6}" width="${w.toFixed(1)}" height="14" rx="4" class="s1"/>
        <text x="${labelW + w + 6}" y="${y + 17}" class="t1">${esc(value)}${unit}</text></g>`;
    })
    .join('');
  return `<svg viewBox="0 0 ${width} ${rows.length * rowH + 4}" role="img" class="chart">${bars}</svg>`;
}

/** One series of points over the concurrency levels; single y-axis in ms. */
function lineChart(points: Array<[number, number | null]>) {
  const width = 560;
  const height = 200;
  const pad = { l: 56, r: 20, t: 16, b: 32 };
  const values = points.map(([, v]) => v ?? 0);
  const max = Math.max(1, ...values) * 1.15;
  const x = (i: number) => pad.l + (i * (width - pad.l - pad.r)) / Math.max(1, points.length - 1);
  const y = (v: number) => height - pad.b - (v / max) * (height - pad.t - pad.b);
  const path = points.map(([, v], i) => `${i ? 'L' : 'M'}${x(i)},${y(v ?? 0)}`).join(' ');
  const grid = [0, 0.5, 1]
    .map((f) => {
      const v = Math.round(max * f);
      return `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 6}" y="${y(v) + 4}" text-anchor="end" class="t2">${v}</text>`;
    })
    .join('');
  const dots = points
    .map(
      ([level, v], i) =>
        `<g><title>${level} eşzamanlı: p95 ${v ?? '—'} ms</title><circle cx="${x(i)}" cy="${y(v ?? 0)}" r="5" class="s1 ring"/><text x="${x(i)}" y="${height - 10}" text-anchor="middle" class="t2">${level}</text></g>`
    )
    .join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" class="chart">${grid}<path d="${path}" class="line"/>${dots}</svg>`;
}

/** Expected (rows) against actual (columns); darker is more scenarios. */
function confusionMatrix(results: ScenarioResult[]) {
  const labels = [...new Set(results.flatMap((r) => [r.expected[0], r.decision]))].sort();
  const count = (e: string, a: string) =>
    results.filter((r) => r.expected[0] === e && r.decision === a).length;
  const max = Math.max(1, ...labels.flatMap((e) => labels.map((a) => count(e, a))));
  const head = labels.map((l) => `<th>${esc(l)}</th>`).join('');
  const body = labels
    .map(
      (e) =>
        `<tr><th>${esc(e)}</th>${labels
          .map((a) => {
            const n = count(e, a);
            const step = n ? Math.ceil((n / max) * 4) : 0;
            return `<td class="m${step}" title="beklenen ${esc(e)}, gerçekleşen ${esc(a)}: ${n}">${n || ''}</td>`;
          })
          .join('')}</tr>`
    )
    .join('');
  return `<table class="matrix"><thead><tr><th>beklenen ↓ / gerçekleşen →</th>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function report(summary: Record<string, any>, results: ScenarioResult[]) {
  const categories = [...new Set(results.map((r) => r.category))];
  const byCategory = categories.map((c): [string, number] => {
    const rows = results.filter((r) => r.category === c);
    return [c, Math.round((100 * rows.filter((r) => r.correct).length) / rows.length)];
  });
  const rejections = Object.entries(summary.rejectionsByReason as Record<string, number>);
  const rows = results
    .map(
      (r) =>
        `<tr class="${r.correct && !r.forbidden.length ? '' : 'bad'}"><td>${esc(r.id)}</td><td>${esc(r.expected.join(' | '))}</td><td>${esc(r.decision)}</td><td>${esc(r.reason ?? '')}</td><td>${r.ms}</td><td>${esc(r.content ?? '')}</td><td>${esc([...r.missing.map((m) => `eksik: ${m}`), ...r.forbidden.map((f) => `yasak: ${f}`)].join(', '))}</td></tr>`
    )
    .join('');
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI benchmark</title>
<style>
.viz-root{color-scheme:light;--surface-1:#fcfcfb;--text-primary:#0b0b0b;--text-secondary:#52514e;--grid:#e6e5e0;--series-1:#2a78d6;--seq-1:#dbe9fa;--seq-2:#a9ccf3;--seq-3:#6aa6e8;--seq-4:#2a78d6;--bad:#fdecec}
@media (prefers-color-scheme:dark){:root:where(:not([data-theme="light"])) .viz-root{color-scheme:dark;--surface-1:#1a1a19;--text-primary:#fff;--text-secondary:#c3c2b7;--grid:#34332f;--series-1:#3987e5;--seq-1:#1e3350;--seq-2:#244b7d;--seq-3:#2d66ab;--seq-4:#3987e5;--bad:#3a1f1f}}
body{margin:0;background:var(--surface-1)}
.viz-root{background:var(--surface-1);color:var(--text-primary);font:14px/1.5 system-ui,sans-serif;max-width:980px;margin:0 auto;padding:24px 16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px}.muted{color:var(--text-secondary)}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 0}
.tile{border:1px solid var(--grid);border-radius:8px;padding:12px}.tile b{display:block;font-size:24px}
.chart{width:100%;max-width:560px;height:auto}.t1{fill:var(--text-primary);font-size:12px}.t2{fill:var(--text-secondary);font-size:12px}
.s1{fill:var(--series-1)}.line{fill:none;stroke:var(--series-1);stroke-width:2}.ring{stroke:var(--surface-1);stroke-width:2}.grid{stroke:var(--grid)}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{border:1px solid var(--grid);padding:4px 6px;text-align:left;vertical-align:top}
.matrix td{text-align:center;min-width:44px}.m1{background:var(--seq-1)}.m2{background:var(--seq-2)}.m3{background:var(--seq-3)}.m4{background:var(--seq-4);color:#fff}
tr.bad td{background:var(--bad)}.scroll{overflow-x:auto}
</style></head><body><div class="viz-root">
<h1>AI benchmark</h1>
<p class="muted">Model ${esc(summary.model)} · prompt ${esc(summary.promptVersion)} · ${esc(summary.startedAt)} · ${summary.scenarios} senaryo, eşzamanlılık 1</p>
<div class="tiles">
<div class="tile"><span class="muted">Karar doğruluğu</span><b>${summary.decisionAccuracy}%</b></div>
<div class="tile"><span class="muted">Müşteriye giden yasak bilgi</span><b>${summary.forbiddenSent}</b></div>
<div class="tile"><span class="muted">Temsilci/PII'de devir</span><b>${summary.mustHandoffRate}%</b></div>
<div class="tile"><span class="muted">Doğrulayıcı reddi</span><b>${summary.rejectionRate}%</b></div>
<div class="tile"><span class="muted">Süre p50 / p95</span><b>${summary.latencyP50} / ${summary.latencyP95} ms</b></div>
<div class="tile"><span class="muted">Tepe VRAM</span><b>${summary.vram ? `${summary.vram.usedMb} / ${summary.vram.totalMb} MB` : '—'}</b></div>
</div>
<h2>Kategori bazında başarı (%)</h2>${barChart(byCategory, 100, '%')}
<h2>Karışıklık matrisi</h2><div class="scroll">${confusionMatrix(results)}</div>
<h2>Doğrulayıcının reddettiği cevaplar (neden bazında)</h2>${rejections.length ? barChart(rejections, Math.max(...rejections.map(([, v]) => v))) : '<p class="muted">Reddedilen cevap yok.</p>'}
<h2>Eşzamanlılığa göre p95 süre (ms)</h2>${lineChart((summary.concurrency as any[]).map((c) => [c.level, c.p95]))}
<table><thead><tr><th>eşzamanlı</th><th>p50 ms</th><th>p95 ms</th><th>hata</th></tr></thead><tbody>${(summary.concurrency as any[]).map((c) => `<tr><td>${c.level}</td><td>${c.p50 ?? '—'}</td><td>${c.p95 ?? '—'}</td><td>${c.errors}</td></tr>`).join('')}</tbody></table>
${summary.visitors ? `<h2>Uçtan uca (5 sanal ziyaretçi)</h2><p>Çift mesaj: <b>${summary.visitors.duplicates}</b> · cevapsız mesaj: <b>${summary.visitors.missingAnswers}</b> · fazla cevap: <b>${summary.visitors.extraAnswers}</b></p>` : ''}
<h2>Tüm senaryolar</h2><div class="scroll"><table><thead><tr><th>id</th><th>beklenen</th><th>karar</th><th>neden</th><th>ms</th><th>cevap</th><th>içerik kontrolü</th></tr></thead><tbody>${rows}</tbody></table></div>
</div></body></html>`;
}

// -------------------------------------------------------------------- main

async function main() {
  const args = new Set(process.argv.slice(2));
  const config = aiConfig();
  if (!config) {
    console.error('AI is not configured (AI_ENABLED, AI_API_KEY, AI_MODEL); nothing to measure.');
    process.exit(1);
  }
  const provider = getProvider();
  const state = await provider.state();
  if (state !== 'ready') {
    console.error(`The model is not ready (state: ${state}). Start it and wait for "ready".`);
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  const vram = watchVram();
  const results = await runScenarios();
  const concurrency = await runConcurrency();
  const visitors = args.has('--e2e') ? await runVisitors() : null;
  const peak = vram.stop();

  const sent = results.filter((r) => r.decision !== 'handoff');
  const rejected = results.filter((r) => r.reason?.startsWith('rejected:'));
  const mustHandoff = results.filter(
    (r) => r.category === 'pii' || r.id === 'act-01' || r.id === 'act-08' || r.id === 'en-09'
  );
  const latencies = results.map((r) => r.ms);
  const summary = {
    model: provider.model,
    promptVersion: PROMPT_VERSION,
    startedAt,
    scenarios: results.length,
    decisionAccuracy: Math.round((100 * results.filter((r) => r.correct).length) / results.length),
    categoryAccuracy: Object.fromEntries(
      [...new Set(results.map((r) => r.category))].map((c) => {
        const rows = results.filter((r) => r.category === c);
        return [c, Math.round((100 * rows.filter((r) => r.correct).length) / rows.length)];
      })
    ),
    mustHandoffRate: Math.round(
      (100 * mustHandoff.filter((r) => r.decision === 'handoff').length) / mustHandoff.length
    ),
    forbiddenSent: sent.filter((r) => r.forbidden.length).length,
    rejectionRate: Math.round((100 * rejected.length) / results.length),
    rejectionsByReason: rejected.reduce<Record<string, number>>((acc, r) => {
      const key = String(r.reason).slice('rejected:'.length);
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {}),
    latencyP50: percentile(latencies, 50),
    latencyP95: percentile(latencies, 95),
    concurrency,
    vram: peak,
    visitors
  };

  const dir = path.join(ROOT, '.artifacts/reports', startedAt.replace(/[:.]/g, '-'));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ summary, results }, null, 2));
  fs.writeFileSync(path.join(dir, 'report.html'), report(summary, results));
  if (args.has('--baseline')) {
    fs.mkdirSync(path.join(ROOT, 'benchmarks'), { recursive: true });
    fs.writeFileSync(
      path.join(ROOT, 'benchmarks/baseline.json'),
      JSON.stringify(summary, null, 2) + '\n'
    );
  }
  console.log(
    `\nKarar doğruluğu ${summary.decisionAccuracy}% · yasak bilgi ${summary.forbiddenSent} · p95 ${summary.latencyP95} ms`
  );
  console.log(`Rapor: ${path.join(dir, 'report.html')}`);
}

main().catch((error) => {
  console.error('Benchmark failed:', (error as Error).message);
  process.exit(1);
});
