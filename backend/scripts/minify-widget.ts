// Minifies the compiled widget in place (plan v10 PERF-01/PERF-02): the
// widget is a single script on customers' pages, and its gzip size has a
// budget (scripts/check-bundle-size.mjs). Local names shrink; the global API
// (window.SupportChat) and behaviour do not change.
//
// It also writes public/widget-version.json with a short content hash, so
// /widget/v4/widget.<hash>.js can be cached for a year (server.ts): that
// name never changes meaning, unlike /widget.js.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { build } from 'esbuild';

async function main() {
  await build({
    entryPoints: ['public/widget.js'],
    outfile: 'public/widget.js',
    allowOverwrite: true,
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
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
