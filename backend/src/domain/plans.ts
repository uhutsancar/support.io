// What each plan includes — the only place these numbers are written.
//
// The server enforces them (services/entitlements.ts), and the pricing page
// reads them from GET /api/plans, so what is sold and what is enforced cannot
// disagree. The names stay FREE / PRO / ENTERPRISE (the database's values);
// a marketing name, if it ever changes, is a label in the panel.
//
// The numbers are a starting point, changed here and nowhere else.

import type { PlanType } from './constants';

/** Capabilities a plan may or may not include. */
export const FEATURES = [
  'departments',
  'automation',
  'proactive',
  'visitors',
  'crm',
  'export',
  'audit'
] as const;
export type Feature = (typeof FEATURES)[number];

export interface PlanLimits {
  /** Sites (widget installs) the organization may have. */
  sites: number;
  /** Seats: every account that can sign in, the owner included, plus open invitations. */
  agents: number;
  /** New conversations per calendar month (UTC). */
  monthlyConversations: number;
  /** Whether the widget must show "Powered by Support.io". */
  branding: boolean;
  features: readonly Feature[];
  /** Display prices; what is charged is the Paddle price behind the plan. */
  price: { monthly: number | null; yearly: number | null; currency: string };
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  FREE: {
    sites: 1,
    agents: 1,
    monthlyConversations: 100,
    branding: true,
    features: [],
    price: { monthly: 0, yearly: 0, currency: 'TRY' }
  },
  PRO: {
    sites: 3,
    agents: 5,
    monthlyConversations: 2_000,
    branding: false,
    features: ['departments', 'automation', 'proactive', 'visitors', 'crm', 'export'],
    price: { monthly: 490, yearly: 392, currency: 'TRY' }
  },
  ENTERPRISE: {
    sites: 25,
    agents: 20,
    monthlyConversations: 20_000,
    branding: false,
    features: [...FEATURES],
    price: { monthly: null, yearly: null, currency: 'TRY' }
  }
};

export function planIncludes(plan: PlanType, feature: Feature): boolean {
  return PLAN_LIMITS[plan].features.includes(feature);
}
