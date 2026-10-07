// How long conversations are kept, and erasing one visitor (plan v10 SEC-17).
//
// KVKK asks that personal data be kept only as long as it is needed. Each
// plan has a window (domain/plans.ts): Free keeps 90 days, Pro up to a year,
// Enterprise from 30 days to five years; the owner picks within it
// (organizations.retention_days, NULL meaning the plan's default). A
// conversation whose last message is older than that goes, with its messages,
// notes, rating and attachments — the stored files included — once a night
// (db/retention.ts). The audit trail records how many, never what.
//
// A visitor who asks the business to delete their data (KVKK article 11) is
// erased from one site in one step: their conversations with everything in
// them, their visitor record, their page events and proactive-message log.

import { getPool, query, withTransaction } from '../db/pool';
import { PLAN_LIMITS } from '../domain/plans';
import { deleteStoredFiles, storedKeyFromUrl } from '../middleware/upload';
import { getPlan } from './entitlements';
import { updateAgentLoad } from './autoAssignment';
import { ACTIVE_CONVERSATION_STATUSES } from '../domain';
import { logAction } from './auditService';
import { logger } from '../config/logger';
import type { PlanType } from '../domain';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Conversations deleted per statement, so one large workspace never holds a long lock. */
const BATCH = 200;

export interface RetentionWindow {
  days: number;
  defaultDays: number;
  minDays: number;
  maxDays: number;
  /** True when the plan allows no choice (Free). */
  fixed: boolean;
}

/** The window a plan allows, and the days in force for a stored choice. */
export function retentionFor(
  plan: PlanType,
  configured: number | null | undefined
): RetentionWindow {
  const { defaultDays, minDays, maxDays } = PLAN_LIMITS[plan].retention;
  const chosen = Number.isInteger(configured) ? Number(configured) : defaultDays;
  return {
    days: Math.min(Math.max(chosen, minDays), maxDays),
    defaultDays,
    minDays,
    maxDays,
    fixed: minDays === maxDays
  };
}

export async function retentionOf(
  organizationId: string
): Promise<RetentionWindow & { plan: PlanType }> {
  const plan = await getPlan(organizationId);
  const { rows } = await query<{ retention_days: number | null }>(
    'SELECT retention_days FROM organizations WHERE id = $1',
    [organizationId]
  );
  return { plan, ...retentionFor(plan, rows[0]?.retention_days) };
}

interface Removed {
  conversations: number;
  messages: number;
  files: number;
}

/**
 * Deletes the given conversations of one organization with what hangs off
 * them, and then their stored files. The rows go in one transaction; a
 * storage error afterwards is logged and does not bring them back. An agent
 * still holding one of them gets the slot back.
 */
export async function deleteConversations(organizationId: string, ids: string[]): Promise<Removed> {
  if (!ids.length) return { conversations: 0, messages: 0, files: 0 };
  const { keys, messages, conversations, agents } = await withTransaction(async (client) => {
    const { rows: held } = await client.query<{ assigned_agent_id: string }>(
      `SELECT assigned_agent_id FROM conversations
        WHERE id = ANY($1) AND organization_id = $2
          AND assigned_agent_id IS NOT NULL AND status = ANY($3)`,
      [ids, organizationId, [...ACTIVE_CONVERSATION_STATUSES]]
    );
    const { rows: files } = await client.query<{ url: string | null }>(
      `SELECT file_data->>'url' AS url FROM messages
        WHERE conversation_id = ANY($1) AND file_data IS NOT NULL`,
      [ids]
    );
    const counted = await client.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM messages WHERE conversation_id = ANY($1)',
      [ids]
    );
    // Messages and notes go with their conversation (ON DELETE CASCADE).
    const deleted = await client.query(
      'DELETE FROM conversations WHERE id = ANY($1) AND organization_id = $2',
      [ids, organizationId]
    );
    return {
      keys: files.map((f) => storedKeyFromUrl(f.url)),
      messages: counted.rows[0]?.n ?? 0,
      conversations: deleted.rowCount ?? 0,
      agents: held.map((h) => h.assigned_agent_id)
    };
  });
  for (const agent of agents) {
    // eslint-disable-next-line no-await-in-loop
    await updateAgentLoad(agent, -1).catch(() => undefined);
  }
  let files = 0;
  try {
    files = await deleteStoredFiles(keys);
  } catch (error) {
    logger.error(
      { organizationId, error: error instanceof Error ? error.message : String(error) },
      'conversations deleted; removing their files failed'
    );
  }
  return { conversations, messages, files };
}

/**
 * The nightly pass: every organization's conversations past its window.
 * `organizationId` limits it to one (tests); `now` moves the clock.
 */
export async function purgeExpiredConversations({
  now = new Date(),
  organizationId = null
}: { now?: Date; organizationId?: string | null } = {}): Promise<
  Removed & { organizations: number }
> {
  const total = { conversations: 0, messages: 0, files: 0, organizations: 0 };
  // The shortest window any plan has: nothing younger can be due anywhere.
  const shortest = Math.min(...Object.values(PLAN_LIMITS).map((p) => p.retention.minDays));
  const { rows: candidates } = await query<{ organization_id: string }>(
    `SELECT DISTINCT organization_id FROM conversations
      WHERE coalesce(last_message_at, created_at) < $1
        AND ($2::text IS NULL OR organization_id = $2)
      LIMIT 5000`,
    [new Date(now.getTime() - shortest * DAY_MS), organizationId]
  );

  for (const { organization_id: org } of candidates) {
    // eslint-disable-next-line no-await-in-loop
    const { days } = await retentionOf(org);
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const removed: Removed = { conversations: 0, messages: 0, files: 0 };
    for (;;) {
      // eslint-disable-next-line no-await-in-loop
      const { rows } = await query<{ id: string }>(
        `SELECT id FROM conversations
          WHERE organization_id = $1 AND coalesce(last_message_at, created_at) < $2
          LIMIT ${BATCH}`,
        [org, cutoff]
      );
      if (!rows.length) break;
      // eslint-disable-next-line no-await-in-loop
      const batch = await deleteConversations(
        org,
        rows.map((r) => r.id)
      );
      removed.conversations += batch.conversations;
      removed.messages += batch.messages;
      removed.files += batch.files;
      if (rows.length < BATCH) break;
    }
    if (!removed.conversations) continue;
    total.organizations += 1;
    total.conversations += removed.conversations;
    total.messages += removed.messages;
    total.files += removed.files;
    // eslint-disable-next-line no-await-in-loop
    await logAction({
      organizationId: org,
      userId: null,
      action: 'RETENTION_PURGE',
      entityType: 'organization',
      entityId: org,
      metadata: { days, ...removed },
      ipAddress: null,
      userAgent: null
    }).catch(() => undefined);
  }
  return total;
}

/**
 * Runs the purge at most once per process per night (00:00–05:00 UTC, i.e.
 * 03:00–08:00 in Türkiye), guarded by an advisory lock so two API processes
 * do not both work through the same backlog.
 */
let lastNight: string | null = null;
export async function nightlyPurge(now = new Date()): Promise<void> {
  const night = now.toISOString().slice(0, 10);
  if (now.getUTCHours() >= 5 || lastNight === night) return;
  const client = await getPool().connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext('retention-purge')) AS locked"
    );
    if (!rows[0]?.locked) return;
    try {
      lastNight = night;
      const removed = await purgeExpiredConversations({ now });
      if (removed.conversations)
        logger.info({ retention: removed }, 'expired conversations deleted');
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtext('retention-purge'))");
    }
  } finally {
    client.release();
  }
}

/**
 * Erases one visitor from one site (a KVKK article 11 request): their
 * conversations with everything in them, their visitor record, page events
 * and proactive-message log. A block on them stays; it holds only their id
 * and a keyed hash, and protects the team.
 */
export async function eraseVisitor({
  organizationId,
  siteId,
  visitorId
}: {
  organizationId: string;
  siteId: string;
  visitorId: string;
}): Promise<Removed & { events: number }> {
  const { rows } = await query<{ id: string }>(
    'SELECT id FROM conversations WHERE organization_id = $1 AND site_id = $2 AND visitor_id = $3',
    [organizationId, siteId, visitorId]
  );
  const removed = await deleteConversations(
    organizationId,
    rows.map((r) => r.id)
  );
  const events = await withTransaction(async (client) => {
    await client.query(
      'DELETE FROM visitors WHERE organization_id = $1 AND site_id = $2 AND visitor_id = $3',
      [organizationId, siteId, visitorId]
    );
    const logged = await client.query(
      'DELETE FROM event_logs WHERE site_id = $1 AND visitor_id = $2',
      [siteId, visitorId]
    );
    await client.query(
      'DELETE FROM proactive_trigger_logs WHERE site_id = $1 AND visitor_id = $2',
      [siteId, visitorId]
    );
    return logged.rowCount ?? 0;
  });
  return { ...removed, events };
}
