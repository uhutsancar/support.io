// Builds the widget (plan v10 PERF-01/PERF-02, PRD-16): one minified script
// for customers' pages, bundled from src/widget/widget.ts — Turkish and
// English inside — whose gzip size has a budget (scripts/check-bundle-size.mjs).
// `tsc -p tsconfig.widget.json` type-checks it first and writes nothing.
// Local names shrink; the global API (window.SupportChat) and behaviour do not
// change.
//
// The other languages are files of their own, public/widget-locales/<code>.json,
// fetched only by a visitor who reads them (served at /widget/v4/locales/).
//
// It also writes public/widget-version.json with a short content hash, so
// /widget/v4/widget.<hash>.js can be cached for a year (server.ts): that
// name never changes meaning, unlike /widget.js.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';

const LOCALES = 'src/widget/locales';
const BUNDLED = new Set(['tr', 'en']);

async function main() {
  await build({
    entryPoints: ['src/widget/widget.ts'],
    outfile: 'public/widget.js',
    bundle: true,
    format: 'iife',
    minify: true,
    target: 'es2017',
    legalComments: 'none',
    banner: { js: '/*! Support.io widget */' },
    logLevel: 'warning'
  });
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync('public/widget.js'))
    .digest('hex')
    .slice(0, 12);
  fs.writeFileSync('public/widget-version.json', `${JSON.stringify({ hash })}\n`);

  fs.rmSync('public/widget-locales', { recursive: true, force: true });
  fs.mkdirSync('public/widget-locales', { recursive: true });
  for (const file of fs.readdirSync(LOCALES)) {
    const code = path.basename(file, '.json');
    if (!file.endsWith('.json') || BUNDLED.has(code)) continue;
    const strings = JSON.parse(fs.readFileSync(path.join(LOCALES, file), 'utf8'));
    fs.writeFileSync(`public/widget-locales/${code}.json`, JSON.stringify(strings));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
