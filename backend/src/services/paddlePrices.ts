// One source for the price a customer sees (plan v10 BIL-03).
//
// domain/plans.ts carries display prices; what is charged is the Paddle
// price behind each plan (PADDLE_PRICE_*). The two can drift — a price edited
// in the Paddle dashboard, a typo in plans.ts — and then the pricing page
// promises one amount and checkout asks for another. With billing on, the
// server reads the configured prices from Paddle at start and every hour,
// logs a warning for each difference, and GET /api/plans answers with
// Paddle's amounts. Without billing, or while Paddle cannot be reached, the
// table in plans.ts stands.
//
// The yearly figure in plans.ts is the monthly equivalent of the yearly
// price (what the pricing page shows next to "billed yearly"), so a yearly
// Paddle price is compared after dividing by twelve.

import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import { billingConfig } from '../config/billing';
import { PLAN_LIMITS } from '../domain/plans';
import { logger } from '../config/logger';
import { errorText } from '../http/errors';
import type { BillingCycle, BillingConfig, PaidPlan } from '../config/billing';
import type { PlanType } from '../domain';

export interface PlanPrice {
  monthly: number | null;
  yearly: number | null;
  currency: string;
}

/** A price as Paddle holds it: the amount in minor units and the period. */
export interface PaddlePrice {
  amount: string;
  currency: string;
  interval: 'day' | 'week' | 'month' | 'year' | null;
  frequency: number;
}

export type PriceFetcher = (priceId: string, config: BillingConfig) => Promise<PaddlePrice>;

const REFRESH_MS = 60 * 60 * 1000;

// Currencies without minor units; everything else Paddle sells has two.
const ZERO_DECIMAL = new Set(['JPY', 'KRW']);

const paddleFetcher: PriceFetcher = async (priceId, config) => {
  const paddle = new Paddle(config.apiKey as string, {
    environment: config.environment === 'production' ? Environment.production : Environment.sandbox
  });
  const price = await paddle.prices.get(priceId);
  return {
    amount: price.unitPrice.amount,
    currency: price.unitPrice.currencyCode,
    interval: price.billingCycle?.interval ?? null,
    frequency: price.billingCycle?.frequency ?? 1
  };
};

let fetcher: PriceFetcher = paddleFetcher;
let fromPaddle: Partial<Record<PaidPlan, PlanPrice>> = {};
let refreshedAt = 0;
let timer: NodeJS.Timeout | null = null;

/** Tests replace the Paddle call; null puts the real one back. */
export function usePriceFetcher(next: PriceFetcher | null): void {
  fetcher = next ?? paddleFetcher;
  fromPaddle = {};
  refreshedAt = 0;
}

/** Paddle's price as a per-month figure in major units. */
export function perMonth(price: PaddlePrice): number {
  const major = Number(price.amount) / (ZERO_DECIMAL.has(price.currency) ? 1 : 100);
  const months =
    price.interval === 'year'
      ? 12 * price.frequency
      : price.interval === 'month'
        ? price.frequency
        : 1;
  return Math.round((major / months) * 100) / 100;
}

/**
 * Reads every configured price from Paddle and keeps what it read. Logs a
 * warning for each figure that differs from domain/plans.ts. Returns the
 * differences, for the start-up check and tests.
 */
export async function refreshPaddlePrices(config = billingConfig()): Promise<string[]> {
  if (!config.enabled || !config.apiKey) return [];
  const next: Partial<Record<PaidPlan, PlanPrice>> = {};
  const differences: string[] = [];
  for (const plan of ['PRO', 'ENTERPRISE'] as const) {
    const display = PLAN_LIMITS[plan].price;
    // A price that cannot be read this time keeps what was read last.
    const read: PlanPrice = { ...(fromPaddle[plan] ?? display) };
    for (const cycle of ['monthly', 'yearly'] as BillingCycle[]) {
      const priceId = config.prices[plan][cycle];
      if (!priceId) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        const price = await fetcher(priceId, config);
        const amount = perMonth(price);
        read[cycle] = amount;
        read.currency = price.currency;
        if (amount !== display[cycle] || price.currency !== display.currency) {
          differences.push(
            `${plan} ${cycle}: Paddle ${amount} ${price.currency}, plans.ts ${display[cycle]} ${display.currency}`
          );
        }
      } catch (error) {
        logger.warn({ plan, cycle, err: errorText(error) }, 'paddle price could not be read');
      }
    }
    next[plan] = read;
  }
  fromPaddle = next;
  refreshedAt = Date.now();
  for (const difference of differences) {
    logger.warn({ difference }, 'paddle price differs from domain/plans.ts; showing Paddle');
  }
  return differences;
}

/** The price to show for a plan: Paddle's when read, else plans.ts. */
export function displayPrice(plan: PlanType): PlanPrice {
  const config = billingConfig();
  if (!config.enabled) return PLAN_LIMITS[plan].price;
  if (config.apiKey && Date.now() - refreshedAt > REFRESH_MS * 2) {
    // Stale (the hourly refresh failed or never ran): try again, answer now.
    refreshedAt = Date.now();
    void refreshPaddlePrices(config).catch(() => undefined);
  }
  return plan === 'FREE'
    ? PLAN_LIMITS.FREE.price
    : (fromPaddle[plan as PaidPlan] ?? PLAN_LIMITS[plan].price);
}

/** Reads the prices now and every hour; a no-op while billing is off. */
export function startPaddlePriceSync(): void {
  const config = billingConfig();
  if (!config.enabled || !config.apiKey || timer) return;
  void refreshPaddlePrices(config).catch(() => undefined);
  timer = setInterval(() => {
    void refreshPaddlePrices().catch(() => undefined);
  }, REFRESH_MS);
  timer.unref();
}

export function stopPaddlePriceSync(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
