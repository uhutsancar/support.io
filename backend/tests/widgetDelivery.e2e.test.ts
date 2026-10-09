'use strict';

// How the widget script is served (plan v10 PERF-01, PERF-02): minified and
// inside its gzip budget, with a short cache on the names whose content
// changes with each deploy, and a year-long immutable cache only on the name
// that carries the content hash.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { BASE } from './helpers/widget';

const { hash } = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../public/widget-version.json'), 'utf8')
) as { hash: string };

test('the names that change get a short cache; the hashed name a year', async () => {
  for (const name of ['/widget.js', '/widget/v4/widget.js', '/widget/v3/widget.js', '/embed.js']) {
    const res = await fetch(`${BASE}${name}`);
    assert.equal(res.status, 200, name);
    assert.match(res.headers.get('content-type') || '', /application\/javascript/);
    assert.equal(
      res.headers.get('cache-control'),
      'public, max-age=300, stale-while-revalidate=86400',
      name
    );
    assert.ok(res.headers.get('etag'), `${name} can be revalidated`);
  }
  const pinned = await fetch(`${BASE}/widget/v4/widget.${hash}.js`);
  assert.equal(pinned.status, 200);
  assert.equal(pinned.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  // An old hash still gets a working widget, just not for a year.
  const old = await fetch(`${BASE}/widget/v4/widget.000000000000.js`);
  assert.equal(old.status, 200);
  assert.match(old.headers.get('cache-control') || '', /max-age=300/);
});

test('the script is minified and inside its 35 KB gzip budget', async () => {
  const body = Buffer.from(await (await fetch(`${BASE}/widget.js`)).arrayBuffer());
  assert.ok(body.toString('utf8').startsWith('/*! Support.io widget */'));
  const gzipped = zlib.gzipSync(body, { level: 9 }).length;
  assert.ok(gzipped <= 35 * 1024, `${gzipped} bytes gzip`);
  assert.ok(body.length < 100 * 1024, `${body.length} bytes raw, minified`);
});
