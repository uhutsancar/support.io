// Asking the shop's own order service about a customer's orders.
//
// The model cannot know where an order is; the shop does. For a customer the
// shop has vouched for (services/identity.ts) we call an endpoint the shop
// runs, and hand the model only a handful of cleaned fields from the answer.
//
// The endpoint is a URL a tenant typed into the panel, so every call is made as
// if the URL were hostile:
//
//   * https only (plain http to localhost is allowed outside production, for
//     the demo service);
//   * the host is resolved here and every address checked: private, loopback,
//     link-local and cloud-metadata ranges are refused, and the connection is
//     pinned to the address that was checked, so a DNS answer that changes
//     between the check and the connect cannot redirect it inward;
//   * no redirects are followed, the answer must be JSON and under 64 KB, and
//     the whole call has a short timeout;
//   * the request is signed (HMAC over timestamp and body) so the shop can
//     tell it came from us, and it carries only the verified user id and an
//     order number — nothing the visitor typed about themselves;
//   * each organization has a per-minute budget.
//
// Order data is never logged. Only the sentence the assistant sends ends up in
// the conversation.

import crypto from 'crypto';
import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';
import { open } from '../config/secretBox';
import { aiConfig } from '../config/ai';
import { isProduction } from '../config/env';
import { createQuota } from '../middleware/rateLimit';
import type { Doc } from '../db/model';
import type { SiteDoc } from '../models/Site';

export interface OrderSummary {
  orderNumber: string;
  status: string | null;
  statusText: string | null;
  placedAt: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  estimatedDelivery: string | null;
}

export type OrderLookupFailure =
  | 'disabled'
  | 'rate_limited'
  | 'unsafe_url'
  | 'timeout'
  | 'http_error'
  | 'bad_response'
  | 'too_large';

export type OrderLookupResult =
  { ok: true; orders: OrderSummary[] } | { ok: false; reason: OrderLookupFailure };

const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_ORDERS = 10;
const MAX_FIELD = 200;
const LOOKUPS_PER_MINUTE = 30;
const DEFAULT_TIMEOUT_MS = 3000;

const quota = createQuota({ name: 'order-lookup', windowMs: 60 * 1000, max: LOOKUPS_PER_MINUTE });

// Addresses a tenant's URL must never reach: this machine, the private
// network behind it, and the cloud metadata service.
const BLOCKED = new net.BlockList();
for (const [prefix, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const) {
  BLOCKED.addSubnet(prefix, bits, 'ipv4');
}
for (const [prefix, bits] of [
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
  ['2001:db8::', 32],
  ['64:ff9b::', 96]
] as const) {
  BLOCKED.addSubnet(prefix, bits, 'ipv6');
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

function isBlocked(address: string, family: number): boolean {
  // An IPv4 address written as IPv6 (::ffff:10.0.0.1) is checked as IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return BLOCKED.check(mapped[1], 'ipv4');
  return BLOCKED.check(address, family === 6 ? 'ipv6' : 'ipv4');
}

/** A parsed URL a request may go to, or null. Development may use local http. */
export function acceptableOrderUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const local = !isProduction && LOCAL_HOSTS.has(url.hostname.replace(/^\[|\]$/g, ''));
  if (url.protocol === 'https:') return url;
  return local && url.protocol === 'http:' ? url : null;
}

/** Resolves the host and returns one address that is safe to connect to. */
async function resolveSafely(url: URL): Promise<{ address: string; family: number } | null> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const local = !isProduction && LOCAL_HOSTS.has(host);
  // A host that does not resolve is simply not usable; there is nothing to report.
  const addresses = await dns.promises.lookup(host, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length) return null;
  // Every answer is checked, not just the first: a host that resolves to one
  // public and one private address must not be usable to reach the private one.
  if (!local && addresses.some((a) => isBlocked(a.address, a.family))) return null;
  return addresses[0];
}

/** The URL, when it is acceptable and resolves only to addresses we may reach. */
export async function checkOrderUrl(value: unknown): Promise<URL | null> {
  const url = acceptableOrderUrl(value);
  if (!url) return null;
  return (await resolveSafely(url)) ? url : null;
}

export function signBody(secret: string, timestamp: number, body: string): string {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, MAX_FIELD) : null;

/** Keeps the fields the model may see and drops everything else the shop sent. */
export function cleanOrders(data: unknown): OrderSummary[] | null {
  if (
    typeof data !== 'object' ||
    data === null ||
    !Array.isArray((data as { orders?: unknown }).orders)
  ) {
    return null;
  }
  const orders: OrderSummary[] = [];
  for (const raw of (data as { orders: unknown[] }).orders.slice(0, MAX_ORDERS)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const o = raw as Record<string, unknown>;
    const orderNumber = text(o.orderNumber);
    if (!orderNumber) continue;
    const trackingUrl = text(o.trackingUrl);
    orders.push({
      orderNumber,
      status: text(o.status),
      statusText: text(o.statusText),
      placedAt: text(o.placedAt),
      carrier: text(o.carrier),
      trackingNumber: text(o.trackingNumber),
      // A link the assistant repeats to a customer: web links only.
      trackingUrl: trackingUrl && /^https?:\/\//i.test(trackingUrl) ? trackingUrl : null,
      estimatedDelivery: text(o.estimatedDelivery)
    });
  }
  return orders;
}

/** One signed POST, pinned to a checked address. */
function post(
  url: URL,
  target: { address: string; family: number },
  headers: Record<string, string>,
  body: string,
  timeoutMs: number
): Promise<OrderLookupResult> {
  return new Promise((resolve) => {
    const client = url.protocol === 'https:' ? https : http;
    let settled = false;
    const finish = (result: OrderLookupResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const req = client.request(
      url,
      {
        method: 'POST',
        headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
        // The connection goes to the address checked above, never to a fresh
        // DNS answer. TLS still verifies the certificate for the hostname.
        lookup: (_host, options, callback) => {
          const all = (options as { all?: boolean }).all;
          if (all) (callback as (e: null, a: object[]) => void)(null, [target]);
          else
            (callback as (e: null, a: string, f: number) => void)(
              null,
              target.address,
              target.family
            );
        }
      },
      (res) => {
        // A redirect is not followed: its target was never checked.
        if (res.statusCode !== 200) {
          res.resume();
          return finish({ ok: false, reason: 'http_error' });
        }
        if (!/application\/json/i.test(String(res.headers['content-type'] || ''))) {
          res.resume();
          return finish({ ok: false, reason: 'bad_response' });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > MAX_RESPONSE_BYTES) {
            req.destroy();
            return finish({ ok: false, reason: 'too_large' });
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          } catch {
            return finish({ ok: false, reason: 'bad_response' });
          }
          const orders = cleanOrders(parsed);
          finish(orders ? { ok: true, orders } : { ok: false, reason: 'bad_response' });
        });
        res.on('error', () => finish({ ok: false, reason: 'http_error' }));
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      finish({ ok: false, reason: 'timeout' });
    }, timeoutMs);

    req.on('error', () => finish({ ok: false, reason: 'http_error' }));
    req.end(body);
  });
}

type OrderSite = Pick<Doc<SiteDoc>, 'organizationId' | 'integrations'>;

/**
 * The verified customer's orders, optionally narrowed to one number.
 *
 * `userId` must be the id identity verification produced — never anything the
 * visitor typed.
 */
export async function lookupOrders(
  site: OrderSite,
  userId: string,
  orderNumber: string | null
): Promise<OrderLookupResult> {
  if (!site.integrations?.orderLookup?.enabled) return { ok: false, reason: 'disabled' };
  return callOrderService(site, userId, orderNumber);
}

/**
 * The panel's "test connection": the same signed call for a user id no shop
 * has, before the integration is switched on. A healthy service answers with
 * an empty list.
 */
export function testOrderService(site: OrderSite): Promise<OrderLookupResult> {
  return callOrderService(site, '__supportio_connection_test__', null);
}

async function callOrderService(
  site: OrderSite,
  userId: string,
  orderNumber: string | null
): Promise<OrderLookupResult> {
  const settings = site.integrations?.orderLookup;
  const secret = open(settings?.signingSecret);
  if (!settings || !secret) return { ok: false, reason: 'disabled' };

  const url = acceptableOrderUrl(settings.url);
  if (!url) return { ok: false, reason: 'unsafe_url' };

  if (!(await quota.take(String(site.organizationId)))) {
    return { ok: false, reason: 'rate_limited' };
  }

  const target = await resolveSafely(url);
  if (!target) return { ok: false, reason: 'unsafe_url' };

  const body = JSON.stringify({ userId, orderNumber });
  const timestamp = Math.floor(Date.now() / 1000);
  return post(
    url,
    target,
    {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-SupportIO-Timestamp': String(timestamp),
      'X-SupportIO-Signature': `sha256=${signBody(secret, timestamp, body)}`
    },
    body,
    aiConfig()?.orderLookupTimeoutMs ?? DEFAULT_TIMEOUT_MS
  );
}
