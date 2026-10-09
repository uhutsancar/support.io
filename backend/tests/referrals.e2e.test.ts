'use strict';

// The referral programme (plan v10 PRD-23): an owner's link carries a code;
// a workspace that signs up with it — by form or with Google — is recorded
// once; it qualifies when Paddle says its first paid subscription is active
// (the real webhook, signed); the referrer's free month is then given as a
// one-time Paddle discount on their next bill, once, and only while they
// have a live subscription. Paddle itself is replaced by a recorder here:
// applying the discount for real needs the owner's Paddle account.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { generateId } from '../src/db/objectId';
import { checkoutReference } from '../src/services/billing';
import {
  recordReferral,
  referralSummary,
  sweepReferralRewards,
  useRewardApplier
} from '../src/services/referrals';
import { outboxFor } from '../src/services/mail/console';
// The audit trail listens to events, as it does in the API process.
import '../src/services/auditService';
import { signUp } from './helpers/accounts';
import { BASE } from './helpers/widget';

const SECRET = process.env.PADDLE_WEBHOOK_SECRET || 'local-dev-paddle-webhook-secret';
const PRICE_PRO = process.env.PADDLE_PRICE_PRO || 'pri_local_pro';
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;
const applied: Array<[string, string]> = [];

test.before(() => {
  process.env.PADDLE_REFERRAL_DISCOUNT_ID = 'dsc_testfreemonth';
  useRewardApplier({
    async apply(subscriptionId, discountId) {
      applied.push([subscriptionId, discountId]);
      return `recorded:${subscriptionId}`;
    }
  });
});

test.after(async () => {
  useRewardApplier(null);
  delete process.env.PADDLE_REFERRAL_DISCOUNT_ID;
  await closeRedisClient();
  await getPool().end();
});

async function owner(label: string, extra: Record<string, unknown> = {}) {
  const email = `${label}${stamp()}@referral.test`;
  const reg = await signUp({ name: `${label} owner`, email, password: 'E2ePassw0rd!', ...extra });
  const token = decodeURIComponent(
    /(?:^|,\s*)sc_session=([^;]+)/.exec(reg.headers.get('set-cookie') || '')?.[1] || ''
  );
  return { email, token, organizationId: String(reg.body.user.organizationId) };
}

async function referredBy(organizationId: string): Promise<string | null> {
  const { rows } = await query(
    'SELECT referrer_organization_id FROM referrals WHERE referred_organization_id = $1',
    [organizationId]
  );
  return rows[0]?.referrer_organization_id ?? null;
}

/** Paddle's "subscription.created", active, signed as Paddle signs it. */
async function paysFor(organizationId: string) {
  const subscriptionId = `sub_ref_${stamp()}`;
  const body = JSON.stringify({
    event_id: `evt_${stamp()}`,
    event_type: 'subscription.created',
    occurred_at: new Date().toISOString(),
    notification_id: `ntf_${stamp()}`,
    data: {
      id: subscriptionId,
      status: 'active',
      customer_id: `ctm_${subscriptionId}`,
      items: [{ price: { id: PRICE_PRO }, quantity: 1 }],
      current_billing_period: {
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 86_400_000).toISOString()
      },
      scheduled_change: null,
      custom_data: { organizationId, ref: checkoutReference(organizationId) }
    }
  });
  const ts = Math.floor(Date.now() / 1000);
  const h1 = crypto.createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex');
  const res = await fetch(`${BASE}/api/billing/paddle/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Paddle-Signature': `ts=${ts};h1=${h1}` },
    body
  });
  assert.equal(res.status, 200);
  return subscriptionId;
}

test('the owner’s link, and a sign-up through it recorded once', async () => {
  const a = await owner('refa');
  const res = await fetch(`${BASE}/api/auth/referral`, {
    headers: { Authorization: `Bearer ${a.token}` }
  });
  assert.equal(res.status, 200);
  const link = (await res.json()) as { code: string; link: string; joined: number };
  assert.match(link.code, /^[A-HJKMNP-Z2-9]{8}$/);
  assert.match(link.link, new RegExp(`/register\\?ref=${link.code}$`));
  assert.equal(link.joined, 0);

  const b = await owner('refb', { referralCode: link.code.toLowerCase() });
  assert.equal(await referredBy(b.organizationId), a.organizationId);
  // A second code later changes nothing; a workspace cannot refer itself.
  assert.equal(await recordReferral(link.code, b.organizationId), false);
  assert.equal(await recordReferral(link.code, a.organizationId), false);
  // A wrong code is ignored; the sign-up goes on as if there were none.
  const c = await owner('refc', { referralCode: 'NOTACODE' });
  assert.equal(await referredBy(c.organizationId), null);
  assert.equal((await referralSummary(a.organizationId)).joined, 1);
});

test('a referred workspace that pays earns its referrer one free month, once', async () => {
  const a = await owner('rewarda');
  const { code } = await referralSummary(a.organizationId);
  const b = await owner('rewardb', { referralCode: code });

  // B pays: the referral qualifies through Paddle's webhook. A has no paid
  // subscription yet, so the month waits.
  await paysFor(b.organizationId);
  const { rows } = await query(
    'SELECT qualified_at, rewarded_at FROM referrals WHERE referred_organization_id = $1',
    [b.organizationId]
  );
  assert.ok(rows[0].qualified_at, 'qualified by the webhook');
  assert.equal(rows[0].rewarded_at, null);
  assert.equal(await sweepReferralRewards(), 0);

  // A subscribes; the sweep gives the month on A's next bill.
  const aSubscription = await paysFor(a.organizationId);
  assert.ok((await sweepReferralRewards()) >= 1);
  assert.deepEqual(
    applied.filter(([sub]) => sub === aSubscription),
    [[aSubscription, 'dsc_testfreemonth']]
  );
  await sweepReferralRewards();
  assert.equal(applied.filter(([sub]) => sub === aSubscription).length, 1, 'given once');

  const summary = await referralSummary(a.organizationId);
  assert.deepEqual(
    { joined: summary.joined, qualified: summary.qualified, rewarded: summary.rewarded },
    { joined: 1, qualified: 1, rewarded: 1 }
  );
  assert.ok(
    outboxFor(a.email).some((m) => /bir ay bizden/.test(m.subject)),
    'A is told'
  );
  let audited = 0;
  for (let i = 0; i < 30 && !audited; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const audit = await query(
      `SELECT count(*)::int AS n FROM audit_logs WHERE organization_id = $1 AND action = 'REFERRAL_REWARDED'`,
      [a.organizationId]
    );
    audited = audit.rows[0].n;
    // eslint-disable-next-line no-await-in-loop
    if (!audited) await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.equal(audited, 1);
});

test('only the owner sees the link', async () => {
  const a = await owner('refrole');
  const memberId = generateId();
  // An admin in the same workspace (the team table) is turned away.
  await query(
    `INSERT INTO teams (id, organization_id, name, email, password, role, is_active, email_verified_at)
     VALUES ($1, $2, 'Admin', $3, '!', 'admin', true, now())`,
    [memberId, a.organizationId, `admin${stamp()}@referral.test`]
  );
  const { signSession } = await import('../src/config/tokens');
  const token = signSession(
    { userId: memberId, userType: 'team', role: 'admin', sv: 0, organizationId: a.organizationId },
    600
  );
  const res = await fetch(`${BASE}/api/auth/referral`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res.status, 403);
});
