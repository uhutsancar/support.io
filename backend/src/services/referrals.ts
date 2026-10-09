// The referral programme (plan v10 PRD-23): a workspace shares its link; a
// workspace that signs up through it and whose first paid subscription
// becomes active earns the referrer a free month — a one-time Paddle discount
// (PADDLE_REFERRAL_DISCOUNT_ID, a 100% discount on one billing period that
// the owner creates in Paddle [SAHİP]) applied to the referrer's next bill.
//
// The reward is given when it can be: the referrer must have a live paid
// subscription and the discount must be configured. Until then it waits and
// the hourly sweep tries again; `npm run referrals:due` lists what waits, for
// the owner to give by hand if they prefer.

import crypto from 'crypto';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import events from '../events';
import { query } from '../db/pool';
import { generateId } from '../db/objectId';
import { billingConfig } from '../config/billing';
import { appBaseUrl, mail } from './mail';

// No 0/O, 1/I/L: a code people type from a screenshot.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newCode(): string {
  const bytes = crypto.randomBytes(8);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function normalizeCode(raw: unknown): string | null {
  const code = String(raw ?? '')
    .trim()
    .toUpperCase();
  return /^[A-Z2-9]{8}$/.test(code) ? code : null;
}

/** The workspace's code, made the first time it is asked for. */
export async function referralCodeFor(organizationId: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const { rows } = await query<{ referral_code: string | null }>(
      'SELECT referral_code FROM organizations WHERE id = $1',
      [organizationId]
    );
    if (rows[0]?.referral_code) return rows[0].referral_code;
    try {
      // eslint-disable-next-line no-await-in-loop
      const set = await query<{ referral_code: string }>(
        `UPDATE organizations SET referral_code = $2
          WHERE id = $1 AND referral_code IS NULL RETURNING referral_code`,
        [organizationId, newCode()]
      );
      if (set.rows[0]) return set.rows[0].referral_code;
    } catch (error) {
      if ((error as { code?: string }).code !== '23505') throw error;
    }
  }
  throw new Error('could not make a referral code');
}

/** Records that `referredId` signed up with `code`; quietly nothing for a bad code. */
export async function recordReferral(code: unknown, referredId: string): Promise<boolean> {
  const normalized = normalizeCode(code);
  if (!normalized) return false;
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM organizations WHERE referral_code = $1 AND is_active',
    [normalized]
  );
  const referrer = rows[0]?.id;
  if (!referrer || referrer === referredId) return false;
  const inserted = await query(
    `INSERT INTO referrals (id, referrer_organization_id, referred_organization_id)
     VALUES ($1, $2, $3) ON CONFLICT (referred_organization_id) DO NOTHING`,
    [generateId(), referrer, referredId]
  );
  return Boolean(inserted.rowCount);
}

/** Gives a referrer's free month; replaced in tests. */
export interface RewardApplier {
  apply(subscriptionId: string, discountId: string): Promise<string>;
}

const paddleApplier: RewardApplier = {
  async apply(subscriptionId, discountId) {
    const config = billingConfig();
    const paddle = new Paddle(config.apiKey as string, {
      environment:
        config.environment === 'production' ? Environment.production : Environment.sandbox
    });
    await paddle.subscriptions.update(subscriptionId, {
      discount: { id: discountId, effectiveFrom: 'next_billing_period' }
    });
    return `paddle:${subscriptionId}:${discountId}`;
  }
};

let applier: RewardApplier = paddleApplier;
export function useRewardApplier(next: RewardApplier | null): void {
  applier = next ?? paddleApplier;
}

function rewardConfigured(): string | null {
  const discount = String(process.env.PADDLE_REFERRAL_DISCOUNT_ID || '').trim();
  if (!/^dsc_[a-z0-9]+$/i.test(discount)) return null;
  return billingConfig().apiKey || applier !== paddleApplier ? discount : null;
}

/**
 * Gives the free month for one qualified referral when it can. True when it
 * was given now; false when it waits (no live subscription, nothing
 * configured, Paddle refused) or was given already.
 */
export async function tryReward(referralId: string): Promise<boolean> {
  const discount = rewardConfigured();
  if (!discount) return false;
  const { rows } = await query<{
    referrer: string;
    subscription_id: string | null;
    status: string | null;
  }>(
    `SELECT r.referrer_organization_id AS referrer, s.provider_subscription_id AS subscription_id,
            s.status
       FROM referrals r
       LEFT JOIN subscriptions s ON s.organization_id = r.referrer_organization_id
      WHERE r.id = $1 AND r.qualified_at IS NOT NULL AND r.rewarded_at IS NULL`,
    [referralId]
  );
  const row = rows[0];
  if (!row || !row.subscription_id || !['active', 'trialing'].includes(String(row.status))) {
    return false;
  }
  // Claimed before Paddle is asked, so two sweeps cannot give it twice.
  const claimed = await query(
    `UPDATE referrals SET rewarded_at = now(), reward_reference = 'pending'
      WHERE id = $1 AND rewarded_at IS NULL`,
    [referralId]
  );
  if (!claimed.rowCount) return false;
  let reference: string;
  try {
    reference = await applier.apply(row.subscription_id, discount);
  } catch (error) {
    await query('UPDATE referrals SET rewarded_at = NULL, reward_reference = NULL WHERE id = $1', [
      referralId
    ]);
    console.error('[referrals] reward failed:', (error as Error).message);
    return false;
  }
  await query('UPDATE referrals SET reward_reference = $2 WHERE id = $1', [referralId, reference]);
  events.emit('referral.rewarded', {
    organizationId: row.referrer,
    userId: null,
    metadata: { referralId }
  });
  void tellReferrer(row.referrer).catch(() => undefined);
  return true;
}

async function tellReferrer(organizationId: string) {
  const { rows } = await query<{
    email: string;
    name: string;
    preferences: { locale?: string } | null;
  }>(
    `SELECT u.email, u.name, u.preferences FROM organizations o
       JOIN users u ON u.id = o.owner_user_id AND u.is_active
      WHERE o.id = $1`,
    [organizationId]
  );
  const owner = rows[0];
  if (!owner) return;
  const locale = owner.preferences?.locale === 'en' ? 'en' : 'tr';
  await mail.sendReferralReward(owner.email, {
    name: owner.name,
    link: `${appBaseUrl()}${locale === 'en' ? '/en' : ''}/dashboard/settings#referral`,
    locale
  });
}

/**
 * A workspace's first paid subscription became active: its referral, if it
 * has one, qualifies, and the referrer's month is given if it can be.
 */
export async function qualifyReferral(referredId: string): Promise<void> {
  const { rows } = await query<{ id: string }>(
    `UPDATE referrals SET qualified_at = now()
      WHERE referred_organization_id = $1 AND qualified_at IS NULL RETURNING id`,
    [referredId]
  );
  if (rows[0]) await tryReward(rows[0].id);
}

/** Qualified referrals still waiting for their month (hourly sweep). */
export async function sweepReferralRewards(): Promise<number> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM referrals WHERE qualified_at IS NOT NULL AND rewarded_at IS NULL
      ORDER BY qualified_at LIMIT 100`
  );
  let given = 0;
  for (const { id } of rows) {
    // eslint-disable-next-line no-await-in-loop
    if (await tryReward(id)) given += 1;
  }
  return given;
}

/** What the panel shows the referrer. */
export async function referralSummary(organizationId: string) {
  const code = await referralCodeFor(organizationId);
  const { rows } = await query<{ joined: number; qualified: number; rewarded: number }>(
    `SELECT count(*)::int AS joined,
            count(*) FILTER (WHERE qualified_at IS NOT NULL)::int AS qualified,
            count(*) FILTER (WHERE rewarded_at IS NOT NULL AND reward_reference <> 'pending')::int
              AS rewarded
       FROM referrals WHERE referrer_organization_id = $1`,
    [organizationId]
  );
  return { code, link: `${appBaseUrl()}/register?ref=${code}`, ...rows[0] };
}
