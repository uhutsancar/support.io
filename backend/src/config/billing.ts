// Paddle configuration (plan §9.4), read from the environment on each call so
// tests and a restarted process see the same thing.
//
//   BILLING_ENABLED          "true" shows checkout in the panel. Off during the
//                            closed beta; plans are then set by scripts/updatePlan.ts.
//   PADDLE_ENV               sandbox | production
//   PADDLE_API_KEY           server only — customer portal sessions
//   PADDLE_WEBHOOK_SECRET    server only — verifies Paddle-Signature
//   PADDLE_CLIENT_TOKEN      the one Paddle value that reaches the browser
//   PADDLE_PRICE_PRO         price id (pri_…) that buys PRO
//   PADDLE_PRICE_ENTERPRISE  optional; ENTERPRISE is usually agreed by hand
//   BILLING_PAST_DUE_GRACE_DAYS  how long a failed payment keeps the plan (7)
//
// A webhook is processed whenever its secret is set, even with checkout off:
// staging can receive sandbox events while the panel still hides the button.

import type { PlanType } from '../domain';

export type PaddleEnvironment = 'sandbox' | 'production';

export interface BillingConfig {
  enabled: boolean;
  environment: PaddleEnvironment;
  apiKey: string | null;
  webhookSecret: string | null;
  clientToken: string | null;
  prices: { PRO: string | null; ENTERPRISE: string | null };
  pastDueGraceDays: number;
}

const value = (name: string): string | null => {
  const raw = String(process.env[name] || '').trim();
  return raw || null;
};

export function billingConfig(): BillingConfig {
  const grace = Number(process.env.BILLING_PAST_DUE_GRACE_DAYS);
  return {
    enabled: String(process.env.BILLING_ENABLED || '').toLowerCase() === 'true',
    environment: value('PADDLE_ENV') === 'production' ? 'production' : 'sandbox',
    apiKey: value('PADDLE_API_KEY'),
    webhookSecret: value('PADDLE_WEBHOOK_SECRET'),
    clientToken: value('PADDLE_CLIENT_TOKEN'),
    prices: { PRO: value('PADDLE_PRICE_PRO'), ENTERPRISE: value('PADDLE_PRICE_ENTERPRISE') },
    pastDueGraceDays: Number.isFinite(grace) && grace >= 0 ? grace : 7
  };
}

/** The plan a Paddle price id buys, or null for a price we do not sell. */
export function planForPrice(priceId: unknown, config = billingConfig()): PlanType | null {
  if (typeof priceId !== 'string' || !priceId) return null;
  if (priceId === config.prices.PRO) return 'PRO';
  if (priceId === config.prices.ENTERPRISE) return 'ENTERPRISE';
  return null;
}

/**
 * What is missing for BILLING_ENABLED=true to work; empty when nothing is.
 * The production boot check (config/env.ts) refuses to start on a non-empty
 * list, so a half-configured checkout never reaches a customer.
 */
export function billingConfigProblems(config = billingConfig()): string[] {
  if (!config.enabled) return [];
  const problems: string[] = [];
  if (!config.apiKey) problems.push('PADDLE_API_KEY');
  if (!config.webhookSecret) problems.push('PADDLE_WEBHOOK_SECRET');
  if (!config.clientToken) problems.push('PADDLE_CLIENT_TOKEN');
  if (!config.prices.PRO) problems.push('PADDLE_PRICE_PRO');
  return problems;
}
