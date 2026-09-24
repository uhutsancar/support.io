'use strict';

// Calling a shop's order service, against a fake shop on 127.0.0.1.
//
// The URL is something a tenant typed, so these tests are mostly about what
// the call refuses to do: reach a private address, follow a redirect, read a
// huge or non-JSON answer, wait forever, or pass a customer's address and phone
// on to the model. They also pin the request a shop receives — signed, with a
// fresh timestamp, carrying only the verified user id and an order number.
//
// Runs in-process (NODE_ENV is not production, so the local fake is allowed).

import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { generateId } from '../src/db/objectId';
import { seal } from '../src/config/secretBox';
import { closeRedisClient } from '../src/config/redis';
import {
  acceptableOrderUrl,
  checkOrderUrl,
  cleanOrders,
  lookupOrders,
  signBody,
  testOrderService
} from '../src/services/orderLookup';

const SECRET = 's'.repeat(64);

type Handler = (req: http.IncomingMessage, body: string, res: http.ServerResponse) => void;

async function fakeShop(handler: Handler) {
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => handler(req, body, res));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/support-io/orders`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      })
  };
}

/** A site whose order lookup points at `url`; a fresh organization per call. */
function siteFor(url: string, enabled = true) {
  return {
    organizationId: generateId(),
    integrations: {
      identitySecret: null,
      orderLookup: { enabled, url, signingSecret: seal(SECRET) }
    }
  };
}

const ORDER = {
  orderNumber: '12345',
  status: 'shipped',
  statusText: 'Kargoya verildi',
  placedAt: '2026-09-20',
  carrier: 'Örnek Kargo',
  trackingNumber: 'TR123',
  trackingUrl: 'https://kargo.example.com/TR123',
  estimatedDelivery: '2026-09-25'
};

function json(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

test('the shop receives a signed, timestamped request with only the verified id and number', async (t) => {
  let seen: { headers?: http.IncomingHttpHeaders; body?: string } = {};
  const shop = await fakeShop((req, body, res) => {
    seen = { headers: req.headers, body };
    json(res, 200, { orders: [{ ...ORDER, shippingAddress: 'Gizli Sok. 1', phone: '0555' }] });
  });
  t.after(shop.close);

  const result = await lookupOrders(siteFor(shop.url), 'customer-7', '12345');
  assert.ok(result.ok);
  assert.deepEqual(result.orders, [ORDER], 'fields beyond the contract must be dropped');

  const timestamp = Number(seen.headers?.['x-supportio-timestamp']);
  assert.ok(Math.abs(Date.now() / 1000 - timestamp) < 5, 'the timestamp must be fresh');
  assert.equal(
    seen.headers?.['x-supportio-signature'],
    `sha256=${signBody(SECRET, timestamp, seen.body as string)}`
  );
  assert.deepEqual(JSON.parse(seen.body as string), { userId: 'customer-7', orderNumber: '12345' });
});

test('a switched-off integration makes no request at all', async (t) => {
  let calls = 0;
  const shop = await fakeShop((_req, _body, res) => {
    calls++;
    json(res, 200, { orders: [] });
  });
  t.after(shop.close);

  assert.deepEqual(await lookupOrders(siteFor(shop.url, false), 'u', null), {
    ok: false,
    reason: 'disabled'
  });
  assert.equal(calls, 0);
  // The panel's connection test works before the switch is turned on.
  assert.deepEqual(await testOrderService(siteFor(shop.url, false)), { ok: true, orders: [] });
  assert.equal(calls, 1);
});

test('slow, redirecting, oversized and non-JSON answers are refused', async (t) => {
  let mode = '';
  const shop = await fakeShop((_req, _body, res) => {
    if (mode === 'slow') return; // never answers
    if (mode === 'redirect') {
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data' });
      return res.end();
    }
    if (mode === 'huge') return json(res, 200, { orders: [], pad: 'x'.repeat(70 * 1024) });
    if (mode === 'html') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      return res.end('<html></html>');
    }
    if (mode === 'error') return json(res, 500, {});
    if (mode === 'shape') return json(res, 200, { notOrders: true });
  });
  t.after(shop.close);

  const expectations: Array<[string, string]> = [
    ['slow', 'timeout'],
    ['redirect', 'http_error'],
    ['huge', 'too_large'],
    ['html', 'bad_response'],
    ['error', 'http_error'],
    ['shape', 'bad_response']
  ];
  for (const [m, reason] of expectations) {
    mode = m;
    const result = await lookupOrders(siteFor(shop.url), 'u', null);
    assert.deepEqual(result, { ok: false, reason }, m);
  }
});

test('only https, or local http outside production, and never a private address', async () => {
  assert.ok(acceptableOrderUrl('https://shop.example.com/orders'));
  assert.ok(acceptableOrderUrl('http://localhost:5055/support-io/orders'));
  assert.equal(acceptableOrderUrl('http://shop.example.com/orders'), null);
  assert.equal(acceptableOrderUrl('https://user:pass@shop.example.com/'), null);
  assert.equal(acceptableOrderUrl('ftp://shop.example.com/'), null);
  assert.equal(acceptableOrderUrl('not a url'), null);

  for (const url of [
    'https://10.0.0.8/orders',
    'https://192.168.1.10/orders',
    'https://172.20.0.5/orders',
    'https://169.254.169.254/latest/meta-data',
    'https://[fd00::1]/orders',
    'https://[::ffff:10.0.0.1]/orders'
  ]) {
    assert.equal(await checkOrderUrl(url), null, `${url} must be refused`);
  }
});

test('each organization has a per-minute budget', async (t) => {
  const shop = await fakeShop((_req, _body, res) => json(res, 200, { orders: [] }));
  t.after(shop.close);

  const site = siteFor(shop.url);
  const results = [];
  for (let i = 0; i < 31; i++) results.push(await lookupOrders(site, 'u', null));
  assert.ok(results.slice(0, 30).every((r) => r.ok));
  assert.deepEqual(results[30], { ok: false, reason: 'rate_limited' });
});

test('order data is cleaned to the contract fields', () => {
  assert.equal(cleanOrders(null), null);
  assert.equal(cleanOrders({ orders: 'x' }), null);
  const cleaned = cleanOrders({
    orders: [
      { ...ORDER, trackingUrl: 'javascript:alert(1)', email: 'a@b.c' },
      { status: 'no number' },
      ...Array.from({ length: 20 }, (_, i) => ({ orderNumber: String(i) }))
    ]
  });
  assert.ok(cleaned);
  // Only the first ten entries are read at all; the one without a number is dropped.
  assert.equal(cleaned.length, 9);
  assert.equal(cleaned[0].trackingUrl, null, 'only web links survive');
  assert.ok(!('email' in cleaned[0]));
});

test.after(async () => {
  // The per-organization budget keeps its counter in Redis when REDIS_URL is set.
  await closeRedisClient();
});
