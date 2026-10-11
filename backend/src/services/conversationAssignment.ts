// Atomic conversation ownership and capacity accounting.
//
// Every assignment path (REST, socket, automation and SLA reassignment) comes
// through this module.  The conversation row and the affected agent rows are
// locked in one PostgreSQL transaction, so a stale document can never reopen a
// closed conversation or push an agent over capacity.

import { withTransaction } from '../db/pool';

const ACTIVE_STATUSES = ['open', 'assigned', 'pending', 'unassigned'] as const;

export type AssignmentFailure = 'not_found' | 'inactive' | 'changed' | 'capacity';

export interface AtomicAssignmentResult {
  assigned: boolean;
  previousAgentId: string | null;
  reason?: AssignmentFailure;
}

export interface AtomicAssignmentOptions {
  conversationId: unknown;
  organizationId: string;
  agentId: unknown | null;
  assignedBy: unknown | null;
  /** `null` means "only if still unassigned"; omitted accepts the current owner. */
  expectedAgentId?: unknown | null;
}

export interface AtomicStatusResult {
  changed: boolean;
  previousStatus: string;
  reason?: 'not_found' | 'capacity';
}

type LockedConversation = { assigned_agent_id: string | null; status: string };

function sameId(left: unknown, right: unknown): boolean {
  return String(left ?? '') === String(right ?? '');
}

async function incrementTarget(
  client: import('pg').PoolClient,
  agentId: string,
  organizationId: string
): Promise<boolean> {
  const team = await client.query(
    `UPDATE teams
        SET current_load = current_load + 1,
            stats = jsonb_set(
              jsonb_set(stats, '{activeConversations}',
                to_jsonb(coalesce((stats->>'activeConversations')::int, 0) + 1)),
              '{totalConversations}',
              to_jsonb(coalesce((stats->>'totalConversations')::int, 0) + 1)
            ),
            updated_at = now()
      WHERE id = $1 AND organization_id = $2 AND is_active = true
        AND current_load < coalesce(max_capacity, 10)
      RETURNING id`,
    [agentId, organizationId]
  );
  if (team.rowCount) return true;

  // If the id belongs to a Team row, a zero-row update means that row is at
  // capacity (or inactive); it must not fall through to the User table.
  const teamExists = await client.query(
    'SELECT 1 FROM teams WHERE id = $1 AND organization_id = $2',
    [agentId, organizationId]
  );
  if (teamExists.rowCount) return false;

  const user = await client.query(
    `UPDATE users
        SET stats = jsonb_set(
              jsonb_set(stats, '{activeConversations}',
                to_jsonb(coalesce((stats->>'activeConversations')::int, 0) + 1)),
              '{totalConversations}',
              to_jsonb(coalesce((stats->>'totalConversations')::int, 0) + 1)
            ),
            updated_at = now()
      WHERE id = $1 AND organization_id = $2 AND is_active = true
        AND coalesce((stats->>'activeConversations')::int, 0)
              < coalesce((preferences->>'maxActiveConversations')::int, 10)
      RETURNING id`,
    [agentId, organizationId]
  );
  return Boolean(user.rowCount);
}

async function decrementPrevious(
  client: import('pg').PoolClient,
  agentId: string,
  organizationId: string
): Promise<void> {
  const team = await client.query(
    `UPDATE teams
        SET current_load = greatest(current_load - 1, 0),
            stats = jsonb_set(stats, '{activeConversations}',
              to_jsonb(greatest(coalesce((stats->>'activeConversations')::int, 0) - 1, 0))),
            updated_at = now()
      WHERE id = $1 AND organization_id = $2`,
    [agentId, organizationId]
  );
  if (team.rowCount) return;
  await client.query(
    `UPDATE users
        SET stats = jsonb_set(stats, '{activeConversations}',
              to_jsonb(greatest(coalesce((stats->>'activeConversations')::int, 0) - 1, 0))),
            updated_at = now()
      WHERE id = $1 AND organization_id = $2`,
    [agentId, organizationId]
  );
}

async function adjustActiveOnly(
  client: import('pg').PoolClient,
  agentId: string,
  organizationId: string,
  delta: 1 | -1
): Promise<boolean> {
  if (delta < 0) {
    await decrementPrevious(client, agentId, organizationId);
    return true;
  }
  const team = await client.query(
    `UPDATE teams
        SET current_load = current_load + 1,
            stats = jsonb_set(stats, '{activeConversations}',
              to_jsonb(coalesce((stats->>'activeConversations')::int, 0) + 1)),
            updated_at = now()
      WHERE id = $1 AND organization_id = $2 AND is_active = true
        AND current_load < coalesce(max_capacity, 10)
      RETURNING id`,
    [agentId, organizationId]
  );
  if (team.rowCount) return true;
  const teamExists = await client.query(
    'SELECT 1 FROM teams WHERE id = $1 AND organization_id = $2',
    [agentId, organizationId]
  );
  if (teamExists.rowCount) return false;
  const user = await client.query(
    `UPDATE users
        SET stats = jsonb_set(stats, '{activeConversations}',
              to_jsonb(coalesce((stats->>'activeConversations')::int, 0) + 1)),
            updated_at = now()
      WHERE id = $1 AND organization_id = $2 AND is_active = true
        AND coalesce((stats->>'activeConversations')::int, 0)
              < coalesce((preferences->>'maxActiveConversations')::int, 10)
      RETURNING id`,
    [agentId, organizationId]
  );
  return Boolean(user.rowCount);
}

export async function assignConversationAtomically(
  options: AtomicAssignmentOptions
): Promise<AtomicAssignmentResult> {
  const conversationId = String(options.conversationId);
  const nextAgentId = options.agentId ? String(options.agentId) : null;
  const assignedBy = options.assignedBy ? String(options.assignedBy) : null;

  return withTransaction(async (client) => {
    const locked = await client.query<LockedConversation>(
      `SELECT assigned_agent_id, status
         FROM conversations
        WHERE id = $1 AND organization_id = $2
        FOR UPDATE`,
      [conversationId, options.organizationId]
    );
    const row = locked.rows[0];
    if (!row) return { assigned: false, previousAgentId: null, reason: 'not_found' };
    if (!(ACTIVE_STATUSES as readonly string[]).includes(row.status)) {
      return { assigned: false, previousAgentId: row.assigned_agent_id, reason: 'inactive' };
    }
    if (
      options.expectedAgentId !== undefined &&
      !sameId(row.assigned_agent_id, options.expectedAgentId)
    ) {
      return { assigned: false, previousAgentId: row.assigned_agent_id, reason: 'changed' };
    }
    if (sameId(row.assigned_agent_id, nextAgentId)) {
      return { assigned: true, previousAgentId: row.assigned_agent_id };
    }

    // Lock both sides in stable id order. Different conversations can move in
    // opposite directions without deadlocking on the two agent rows.
    const agentIds = [row.assigned_agent_id, nextAgentId].filter(Boolean).sort() as string[];
    if (agentIds.length) {
      await client.query('SELECT id FROM teams WHERE id = ANY($1) ORDER BY id FOR UPDATE', [
        agentIds
      ]);
      await client.query('SELECT id FROM users WHERE id = ANY($1) ORDER BY id FOR UPDATE', [
        agentIds
      ]);
    }

    // Reserve the new seat before releasing the old one. A failed capacity
    // check leaves both ownership and counters untouched.
    if (nextAgentId) {
      const reserved = await incrementTarget(client, nextAgentId, options.organizationId);
      if (!reserved) {
        return {
          assigned: false,
          previousAgentId: row.assigned_agent_id,
          reason: 'capacity'
        };
      }
    }
    if (row.assigned_agent_id) {
      await decrementPrevious(client, row.assigned_agent_id, options.organizationId);
    }

    await client.query(
      `UPDATE conversations
          SET assigned_agent_id = $2::varchar,
              assigned_by_id = $3::varchar,
              assigned_at = CASE WHEN $2::varchar IS NULL THEN NULL ELSE now() END,
              status = CASE WHEN $2::varchar IS NULL THEN 'unassigned' ELSE 'assigned' END,
              updated_at = now()
        WHERE id = $1`,
      [conversationId, nextAgentId, assignedBy]
    );
    return { assigned: true, previousAgentId: row.assigned_agent_id };
  });
}

export async function transitionConversationStatusAtomically(
  conversationId: unknown,
  organizationId: string,
  status: string
): Promise<AtomicStatusResult> {
  return withTransaction(async (client) => {
    const locked = await client.query<LockedConversation>(
      `SELECT assigned_agent_id, status
         FROM conversations
        WHERE id = $1 AND organization_id = $2
        FOR UPDATE`,
      [String(conversationId), organizationId]
    );
    const row = locked.rows[0];
    if (!row) return { changed: false, previousStatus: '', reason: 'not_found' };
    if (row.status === status) return { changed: false, previousStatus: row.status };

    const wasActive = (ACTIVE_STATUSES as readonly string[]).includes(row.status);
    const willBeActive = (ACTIVE_STATUSES as readonly string[]).includes(status);
    if (row.assigned_agent_id && wasActive !== willBeActive) {
      const adjusted = await adjustActiveOnly(
        client,
        row.assigned_agent_id,
        organizationId,
        willBeActive ? 1 : -1
      );
      if (!adjusted) {
        return { changed: false, previousStatus: row.status, reason: 'capacity' };
      }
    }

    await client.query(
      `UPDATE conversations
          SET status = $2,
              closed_at = CASE WHEN $2 = 'closed' THEN now() ELSE closed_at END,
              resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE resolved_at END,
              updated_at = now()
        WHERE id = $1`,
      [String(conversationId), status]
    );
    return { changed: true, previousStatus: row.status };
  });
}

/** Repairs counters after an interrupted legacy operation or manual DB edit. */
export async function reconcileAgentLoads(): Promise<void> {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE teams t
          SET current_load = actual.active,
              stats = jsonb_set(t.stats, '{activeConversations}', to_jsonb(actual.active)),
              updated_at = now()
         FROM (
           SELECT t2.id,
                  count(c.id) FILTER (WHERE c.status = ANY($1))::int AS active
             FROM teams t2
             LEFT JOIN conversations c ON c.assigned_agent_id = t2.id
            GROUP BY t2.id
         ) actual
        WHERE t.id = actual.id
          AND (t.current_load <> actual.active OR
               coalesce((t.stats->>'activeConversations')::int, 0) <> actual.active)`,
      [[...ACTIVE_STATUSES]]
    );
    await client.query(
      `UPDATE users u
          SET stats = jsonb_set(u.stats, '{activeConversations}', to_jsonb(actual.active)),
              updated_at = now()
         FROM (
           SELECT u2.id,
                  count(c.id) FILTER (WHERE c.status = ANY($1))::int AS active
             FROM users u2
             LEFT JOIN conversations c ON c.assigned_agent_id = u2.id
            GROUP BY u2.id
         ) actual
        WHERE u.id = actual.id
          AND coalesce((u.stats->>'activeConversations')::int, 0) <> actual.active`,
      [[...ACTIVE_STATUSES]]
    );
  });
}
