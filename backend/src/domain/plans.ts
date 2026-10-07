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
  'audit',
  // Requiring two-step verification of every member (SEC-04).
  'security'
] as const;
export type Feature = (typeof FEATURES)[number];

/**
 * What the AI assistant does on a plan. Higher plans answer more, go on for
 * longer in one conversation, read more of the site's FAQ for each question
 * and may answer in more detail.
 */
export interface AssistantLimits {
  /** Answers per calendar month (UTC), counted per organization. */
  monthlyReplies: number;
  /** Answers in one conversation before it hands over to a person anyway. */
  repliesPerConversation: number;
  /** FAQ entries it reads for each question. */
  sources: number;
  /** The longest answer it may send, in characters. */
  answerChars: number;
  /** How long its answers are asked to be, in sentences. */
  sentences: number;
}

export interface PlanLimits {
  /** Sites (widget installs) the organization may have. */
  sites: number;
  /** Seats: every account that can sign in, the owner included, plus open invitations. */
  agents: number;
  /** New conversations per calendar month (UTC). */
  monthlyConversations: number;
  /** Whether the widget must show "Powered by Support.io". */
  branding: boolean;
  /** Saved replies the organization may keep (PRD-03). */
  savedReplies: number;
  assistant: AssistantLimits;
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
    savedReplies: 10,
    assistant: {
      monthlyReplies: 50,
      repliesPerConversation: 3,
      sources: 5,
      answerChars: 400,
      sentences: 2
    },
    features: [],
    price: { monthly: 0, yearly: 0, currency: 'TRY' }
  },
  PRO: {
    sites: 3,
    agents: 5,
    monthlyConversations: 2_000,
    branding: false,
    savedReplies: 200,
    assistant: {
      monthlyReplies: 1_000,
      repliesPerConversation: 6,
      sources: 8,
      answerChars: 600,
      sentences: 3
    },
    features: ['departments', 'automation', 'proactive', 'visitors', 'crm', 'export'],
    price: { monthly: 490, yearly: 392, currency: 'TRY' }
  },
  ENTERPRISE: {
    sites: 25,
    agents: 20,
    monthlyConversations: 20_000,
    branding: false,
    savedReplies: 100_000,
    assistant: {
      monthlyReplies: 5_000,
      repliesPerConversation: 12,
      sources: 15,
      answerChars: 900,
      sentences: 5
    },
    features: [...FEATURES],
    price: { monthly: 1_449, yearly: 1_159, currency: 'TRY' }
  }
};

export function planIncludes(plan: PlanType, feature: Feature): boolean {
  return PLAN_LIMITS[plan].features.includes(feature);
}
