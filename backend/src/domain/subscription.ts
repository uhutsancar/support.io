// Which plan a subscription gives, at a given moment (plan §9.2).
//
// Kept free of the database and of Paddle so the rule can be read — and
// tested — on its own:
//
//   active, trialing   the plan that was bought
//   past_due           the plan, for a grace period from the failed payment;
//                      FREE once it has passed
//   canceled           the plan until the paid period ends; FREE after
//   paused             FREE
//
// Time moves the answer without any webhook arriving, so the server asks this
// function whenever it needs the plan (services/entitlements.ts#getPlan), and
// an hourly sweep writes the result back to organizations.plan_type for
// display (services/billing.ts#reconcileSubscriptions).

import type { PlanType } from './constants';

export const SUBSCRIPTION_STATUSES = [
  'active',
  'trialing',
  'past_due',
  'paused',
  'canceled'
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (SUBSCRIPTION_STATUSES as readonly unknown[]).includes(value);
}

/** Statuses in which the customer is still paying, or about to. */
export const LIVE_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  'active',
  'trialing',
  'past_due'
]);

export interface SubscriptionState {
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  pastDueSince: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function effectivePlan(
  subscription: SubscriptionState,
  now: Date,
  pastDueGraceDays: number
): PlanType {
  switch (subscription.status) {
    case 'active':
    case 'trialing':
      return subscription.planType;
    case 'past_due': {
      const since = subscription.pastDueSince?.getTime() ?? now.getTime();
      return now.getTime() < since + pastDueGraceDays * DAY_MS ? subscription.planType : 'FREE';
    }
    case 'canceled':
      return subscription.currentPeriodEnd && now < subscription.currentPeriodEnd
        ? subscription.planType
        : 'FREE';
    default:
      return 'FREE';
  }
}
