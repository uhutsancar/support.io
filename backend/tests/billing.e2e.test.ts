'use strict';

// Paddle billing (plan §9, §21.2):
//
//  - the webhook is verified over the raw body; a bad or missing signature
//    is refused, a good one is applied
//  - an event id is applied once: a repeated delivery is a no-op
//  - an older event never undoes a newer one
//  - a subscription is attached only to the organization its signed checkout
//    reference names
//  - active → plan opens; canceled → the plan lasts until the paid period
//    ends; past_due → the plan lasts for the grace period
//  - every change is recorded as PLAN_CHANGED
//  - the billing page is the owner's; checkout is refused while it is off
//
// Needs the running API with the Paddle values docker-compose.yml gives it
// (the root .env, or the development defaults). Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { getPool, query } from '../src/db/pool';
import { checkoutReference, reconcileSubscriptions } from '../src/services/billing';
import { effectivePlan } from '../src/domain/subscription';
import { BASE } from './helpers/widget';
import { verifyEmail } from './helpers/accounts';

const PASSWORD = 'E2ePassw0rd!';
const SECRET = process.env.PADDLE_WEBHOOK_SECRET || 'local-dev-paddle-webhook-secret';
const PRICE_PRO = process.env.PADDLE_PRICE_PRO || 'pri_local_pro';
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

async function api(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}
) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json, headers: res.headers };
}

function sessionCookie(res: { headers: Headers }): string {
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

async function owner() {
  const email = `owner${stamp()}@billing.test`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: 'Billing Owner', email, password: PASSWORD }
  });
  assert.equal(reg.status, 201);
  await verifyEmail(email);
  return { token: sessionCookie(reg), email, organizationId: String(reg.body.user.organizationId) };
}

/** Signs a body the way Paddle does: h1 = HMAC-SHA256(secret, `${ts}:${body}`). */
function sign(body: string, secret = SECRET, ts = Math.floor(Date.now() / 1000)): string {
  const h1 = crypto.createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex');
  return `ts=${ts};h1=${h1}`;
}

async function deliver(event: object, signature?: string) {
  const body = JSON.stringify(event);
  const res = await fetch(`${BASE}/api/billing/paddle/webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(signature !== '' ? { 'Paddle-Signature': signature ?? sign(body) } : {})
    },
    body
  });
  return res.status;
}

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;

/** A subscription notification shaped like Paddle's (snake_case). */
function subscriptionEvent(
  type: string,
  {
    subscriptionId,
    status,
    organizationId,
    ref,
    occurredAt = iso(0),
    periodEnd = iso(30 * DAY),
    priceId = PRICE_PRO,
    scheduledCancel = false
  }: {
    subscriptionId: string;
    status: string;
    organizationId?: string;
    ref?: string;
    occurredAt?: string;
    periodEnd?: string | null;
    priceId?: string;
    scheduledCancel?: boolean;
  }
) {
  return {
    event_id: `evt_${stamp()}`,
    event_type: type,
    occurred_at: occurredAt,
    notification_id: `ntf_${stamp()}`,
    data: {
      id: subscriptionId,
      status,
      customer_id: `ctm_${subscriptionId}`,
      items: [{ price: { id: priceId }, quantity: 1 }],
      current_billing_period: periodEnd ? { starts_at: iso(-DAY), ends_at: periodEnd } : null,
      scheduled_change: scheduledCancel ? { action: 'cancel', effective_at: periodEnd } : null,
      custom_data: organizationId ? { organizationId, ref } : null
    }
  };
}

async function planOf(organizationId: string): Promise<string> {
  const { rows } = await query('SELECT plan_type FROM organizations WHERE id = $1', [
    organizationId
  ]);
  return rows[0].plan_type;
}

test.after(async () => {
  await getPool().end();
});

test('the plan a subscription gives follows status and time', () => {
  const now = new Date();
  const base = { planType: 'PRO' as const, currentPeriodEnd: null, pastDueSince: null };
  assert.equal(effectivePlan({ ...base, status: 'active' }, now, 7), 'PRO');
  assert.equal(effectivePlan({ ...base, status: 'paused' }, now, 7), 'FREE');
  assert.equal(
    effectivePlan({ ...base, status: 'canceled', currentPeriodEnd: new Date(+now + DAY) }, now, 7),
    'PRO'
  );
  assert.equal(
    effectivePlan({ ...base, status: 'canceled', currentPeriodEnd: new Date(+now - 1) }, now, 7),
    'FREE'
  );
  assert.equal(
    effectivePlan({ ...base, status: 'past_due', pastDueSince: new Date(+now - 6 * DAY) }, now, 7),
    'PRO'
  );
  assert.equal(
    effectivePlan({ ...base, status: 'past_due', pastDueSince: new Date(+now - 8 * DAY) }, now, 7),
    'FREE'
  );
});

test('a webhook without a valid signature is refused and changes nothing', async () => {
  const org = await owner();
  const event = subscriptionEvent('subscription.created', {
    subscriptionId: `sub_${stamp()}`,
    status: 'active',
    organizationId: org.organizationId,
    ref: checkoutReference(org.organizationId)
  });
  const body = JSON.stringify(event);
  assert.equal(await deliver(event, ''), 400, 'missing signature');
  assert.equal(await deliver(event, sign(body, 'not-the-secret')), 400, 'wrong secret');
  assert.equal(
    await deliver(event, sign(body, SECRET, Math.floor(Date.now() / 1000) - 600)),
    400,
    'a replayed, old signature'
  );
  const tampered = sign(body);
  assert.equal(await deliver({ ...event, event_id: 'evt_other' }, tampered), 400, 'a changed body');
  assert.equal(await planOf(org.organizationId), 'FREE');
  const { rows } = await query('SELECT 1 FROM billing_events WHERE provider_event_id = $1', [
    event.event_id
  ]);
  assert.equal(rows.length, 0);
});

test('a signed subscription opens the plan once, and a repeat is a no-op', async () => {
  const org = await owner();
  const event = subscriptionEvent('subscription.created', {
    subscriptionId: `sub_${stamp()}`,
    status: 'active',
    organizationId: org.organizationId,
    ref: checkoutReference(org.organizationId)
  });
  assert.equal(await deliver(event), 200);
  assert.equal(await planOf(org.organizationId), 'PRO');

  // Paddle retries; the same event id is answered 200 and not applied again.
  assert.equal(await deliver(event), 200);
  const audit = await query(
    `SELECT metadata FROM audit_logs WHERE organization_id = $1 AND action = 'PLAN_CHANGED'`,
    [org.organizationId]
  );
  assert.equal(audit.rows.length, 1, 'one change, one audit row');
  assert.equal(audit.rows[0].metadata.from, 'FREE');
  assert.equal(audit.rows[0].metadata.to, 'PRO');
  assert.equal(audit.rows[0].metadata.source, 'paddle');

  const page = await api('/api/billing', { token: org.token });
  assert.equal(page.status, 200);
  assert.equal(page.body.plan, 'PRO');
  assert.equal(page.body.subscription.status, 'active');
  assert.equal(page.body.limits.sites, 3);
});

test('a subscription naming another organization without its reference is ignored', async () => {
  const victim = await owner();
  const forged = subscriptionEvent('subscription.created', {
    subscriptionId: `sub_${stamp()}`,
    status: 'active',
    organizationId: victim.organizationId,
    ref: 'f'.repeat(32)
  });
  assert.equal(await deliver(forged), 200, 'accepted, so Paddle stops retrying');
  assert.equal(await planOf(victim.organizationId), 'FREE');
  const { rows } = await query('SELECT status FROM billing_events WHERE provider_event_id = $1', [
    forged.event_id
  ]);
  assert.equal(rows[0].status, 'ignored');
});

test('an older event never undoes a newer one', async () => {
  const org = await owner();
  const subscriptionId = `sub_${stamp()}`;
  const ref = checkoutReference(org.organizationId);
  const created = subscriptionEvent('subscription.created', {
    subscriptionId,
    status: 'active',
    organizationId: org.organizationId,
    ref,
    occurredAt: iso(-60_000)
  });
  const paused = subscriptionEvent('subscription.paused', {
    subscriptionId,
    status: 'paused',
    occurredAt: iso(-10_000)
  });
  // Delivered out of order: the newer pause first, then the older creation.
  assert.equal(
    await deliver({
      ...paused,
      data: { ...paused.data, custom_data: { organizationId: org.organizationId, ref } }
    }),
    200
  );
  assert.equal(await planOf(org.organizationId), 'FREE');
  assert.equal(await deliver(created), 200);
  assert.equal(await planOf(org.organizationId), 'FREE', 'the stale activation is not applied');
  const { rows } = await query('SELECT status FROM billing_events WHERE provider_event_id = $1', [
    created.event_id
  ]);
  assert.equal(rows[0].status, 'stale');
});

test('canceled keeps the plan until the period ends; past_due for the grace period', async () => {
  const org = await owner();
  const subscriptionId = `sub_${stamp()}`;
  const ref = checkoutReference(org.organizationId);
  assert.equal(
    await deliver(
      subscriptionEvent('subscription.activated', {
        subscriptionId,
        status: 'active',
        organizationId: org.organizationId,
        ref,
        occurredAt: iso(-3000)
      })
    ),
    200
  );
  // Cancelled at the end of a period that has not ended yet.
  assert.equal(
    await deliver(
      subscriptionEvent('subscription.canceled', {
        subscriptionId,
        status: 'canceled',
        occurredAt: iso(-2000),
        periodEnd: iso(5 * DAY)
      })
    ),
    200
  );
  assert.equal(await planOf(org.organizationId), 'PRO', 'paid until the period ends');

  // The period runs out; no webhook comes, the hourly sweep notices.
  await query(
    `UPDATE subscriptions SET current_period_end = now() - interval '1 minute' WHERE organization_id = $1`,
    [org.organizationId]
  );
  const limited = await api('/api/billing', { token: org.token });
  assert.equal(limited.body.plan, 'FREE', 'the server enforces FREE at once');
  await reconcileSubscriptions();
  assert.equal(await planOf(org.organizationId), 'FREE', 'and the sweep writes it down');

  // A new subscription after that: a failed payment keeps the plan for the grace period.
  const second = `sub_${stamp()}`;
  assert.equal(
    await deliver(
      subscriptionEvent('subscription.created', {
        subscriptionId: second,
        status: 'active',
        organizationId: org.organizationId,
        ref,
        occurredAt: iso(-1000)
      })
    ),
    200
  );
  assert.equal(await planOf(org.organizationId), 'PRO');
  assert.equal(
    await deliver(
      subscriptionEvent('subscription.past_due', {
        subscriptionId: second,
        status: 'past_due',
        occurredAt: iso(0)
      })
    ),
    200
  );
  assert.equal(await planOf(org.organizationId), 'PRO', 'inside the grace period');
  await query(
    `UPDATE subscriptions SET past_due_since = now() - interval '8 days' WHERE organization_id = $1`,
    [org.organizationId]
  );
  await reconcileSubscriptions();
  assert.equal(await planOf(org.organizationId), 'FREE', 'after the grace period');
});

test('the billing page is the owner’s, and checkout stays shut while billing is off', async () => {
  const org = await owner();
  const page = await api('/api/billing', { token: org.token });
  assert.equal(page.status, 200);
  assert.equal(page.body.plan, 'FREE');
  assert.equal(page.body.subscription, null);
  assert.equal(typeof page.body.usage.conversations, 'number');
  // Server-side Paddle values never reach the browser.
  const text = JSON.stringify(page.body);
  assert.ok(!text.includes(SECRET), 'no webhook secret in the response');

  if (!page.body.billing.enabled) {
    const checkout = await api('/api/billing/checkout', {
      method: 'POST',
      token: org.token,
      body: { plan: 'PRO' }
    });
    assert.equal(checkout.status, 503);
  }

  const anonymous = await api('/api/billing');
  assert.equal(anonymous.status, 401);
});
