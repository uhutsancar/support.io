#!/usr/bin/env node
// Size budgets (plan v10 PERF-01), checked in CI after both builds.
//
//   widget.js                     gzip ≤ 35 KB   — it loads on every page of
//                                                  every customer's site
//   panel first load              gzip ≤ 250 KB  — the JavaScript index.html
//                                                  asks for before any route
//                                                  runs (sign-in included)
//
// Prints a table (and appends it to the GitHub step summary when there is
// one) and exits non-zero when a budget is exceeded.
//
//   node scripts/check-bundle-size.mjs

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.dirname(
  path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
);
const KB = 1024;

const gzip = (file) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
const brotli = (file) =>
  zlib.brotliCompressSync(fs.readFileSync(file), {
    params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 11 }
  }).length;

const rows = [];
let failed = false;

function check(name, files, budget) {
  const raw = files.reduce((sum, f) => sum + fs.statSync(f).size, 0);
  const gz = files.reduce((sum, f) => sum + gzip(f), 0);
  const br = files.reduce((sum, f) => sum + brotli(f), 0);
  const ok = gz <= budget;
  if (!ok) failed = true;
  rows.push(
    `| ${name} | ${(raw / KB).toFixed(1)} KB | ${(gz / KB).toFixed(1)} KB | ${(br / KB).toFixed(1)} KB | ${(budget / KB).toFixed(0)} KB | ${ok ? 'ok' : 'OVER'} |`
  );
}

const widget = path.join(root, 'backend/public/widget.js');
if (!fs.existsSync(widget)) {
  console.error('backend/public/widget.js is missing: run `npm run build:widget` in backend first');
  process.exit(1);
}
check('widget.js', [widget], 35 * KB);

const dist = path.join(root, 'admin-panel/dist');
const index = path.join(dist, 'index.html');
if (fs.existsSync(index)) {
  const html = fs.readFileSync(index, 'utf8');
  const refs = new Set();
  for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)) refs.add(m[1]);
  for (const m of html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g))
    refs.add(m[1]);
  const files = [...refs].map((r) => path.join(dist, r.replace(/^\//, '')));
  check(`panel first load (${files.length} files)`, files, 250 * KB);

  // Not budgeted: the ten largest chunks, so a regression is easy to spot.
  const assets = path.join(dist, 'assets');
  const largest = fs
    .readdirSync(assets, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith('.js'))
    .map((f) => ({ f, gz: gzip(path.join(assets, f)) }))
    .sort((a, b) => b.gz - a.gz)
    .slice(0, 10);
  rows.push('', '| largest panel chunks | gzip |', '|---|---|');
  for (const { f, gz } of largest) rows.push(`| ${f} | ${(gz / KB).toFixed(1)} KB |`);
} else {
  rows.push('| panel | (admin-panel/dist not built; skipped) | | | | |');
}

const table = [
  '| asset | raw | gzip | brotli | budget (gzip) | |',
  '|---|---|---|---|---|---|',
  ...rows
].join('\n');
console.log(table);
if (process.env.GITHUB_STEP_SUMMARY) {
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Size budgets\n\n${table}\n`);
}
if (failed) {
  console.error('\nA size budget is exceeded (plan v10 PERF-01).');
  process.exit(1);
}
