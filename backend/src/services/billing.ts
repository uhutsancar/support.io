// Paddle billing (plan §9): what a webhook does to an organization's plan.
//
// The flow for one delivery:
//
//   1. The signature is checked over the raw body by Paddle's own SDK
//      (routes/billing.ts). Nothing below runs for an unsigned request.
//   2. The event id is inserted into billing_events. If it is already there,
//      Paddle is retrying something we applied: answer 200 and stop.
//   3. Inside the same transaction the subscription row is updated — unless
//      the event is older than the newest one already applied (Paddle does not
//      promise order) — and the organization's plan is recomputed from it.
//      A change is written to audit_logs as PLAN_CHANGED.
//
// The browser never opens a plan. Checkout only carries the organization's id
// and a reference signed here (checkoutReference), and only a signed webhook
// carrying both attaches a subscription to that organization.

import crypto from 'crypto';
import { NodeRuntime, Webhooks } from '@paddle/paddle-node-sdk';
import { getPool, withTransaction } from '../db/pool';
import { generateId } from '../db/objectId';
import { derivedKey, derivedKeys } from '../config/tokens';
import { billingConfig, planForPrice } from '../config/billing';
import { isPlanType } from '../domain';
import { LIVE_STATUSES, effectivePlan, isSubscriptionStatus } from '../domain/subscription';
import { lockOrganization } from './entitlements';
import { reconcilePlanLimits } from './planOverage';
import { appBaseUrl, mail } from './mail';
import { errorText } from '../http/errors';
import type { PlanType } from '../domain';
import type { SubscriptionState, SubscriptionStatus } from '../domain/subscription';
import type { PoolClient } from 'pg';

// -------------------------------------------------------------- checkout ref

/** Ties a checkout to the organization that asked for it; see the header. */
export function checkoutReference(
  organizationId: string,
  secret = derivedKey('billing-checkout')
): string {
  return crypto.createHmac('sha256', secret).update(organizationId).digest('hex').slice(0, 32);
}

function referenceMatches(organizationId: unknown, reference: unknown): boolean {
  if (typeof organizationId !== 'string' || typeof reference !== 'string') return false;
  const given = Buffer.from(reference);
  // A checkout started before a JWT_SECRET rotation still completes (SEC-18).
  return derivedKeys('billing-checkout').some((secret) => {
    const expected = Buffer.from(checkoutReference(organizationId, secret));
    return expected.length === given.length && crypto.timingSafeEqual(expected, given);
  });
}

// ------------------------------------------------------------------ webhook

/** The part of a Paddle notification this service reads (snake_case, as sent). */
export interface PaddleEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data?: {
    id?: string;
    status?: string;
    customer_id?: string | null;
    items?: Array<{ price?: { id?: string } | null }>;
    current_billing_period?: { starts_at?: string; ends_at?: string } | null;
    scheduled_change?: { action?: string; effective_at?: string } | null;
    custom_data?: Record<string, unknown> | null;
  } | null;
}

export class InvalidWebhookError extends Error {}

/**
 * Verifies Paddle-Signature over the raw body with the official SDK, which
 * also refuses a signature older than a few seconds (a replayed delivery),
 * and returns the parsed event.
 *
 * The SDK's `unmarshal` would also turn the body into its own event classes;
 * those constructors throw on any field they do not expect, which would make
 * a valid delivery look forged. Only the signature check is taken from it.
 */
export async function verifyWebhook(
  rawBody: string,
  signature: string,
  secret: string
): Promise<PaddleEvent> {
  if (!signature) throw new InvalidWebhookError('missing signature');
  // The SDK picks its crypto implementation when a Paddle client is built;
  // verifying without one (no API key is needed for it) must select Node's.
  // Without this every signature, good or bad, reads as invalid.
  NodeRuntime.initialize();
  let valid = false;
  try {
    valid = await new Webhooks().isSignatureValid(rawBody, secret, signature);
  } catch {
    valid = false;
  }
  if (!valid) throw new InvalidWebhookError('invalid signature');

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody) as PaddleEvent;
  } catch {
    throw new InvalidWebhookError('malformed event');
  }
  if (
    !event ||
    typeof event.event_id !== 'string' ||
    typeof event.event_type !== 'string' ||
    Number.isNaN(Date.parse(event.occurred_at))
  ) {
    throw new InvalidWebhookError('malformed event');
  }
  return event;
}

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored' | 'stale';

/** Applies one verified event, exactly once. */
export async function handleEvent(event: PaddleEvent, rawBody: string): Promise<WebhookOutcome> {
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const changed: { organizationId: string | null; pastDueStarted?: Date } = {
    organizationId: null
  };
  const result = await withTransaction(async (client) => {
    // A concurrent delivery of the same id waits here on the primary key and
    // then finds the row, so only one of them applies the event.
    const inserted = await client.query(
      `INSERT INTO billing_events (provider_event_id, event_type, occurred_at, payload_hash)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider_event_id) DO NOTHING
       RETURNING provider_event_id`,
      [event.event_id, event.event_type, new Date(event.occurred_at), payloadHash]
    );
    if (!inserted.rowCount) return 'duplicate';

    let outcome: Exclude<WebhookOutcome, 'duplicate'> = 'ignored';
    let organizationId: string | null = null;
    if (event.event_type.startsWith('subscription.')) {
      const applied = await applySubscriptionEvent(client, event);
      ({ outcome, organizationId } = applied);
      changed.pastDueStarted = applied.pastDueStarted;
    }

    await client.query(
      `UPDATE billing_events SET status = $2, organization_id = $3, processed_at = now()
        WHERE provider_event_id = $1`,
      [event.event_id, outcome, organizationId]
    );
    if (outcome === 'processed') changed.organizationId = organizationId;
    return outcome;
  });
  // Sites and seats over a smaller plan go on hold, and come back with a
  // bigger one (BIL-04) — after the commit, in their own transaction.
  if (changed.organizationId) {
    await reconcilePlanLimits(changed.organizationId).catch((error: unknown) => {
      console.error('Plan limit reconciliation failed:', errorText(error));
    });
    // Paddle sends its own dunning mails; ours is the one that says what
    // happens to the workspace and when (BIL-05). Once per failed payment:
    // only the event that moved the subscription into past_due sends it.
    if (changed.pastDueStarted) {
      await tellOwnerPaymentFailed(changed.organizationId, changed.pastDueStarted).catch(
        (error: unknown) => console.error('Payment failure mail failed:', errorText(error))
      );
    }
  }
  return result;
}

async function tellOwnerPaymentFailed(organizationId: string, since: Date): Promise<void> {
  const { rows } = await getPool().query<{ email: string; name: string; org: string }>(
    `SELECT u.email, u.name, o.name AS org FROM organizations o
       JOIN users u ON u.id = o.owner_user_id AND u.is_active
      WHERE o.id = $1`,
    [organizationId]
  );
  const owner = rows[0];
  if (!owner) return;
  const graceEndsAt = new Date(
    new Date(since).getTime() + billingConfig().pastDueGraceDays * 24 * 60 * 60 * 1000
  );
  await mail.sendPaymentFailed(owner.email, {
    name: owner.name || '',
    organization: owner.org,
    graceEndsAt,
    link: `${appBaseUrl()}/dashboard/billing`
  });
}

interface SubscriptionRow {
  organization_id: string;
  provider_subscription_id: string;
  provider_customer_id: string | null;
  plan_type: string;
  status: string;
  current_period_end: Date | null;
  cancel_at_period_end: boolean;
  past_due_since: Date | null;
  last_event_at: Date;
}

async function applySubscriptionEvent(
  client: PoolClient,
  event: PaddleEvent
): Promise<{
  outcome: Exclude<WebhookOutcome, 'duplicate'>;
  organizationId: string | null;
  /** This event is the first of a failed payment: the owner is told (BIL-05). */
  pastDueStarted?: Date;
}> {
  const data = event.data || {};
  const subscriptionId = data.id;
  const status = data.status;
  if (typeof subscriptionId !== 'string' || !isSubscriptionStatus(status)) {
    return { outcome: 'ignored', organizationId: null };
  }
  const occurredAt = new Date(event.occurred_at);

  // Whose subscription: the row we already keep for it, otherwise the signed
  // reference the checkout carried. Neither — not ours to apply.
  const known = await client.query<{ organization_id: string }>(
    `SELECT organization_id FROM subscriptions
      WHERE provider = 'paddle' AND provider_subscription_id = $1`,
    [subscriptionId]
  );
  let organizationId = known.rows[0]?.organization_id ?? null;
  if (!organizationId) {
    const custom = data.custom_data || {};
    if (!referenceMatches(custom.organizationId, custom.ref)) {
      return { outcome: 'ignored', organizationId: null };
    }
    const org = await client.query('SELECT id FROM organizations WHERE id = $1', [
      custom.organizationId
    ]);
    if (!org.rowCount) return { outcome: 'ignored', organizationId: null };
    organizationId = custom.organizationId as string;
  }

  await lockOrganization(client, organizationId);
  const currentResult = await client.query<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE organization_id = $1 FOR UPDATE',
    [organizationId]
  );
  const current = currentResult.rows[0] ?? null;
  const sameSubscription = current?.provider_subscription_id === subscriptionId;

  if (current && !sameSubscription && !LIVE_STATUSES.has(status)) {
    // News about some other, finished subscription of this organization
    // (an old one ending after a new one began) changes nothing.
    return { outcome: 'ignored', organizationId };
  }
  if (current && sameSubscription && occurredAt <= new Date(current.last_event_at)) {
    // Paddle does not deliver in order; an older event never undoes a newer one.
    return { outcome: 'stale', organizationId };
  }

  const priceId = data.items?.[0]?.price?.id;
  const planType =
    planForPrice(priceId) ??
    (sameSubscription && isPlanType(current?.plan_type) ? current!.plan_type : null);
  if (!planType) return { outcome: 'ignored', organizationId };

  const periodEnd = data.current_billing_period?.ends_at
    ? new Date(data.current_billing_period.ends_at)
    : sameSubscription
      ? current!.current_period_end
      : null;
  const pastDueSince =
    status === 'past_due'
      ? sameSubscription && current!.status === 'past_due' && current!.past_due_since
        ? current!.past_due_since
        : occurredAt
      : null;

  await client.query(
    `INSERT INTO subscriptions (
       id, organization_id, provider, provider_customer_id, provider_subscription_id,
       plan_type, status, current_period_end, cancel_at_period_end, past_due_since, last_event_at)
     VALUES ($1, $2, 'paddle', $3, $4, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (organization_id) DO UPDATE SET
       provider_customer_id     = EXCLUDED.provider_customer_id,
       provider_subscription_id = EXCLUDED.provider_subscription_id,
       plan_type                = EXCLUDED.plan_type,
       status                   = EXCLUDED.status,
       current_period_end       = EXCLUDED.current_period_end,
       cancel_at_period_end     = EXCLUDED.cancel_at_period_end,
       past_due_since           = EXCLUDED.past_due_since,
       last_event_at            = EXCLUDED.last_event_at,
       updated_at               = now()`,
    [
      generateId(),
      organizationId,
      data.customer_id ?? current?.provider_customer_id ?? null,
      subscriptionId,
      planType,
      status,
      periodEnd,
      data.scheduled_change?.action === 'cancel',
      pastDueSince,
      occurredAt
    ]
  );

  await syncOrganizationPlan(client, organizationId, {
    source: 'paddle',
    event: event.event_type,
    eventId: event.event_id,
    status
  });
  const pastDueStarted =
    status === 'past_due' && !(sameSubscription && current!.status === 'past_due')
      ? (pastDueSince ?? occurredAt)
      : undefined;
  return { outcome: 'processed', organizationId, pastDueStarted };
}

// ------------------------------------------------------------ plan in force

function stateOf(row: {
  plan_type: string;
  status: string;
  current_period_end: Date | null;
  past_due_since: Date | null;
}): SubscriptionState | null {
  if (!isPlanType(row.plan_type) || !isSubscriptionStatus(row.status)) return null;
  return {
    planType: row.plan_type,
    status: row.status as SubscriptionStatus,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
    pastDueSince: row.past_due_since ? new Date(row.past_due_since) : null
  };
}

/**
 * The plan an organization's subscription gives right now, or null when it
 * has none (the plan is then whatever organizations.plan_type says — the
 * free default, or a plan set by hand during the beta).
 */
export function subscriptionPlan(
  row: {
    plan_type: string | null;
    status: string | null;
    current_period_end: Date | null;
    past_due_since: Date | null;
  },
  now = new Date()
): PlanType | null {
  if (!row.plan_type || !row.status) return null;
  const state = stateOf(row as Parameters<typeof stateOf>[0]);
  return state ? effectivePlan(state, now, billingConfig().pastDueGraceDays) : null;
}

/**
 * Writes the subscription's current plan to organizations.plan_type and
 * records the change. Call inside a transaction.
 */
export async function syncOrganizationPlan(
  client: PoolClient,
  organizationId: string,
  metadata: Record<string, unknown>
): Promise<{ from: PlanType; to: PlanType } | null> {
  const result = await client.query<{
    current: string;
    billing_exempt: boolean;
    plan_type: string | null;
    status: string | null;
    current_period_end: Date | null;
    past_due_since: Date | null;
  }>(
    `SELECT o.plan_type AS current, o.billing_exempt,
            s.plan_type, s.status, s.current_period_end, s.past_due_since
       FROM organizations o
       LEFT JOIN subscriptions s ON s.organization_id = o.id
      WHERE o.id = $1
      FOR UPDATE OF o`,
    [organizationId]
  );
  const row = result.rows[0];
  // A hand-set plan (SEC-05) is never moved by a subscription event.
  if (!row || row.billing_exempt) return null;
  const from: PlanType = isPlanType(row.current) ? row.current : 'FREE';
  const to = subscriptionPlan(row) ?? from;
  if (to === from) return null;

  await client.query('UPDATE organizations SET plan_type = $2, updated_at = now() WHERE id = $1', [
    organizationId,
    to
  ]);
  await client.query(
    `INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, NULL, 'PLAN_CHANGED', 'organization', $2, $3)`,
    [generateId(), organizationId, JSON.stringify({ from, to, ...metadata })]
  );
  return { from, to };
}

/**
 * Brings organizations.plan_type in line with subscriptions whose plan has
 * changed with time alone — a paid period that ended after cancellation, a
 * grace period that ran out. Runs from the hourly retention sweep.
 */
export async function reconcileSubscriptions(): Promise<number> {
  const { rows } = await getPool().query<{ organization_id: string }>(
    'SELECT organization_id FROM subscriptions'
  );
  let changed = 0;
  for (const { organization_id: organizationId } of rows) {
    // One organization at a time, each in its own short transaction.
    // eslint-disable-next-line no-await-in-loop
    const change = await withTransaction((client) =>
      syncOrganizationPlan(client, organizationId, { source: 'schedule' })
    );
    if (change) changed += 1;
  }
  return changed;
}

/** What the billing page shows about the subscription; no Paddle secrets. */
export async function subscriptionSummary(organizationId: string) {
  const { rows } = await getPool().query<{
    plan_type: string;
    status: string;
    current_period_end: Date | null;
    cancel_at_period_end: boolean;
    past_due_since: Date | null;
    provider_customer_id: string | null;
    provider_subscription_id: string;
  }>(
    `SELECT plan_type, status, current_period_end, cancel_at_period_end, past_due_since,
            provider_customer_id, provider_subscription_id
       FROM subscriptions WHERE organization_id = $1`,
    [organizationId]
  );
  const row = rows[0];
  if (!row) return null;
  const grace = billingConfig().pastDueGraceDays;
  return {
    planType: row.plan_type,
    status: row.status,
    currentPeriodEnd: row.current_period_end,
    cancelAtPeriodEnd: row.cancel_at_period_end,
    graceEndsAt:
      row.status === 'past_due' && row.past_due_since
        ? new Date(new Date(row.past_due_since).getTime() + grace * 24 * 60 * 60 * 1000)
        : null,
    manageable: Boolean(row.provider_customer_id),
    customerId: row.provider_customer_id,
    subscriptionId: row.provider_subscription_id
  };
}
