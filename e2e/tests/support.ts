// Helpers for the browser tests: settings shared with the running API, the
// dev mail outbox, a stand-in customer website and Paddle-shaped webhooks.

import crypto from 'crypto';
import fs from 'fs';
import http from 'http';
import path from 'path';
import type { APIRequestContext } from '@playwright/test';

const ROOT = path.join(__dirname, '..', '..');

function fromEnvFile(file: string, name: string): string | undefined {
  if (!fs.existsSync(file)) return undefined;
  const line = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .find((l) => l.startsWith(`${name}=`));
  return line
    ? line
        .slice(name.length + 1)
        .trim()
        .replace(/^["']|["']$/g, '')
    : undefined;
}

/**
 * A value the API also reads, looked up where the API finds it: the
 * environment, the root .env Compose reads, then backend/.env.
 */
export function shared(name: string, fallback?: string): string {
  const value =
    process.env[name] ||
    fromEnvFile(path.join(ROOT, '.env'), name) ||
    fromEnvFile(path.join(ROOT, 'backend', '.env'), name) ||
    fallback;
  if (!value) throw new Error(`${name} is not set (environment, .env or backend/.env)`);
  return value;
}

/** Path and query of the newest link to `linkPath` mailed to `address`. */
export async function mailedLink(
  request: APIRequestContext,
  address: string,
  linkPath: string
): Promise<string> {
  const pattern = new RegExp(`https?://[^\\s"'<>]*${linkPath}\\?token=[A-Za-z0-9_%.-]+`);
  for (let attempt = 0; attempt < 40; attempt++) {
    const res = await request.get(`/api/dev/outbox?to=${encodeURIComponent(address)}`);
    if (res.status() !== 200)
      throw new Error('the dev outbox is not mounted (MAIL_PROVIDER=console?)');
    const { mails } = (await res.json()) as { mails: { text: string }[] };
    for (const mail of mails) {
      const match = pattern.exec(mail.text);
      if (match) {
        const url = new URL(match[0]);
        return url.pathname + url.search;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`no ${linkPath} mail for ${address}`);
}

/**
 * A customer's website: one page with the install code pasted into it, on
 * its own origin (the site's allowed origin), as a person would deploy it.
 */
export async function customerWebsite(port: number, installCode: string) {
  const page = `<!doctype html>
<html lang="tr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="icon" href="data:,"><title>Örnek Mağaza</title></head>
<body>
  <h1>Örnek Mağaza</h1>
  <p>Ürünlerimiz hakkında sorularınız için sağ alttaki balonu kullanın.</p>
  ${installCode}
</body>
</html>`;
  const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url?.startsWith('/?')) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(page);
    } else {
      res.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(port, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve()))
  };
}

/**
 * What Paddle sends once a sandbox checkout is paid: subscription.created,
 * carrying the organization and the signed reference the checkout was
 * opened with, signed with the notification destination's secret.
 */
export function paidSubscription(
  organizationId: string,
  {
    id = `sub_e2e_${Date.now()}`,
    status = 'active',
    eventType = 'subscription.created',
    occurredAt = Date.now(),
    periodEnd = Date.now() + 30 * 24 * 3600 * 1000,
    price = shared('PADDLE_PRICE_PRO', 'pri_local_pro')
  }: {
    id?: string;
    status?: string;
    eventType?: string;
    occurredAt?: number;
    periodEnd?: number;
    /** The plan's price; Pro unless given. */
    price?: string;
  } = {}
) {
  const jwtSecret = shared('JWT_SECRET');
  const key = crypto
    .createHmac('sha256', jwtSecret)
    .update('support-chat/billing-checkout/v1')
    .digest();
  const ref = crypto.createHmac('sha256', key).update(organizationId).digest('hex').slice(0, 32);
  const now = occurredAt;
  const event = {
    event_id: `evt_${id}_${now}`,
    event_type: eventType,
    occurred_at: new Date(now).toISOString(),
    notification_id: `ntf_${id}_${now}`,
    data: {
      id,
      status,
      customer_id: `ctm_${id}`,
      items: [{ price: { id: price }, quantity: 1 }],
      current_billing_period: {
        starts_at: new Date(periodEnd - 30 * 24 * 3600 * 1000).toISOString(),
        ends_at: new Date(periodEnd).toISOString()
      },
      scheduled_change: null,
      custom_data: { organizationId, ref }
    }
  };
  const body = JSON.stringify(event);
  // The signature's own clock is now, whatever the event says it was.
  const ts = Math.floor(Date.now() / 1000);
  const h1 = crypto
    .createHmac('sha256', shared('PADDLE_WEBHOOK_SECRET', 'local-dev-paddle-webhook-secret'))
    .update(`${ts}:${body}`)
    .digest('hex');
  return { body, signature: `ts=${ts};h1=${h1}` };
}

/** The RFC 6238 code an authenticator app shows for `secret` (base32) now. */
export function totp(secret: string, offsetSteps = 0): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of secret.toUpperCase().replace(/[\s=]/g, '')) {
    value = (value << 5) | alphabet.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000) + offsetSteps));
  const hmac = crypto.createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  return String((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0');
}

/**
 * An owner account set up through the API: e-mail-first sign-up, then the
 * mailed link, which signs the request context in. Returns the CSRF header
 * that context needs for writes.
 */
export async function ownerThroughApi(
  request: APIRequestContext,
  { email, password, name = 'E2E Owner' }: { email: string; password: string; name?: string }
): Promise<{ csrf: Record<string, string> }> {
  const registered = await request.post('/api/auth/register', {
    data: { name, email, password }
  });
  if (registered.status() !== 201) throw new Error(`register: ${registered.status()}`);
  const link = new URL(await mailedLink(request, email, '/verify-email'), 'http://x');
  const verified = await request.post('/api/auth/verify-email', {
    data: { token: link.searchParams.get('token') }
  });
  if (verified.status() !== 200) throw new Error(`verify: ${verified.status()}`);
  const { cookies } = await request.storageState();
  return { csrf: { 'X-CSRF-Token': cookies.find((c) => c.name === 'sc_csrf')?.value ?? '' } };
}
