'use strict';

// Error tracking (plan v10 OBS-01), against a local stand-in for a
// Sentry-compatible service:
//
//  - nothing is sent without SENTRY_DSN
//  - an API failure arrives as one event: type, scrubbed message, relative
//    file names, method and path without the query, the request id — and no
//    e-mail address, token, cookie or body
//  - the same error again within a minute is not sent twice
//  - the panel and widget endpoints answer 204, refuse more than 8 KB, and
//    forward a panel error
//
// Needs the running API for the endpoints. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { closeRedisClient } from '../src/config/redis';
import { requestLogging } from '../src/config/logger';
import { errorHandler } from '../src/http';
import { captureError, framesFrom, resetErrorReporting } from '../src/services/errorReporting';
import { panelTelemetry } from '../src/routes/telemetry';
import { BASE } from './helpers/widget';

interface Received {
  url: string;
  auth: string;
  event: any;
}
const received: Received[] = [];
const sentry = http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const [, , event] = raw.split('\n');
    received.push({
      url: req.url || '',
      auth: String(req.headers['x-sentry-auth'] || ''),
      event: JSON.parse(event)
    });
    res.writeHead(200);
    res.end('{}');
  });
});

let dsn = '';
const saved = process.env.SENTRY_DSN;

test.before(async () => {
  await new Promise<void>((resolve) => sentry.listen(0, '127.0.0.1', resolve));
  dsn = `http://publickey@127.0.0.1:${(sentry.address() as AddressInfo).port}/42`;
});

test.beforeEach(() => {
  received.length = 0;
  resetErrorReporting();
});

test.after(async () => {
  if (saved === undefined) delete process.env.SENTRY_DSN;
  else process.env.SENTRY_DSN = saved;
  sentry.close();
  await closeRedisClient();
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

test('nothing leaves without SENTRY_DSN', async () => {
  delete process.env.SENTRY_DSN;
  captureError(new Error('boom'), { source: 'api' });
  await settle();
  assert.equal(received.length, 0);
});

test('an API failure arrives once, scrubbed, with its request id', async () => {
  process.env.SENTRY_DSN = dsn;
  const app = express();
  app.use(requestLogging);
  app.get('/api/explode', () => {
    throw new Error(
      'insert failed for ayse.yilmaz@example.com with token eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlLXZhbHVl'
    );
  });
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const res = await fetch(`${url}/api/explode?reset=secret-token-123`, {
      headers: { Cookie: 'sc_session=very-secret', 'X-Request-Id': 'req-0123456789' }
    });
    assert.equal(res.status, 500);
    const again = await fetch(`${url}/api/explode`);
    assert.equal(again.status, 500);
    await settle();
  } finally {
    server.close();
  }

  assert.equal(received.length, 1, 'the same error twice in a minute is sent once');
  const [{ url: path, auth, event }] = received;
  assert.equal(path, '/api/42/envelope/');
  assert.match(auth, /sentry_key=publickey/);
  const raw = JSON.stringify(event);
  for (const secret of [
    'ayse.yilmaz@example.com',
    'eyJhbGciOi',
    'secret-token-123',
    'very-secret'
  ]) {
    assert.ok(!raw.includes(secret), `${secret} is not sent`);
  }
  assert.match(event.exception.values[0].value, /a\*\*\*@e\*\*\*\.com/);
  assert.deepEqual(event.request, { method: 'GET', url: '/api/explode' });
  assert.equal(event.tags.source, 'api');
  assert.equal(event.tags.request_id, 'req-0123456789');
  const frames = event.exception.values[0].stacktrace.frames;
  assert.ok(frames.length > 0);
  assert.ok(
    frames.every(
      (f: { filename: string }) =>
        !/^[A-Za-z]:\\|^\//.test(f.filename) || f.filename.includes('node:')
    ),
    'file names are relative'
  );
});

test('stack frames: oldest first, no query strings', () => {
  const frames = framesFrom(
    'Error: x\n    at inner (https://app.example/assets/a.js?v=1:10:5)\n    at outer (https://app.example/assets/b.js:20:7)'
  );
  assert.deepEqual(
    frames.map((f) => [f.function, f.filename, f.lineno]),
    [
      ['outer', 'https://app.example/assets/b.js', 20],
      ['inner', 'https://app.example/assets/a.js', 10]
    ]
  );
});

test('the panel endpoint forwards a report, scrubbed', async () => {
  process.env.SENTRY_DSN = dsn;
  const app = express();
  app.use('/api/telemetry/panel', panelTelemetry);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const res = await fetch(`${url}/api/telemetry/panel`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        type: 'TypeError',
        message: 'Cannot read x of undefined (owner@shop.example)',
        stack: 'TypeError: x\n    at render (https://app.example/assets/index.js:1:200)',
        path: '/verify-email?token=abc',
        release: 'sha-1234567'
      })
    });
    assert.equal(res.status, 204);
    await settle();
  } finally {
    server.close();
  }
  assert.equal(received.length, 1);
  const { event } = received[0];
  assert.equal(event.tags.source, 'panel');
  assert.equal(event.platform, 'javascript');
  assert.equal(event.release, 'sha-1234567');
  assert.deepEqual(event.request, { url: '/verify-email' });
  assert.ok(!JSON.stringify(event).includes('owner@shop.example'));
});

test('the running API answers the report endpoints with 204 and caps them', async () => {
  for (const path of ['/api/telemetry/panel', '/api/widget/telemetry']) {
    const ok = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ type: 'Error', code: 'SESSION_FAILED', message: 'x' })
    });
    assert.equal(ok.status, 204, path);
    const huge = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ message: 'x'.repeat(9000) })
    });
    assert.equal(huge.status, 413, path);
  }
});
