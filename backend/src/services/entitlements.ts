// What an organization's plan lets it do, enforced on the server.
//
// Routes never compare plan names or read billing state themselves; they ask
// here. Every limit that two requests could race past is checked under a
// transaction-scoped advisory lock on the organization (sites, seats), or by
// a single conditional UPSERT (the monthly conversation quota), so two
// concurrent requests cannot both take the last slot.

import { getPool, query } from '../db/pool';
import { PLAN_LIMITS, planIncludes } from '../domain/plans';
import { effectivePlan, isSubscriptionStatus } from '../domain/subscription';
import { billingConfig } from '../config/billing';
import { isPlanType } from '../domain';
import { asyncMiddleware } from '../http/asyncHandler';
import { HttpError, forbidden } from '../http/errors';
import { orgId } from '../http/guards';
import type { Feature, PlanLimits } from '../domain/plans';
import type { PlanType } from '../domain';
import type { PoolClient, QueryResultRow } from 'pg';
import type { NextFunction, Request, Response } from 'express';

/** Something that runs a query: a transaction's client, or the pool. */
type Runner = Pick<PoolClient, 'query'>;

const runner = (client?: Runner | null): Runner => client ?? getPool();

async function rows<R extends QueryResultRow>(
  client: Runner | null | undefined,
  text: string,
  params: unknown[]
): Promise<R[]> {
  return (await runner(client).query<R>(text, params)).rows;
}

/** A limit of the plan was reached; the panel shows the upgrade path. */
export class PlanLimitError extends HttpError {
  constructor(resource: 'sites' | 'agents' | 'conversations', limit: number, used: number) {
    super(403, `Your plan allows ${limit} ${resource}; upgrade to add more`, 'PLAN_LIMIT_REACHED', {
      resource,
      limit,
      used
    });
  }
}

/**
 * This month's new-conversation quota is used up. Open conversations go on;
 * the visitor who tried to start one is told to try again later, never shown
 * a billing message (plan §8.4).
 */
export class ConversationQuotaError extends HttpError {
  constructor() {
    super(403, 'We cannot take new messages right now, please try again later', 'QUOTA_EXCEEDED');
  }
}

/** The share of the monthly quota at which the owner is warned once. */
export const QUOTA_WARNING_SHARE = 0.8;

/** Whether `count` is exactly the conversation that crosses the warning line. */
export function crossesWarning(count: number, limit: number): boolean {
  return limit > 0 && count === Math.ceil(limit * QUOTA_WARNING_SHARE);
}

/** The calendar month a usage row counts, in UTC: `2026-10`. */
export function currentPeriod(at: Date = new Date()): string {
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * The plan in force for an organization.
 *
 * With a Paddle subscription, the subscription decides — and it decides by
 * the clock as well as by webhooks: a cancelled plan lasts until its paid
 * period ends, a failed payment keeps it for the grace period
 * (domain/subscription.ts). Without one, organizations.plan_type does: the
 * free default, or a plan set by scripts/updatePlan.ts during the beta.
 * An unknown value counts as FREE.
 */
export async function getPlan(organizationId: string, client?: Runner | null): Promise<PlanType> {
  const [row] = await rows<{
    plan_type: string;
    sub_plan: string | null;
    status: string | null;
    current_period_end: Date | null;
    past_due_since: Date | null;
  }>(
    client,
    `SELECT o.plan_type, s.plan_type AS sub_plan, s.status, s.current_period_end, s.past_due_since
       FROM organizations o
       LEFT JOIN subscriptions s ON s.organization_id = o.id
      WHERE o.id = $1`,
    [organizationId]
  );
  if (!row) return 'FREE';
  if (isPlanType(row.sub_plan) && isSubscriptionStatus(row.status)) {
    return effectivePlan(
      {
        planType: row.sub_plan,
        status: row.status,
        currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
        pastDueSince: row.past_due_since ? new Date(row.past_due_since) : null
      },
      new Date(),
      billingConfig().pastDueGraceDays
    );
  }
  return isPlanType(row.plan_type) ? row.plan_type : 'FREE';
}

export async function limitsFor(organizationId: string, client?: Runner | null) {
  const plan = await getPlan(organizationId, client);
  return { plan, limits: PLAN_LIMITS[plan] as PlanLimits };
}

/**
 * Serialises the limit checks of one organization until the caller's
 * transaction ends. Call it first, inside the transaction that will write.
 */
export async function lockOrganization(client: Runner, organizationId: string): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
    `entitlements:${organizationId}`
  ]);
}

// -------------------------------------------------------------------- sites

export async function siteCount(organizationId: string, client?: Runner | null): Promise<number> {
  const [row] = await rows<{ n: number }>(
    client,
    'SELECT count(*)::int AS n FROM sites WHERE organization_id = $1',
    [organizationId]
  );
  return row?.n ?? 0;
}

/** Throws when one more site would exceed the plan. Call under lockOrganization. */
export async function assertCanCreateSite(organizationId: string, client: Runner): Promise<void> {
  const { limits } = await limitsFor(organizationId, client);
  const used = await siteCount(organizationId, client);
  if (used >= limits.sites) throw new PlanLimitError('sites', limits.sites, used);
}

// -------------------------------------------------------------------- seats

/**
 * Seats in use: every active account of the organization (owner included)
 * plus every invitation still open — an invitation holds the seat it will
 * fill, or an admin could invite past the limit and let acceptance fail.
 */
export async function seatsUsed(
  organizationId: string,
  client?: Runner | null,
  { exceptInvitation }: { exceptInvitation?: string } = {}
): Promise<{ members: number; invitations: number; total: number }> {
  const [row] = await rows<{ members: number; invitations: number }>(
    client,
    `SELECT
       (SELECT count(*) FROM users WHERE organization_id = $1 AND is_active)::int
         + (SELECT count(*) FROM teams WHERE organization_id = $1 AND is_active)::int AS members,
       (SELECT count(*) FROM invitations
         WHERE organization_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL
           AND expires_at > now() AND id <> coalesce($2, ''))::int AS invitations`,
    [organizationId, exceptInvitation ?? null]
  );
  const members = row?.members ?? 0;
  const invitations = row?.invitations ?? 0;
  return { members, invitations, total: members + invitations };
}

/** Throws when one more seat would exceed the plan. Call under lockOrganization. */
export async function assertCanAddAgent(
  organizationId: string,
  client: Runner,
  options: { exceptInvitation?: string } = {}
): Promise<void> {
  const { limits } = await limitsFor(organizationId, client);
  const { total } = await seatsUsed(organizationId, client, options);
  if (total >= limits.agents) throw new PlanLimitError('agents', limits.agents, total);
}

// ------------------------------------------------------------ conversations

export interface QuotaResult {
  ok: boolean;
  /** Conversations counted this month, this one included when ok. */
  count: number;
  limit: number;
}

/**
 * Counts one new conversation against this month's quota, atomically: the
 * row is incremented only while it is under the limit, so concurrent openers
 * cannot both take the last slot. Run it inside the transaction that inserts
 * the conversation, so a failed insert gives the slot back.
 */
export async function tryConsumeConversation(
  organizationId: string,
  client: Runner
): Promise<QuotaResult> {
  const { limits } = await limitsFor(organizationId, client);
  const [row] = await rows<{ conversations: number }>(
    client,
    `INSERT INTO organization_usage_monthly (organization_id, period, conversations)
     VALUES ($1, $2, 1)
     ON CONFLICT (organization_id, period) DO UPDATE
       SET conversations = organization_usage_monthly.conversations + 1, updated_at = now()
       WHERE organization_usage_monthly.conversations < $3
     RETURNING conversations`,
    [organizationId, currentPeriod(), limits.monthlyConversations]
  );
  if (row && row.conversations <= limits.monthlyConversations) {
    return { ok: true, count: row.conversations, limit: limits.monthlyConversations };
  }
  // A brand-new row was inserted at 1 above a limit of 0; give it back.
  if (row) {
    await runner(client).query(
      `UPDATE organization_usage_monthly SET conversations = conversations - 1
        WHERE organization_id = $1 AND period = $2`,
      [organizationId, currentPeriod()]
    );
  }
  return { ok: false, count: limits.monthlyConversations, limit: limits.monthlyConversations };
}

// --------------------------------------------------------- AI assistant

/** Answers the assistant has given this month, and the plan's allowance. */
export async function assistantAllowance(
  organizationId: string
): Promise<{ used: number; limit: number }> {
  const { limits } = await limitsFor(organizationId);
  const [row] = await rows<{ assistant_replies: number }>(
    null,
    `SELECT assistant_replies FROM organization_usage_monthly
      WHERE organization_id = $1 AND period = $2`,
    [organizationId, currentPeriod()]
  );
  return { used: row?.assistant_replies ?? 0, limit: limits.assistant.monthlyReplies };
}

/**
 * Counts one assistant answer against the month's allowance, atomically (the
 * same conditional UPSERT as tryConsumeConversation). False when the
 * allowance is used up: the conversation then goes to a person instead.
 */
export async function tryConsumeAssistantReply(organizationId: string): Promise<boolean> {
  const { limits } = await limitsFor(organizationId);
  const limit = limits.assistant.monthlyReplies;
  if (limit <= 0) return false;
  const [row] = await rows<{ assistant_replies: number }>(
    null,
    `INSERT INTO organization_usage_monthly (organization_id, period, assistant_replies)
     VALUES ($1, $2, 1)
     ON CONFLICT (organization_id, period) DO UPDATE
       SET assistant_replies = organization_usage_monthly.assistant_replies + 1, updated_at = now()
       WHERE organization_usage_monthly.assistant_replies < $3
     RETURNING assistant_replies`,
    [organizationId, currentPeriod(), limit]
  );
  return Boolean(row);
}

/** Counts a stored message; informational, never refused. */
export async function countMessage(organizationId: unknown): Promise<void> {
  if (!organizationId) return;
  await query(
    `INSERT INTO organization_usage_monthly (organization_id, period, messages)
     VALUES ($1, $2, 1)
     ON CONFLICT (organization_id, period) DO UPDATE
       SET messages = organization_usage_monthly.messages + 1, updated_at = now()`,
    [String(organizationId), currentPeriod()]
  );
}

// ----------------------------------------------------------------- features

export async function hasFeature(organizationId: string, feature: Feature): Promise<boolean> {
  return planIncludes(await getPlan(organizationId), feature);
}

/** Route guard: the caller's plan includes `feature`. */
export function requireFeature(feature: Feature) {
  return asyncMiddleware(async (req: Request, _res: Response, next: NextFunction) => {
    if (!(await hasFeature(orgId(req), feature))) {
      throw forbidden(
        'This feature is not part of your plan; upgrade to use it',
        'PLAN_UPGRADE_REQUIRED'
      );
    }
    next();
  });
}

// -------------------------------------------------------------------- usage

/** Everything the billing page shows: the plan, its limits, and this month. */
export async function getUsage(organizationId: string) {
  const { plan, limits } = await limitsFor(organizationId);
  const period = currentPeriod();
  const [sites, seats, monthly] = await Promise.all([
    siteCount(organizationId),
    seatsUsed(organizationId),
    rows<{ conversations: number; messages: number; assistant_replies: number }>(
      null,
      `SELECT conversations, messages, assistant_replies FROM organization_usage_monthly
        WHERE organization_id = $1 AND period = $2`,
      [organizationId, period]
    )
  ]);
  return {
    plan,
    limits: {
      sites: limits.sites,
      agents: limits.agents,
      monthlyConversations: limits.monthlyConversations,
      branding: limits.branding,
      features: limits.features,
      assistant: {
        monthlyReplies: limits.assistant.monthlyReplies,
        repliesPerConversation: limits.assistant.repliesPerConversation
      }
    },
    usage: {
      period,
      sites,
      seats: seats.total,
      members: seats.members,
      invitations: seats.invitations,
      conversations: monthly[0]?.conversations ?? 0,
      messages: monthly[0]?.messages ?? 0,
      assistantReplies: monthly[0]?.assistant_replies ?? 0
    }
  };
}
