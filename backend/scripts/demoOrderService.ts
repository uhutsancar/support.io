'use strict';

// `npm run demo:orders` — a stand-in for a shop's order service, for the demo.
//
// Development only; the production image does not contain it. It implements
// the contract a real shop implements (see ai/README.md):
//
//   POST /support-io/orders
//   X-SupportIO-Timestamp: <unix seconds>
//   X-SupportIO-Signature: sha256=<HMAC(signingKey, timestamp + "." + body)>
//   {"userId": "...", "orderNumber": "..." | null}
//
// and refuses anything that is not signed with the demo key within the last
// five minutes — which is also what a real shop has to do.
//
// Run it where the backend runs, so the demo site's URL (localhost) reaches it:
//
//   docker compose exec -d backend npm run demo:orders

import '../src/config/env';
import crypto from 'crypto';
import http from 'http';
import { DEMO_CUSTOMER, DEMO_ORDER_SERVICE_PORT, DEMO_ORDER_SIGNING_SECRET } from '../src/db/demo';

const MAX_SKEW_SECONDS = 300;
const MAX_BODY = 16 * 1024;

const ORDERS: Record<string, Array<Record<string, string>>> = {
  [DEMO_CUSTOMER.userId]: [
    {
      orderNumber: '12345',
      status: 'shipped',
      statusText: 'Kargoya verildi',
      placedAt: '2026-09-20',
      carrier: 'Örnek Kargo',
      trackingNumber: 'TR123456789',
      trackingUrl: 'https://kargo.example.com/takip/TR123456789',
      estimatedDelivery: '2026-09-25',
      // Never forwarded: the backend keeps only the fields the model may see.
      shippingAddress: 'Örnek Mah. 1. Sok. No:1 İstanbul',
      phone: '05550000000'
    },
    {
      orderNumber: '12001',
      status: 'delivered',
      statusText: 'Teslim edildi',
      placedAt: '2026-09-02',
      carrier: 'Örnek Kargo',
      trackingNumber: 'TR120010001',
      trackingUrl: 'https://kargo.example.com/takip/TR120010001',
      estimatedDelivery: '2026-09-05'
    }
  ]
};

function validSignature(
  timestamp: string | undefined,
  signature: string | undefined,
  body: string
) {
  const seconds = Number(timestamp);
  if (!Number.isInteger(seconds) || Math.abs(Date.now() / 1000 - seconds) > MAX_SKEW_SECONDS) {
    return false;
  }
  const expected = Buffer.from(
    `sha256=${crypto.createHmac('sha256', DEMO_ORDER_SIGNING_SECRET).update(`${seconds}.${body}`).digest('hex')}`
  );
  const given = Buffer.from(String(signature || ''));
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function reply(res: http.ServerResponse, status: number, payload: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/support-io/orders') return reply(res, 404, {});

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > MAX_BODY) req.destroy();
  });
  req.on('end', () => {
    const ok = validSignature(
      req.headers['x-supportio-timestamp'] as string | undefined,
      req.headers['x-supportio-signature'] as string | undefined,
      body
    );
    if (!ok) {
      console.log('[demo-orders] 401 bad or stale signature');
      return reply(res, 401, { error: 'invalid signature' });
    }

    let request: { userId?: unknown; orderNumber?: unknown };
    try {
      request = JSON.parse(body);
    } catch {
      return reply(res, 400, { error: 'invalid json' });
    }
    const all = ORDERS[String(request.userId)] ?? [];
    const orders = request.orderNumber
      ? all.filter((o) => o.orderNumber === String(request.orderNumber))
      : all;
    // Counts only: a real service would not log a customer's orders either.
    console.log(`[demo-orders] 200 orders=${orders.length}`);
    reply(res, 200, { orders });
  });
});

server.listen(DEMO_ORDER_SERVICE_PORT, '127.0.0.1', () => {
  console.log(
    `Demo sipariş servisi http://localhost:${DEMO_ORDER_SERVICE_PORT}/support-io/orders adresinde.`
  );
});
