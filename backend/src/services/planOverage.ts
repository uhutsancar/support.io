// What happens to sites and seats beyond the plan after a downgrade
// (plan v10 BIL-04, KARAR-BIL-1 default).
//
// Nothing is deleted. Sites over the limit are suspended: the widget stays
// silent on the customer's page (routes/widget.ts, middleware/widgetSession.ts)
// and the panel shows them read-only. Seats over the limit can still sign in
// and read, but cannot reply or change anything (middleware/rbac.ts and
// socket/handlers/adminConversations.ts read seatSuspendedAt). The owner's
// seat is never suspended.
//
// Which ones stay active: the owner's choice first (the billing page posts
// it), then whatever is active now, then the oldest. So a sweep never
// reshuffles a choice once made, and an upgrade brings the suspended ones
// back oldest first. The plan in force can change by the clock alone (a paid
// period ending, a trial running out), so the hourly sweep runs this too.

import { getPool, withTransaction } from '../db/pool';
import { generateId } from '../db/objectId';
import { lockOrganization, limitsFor } from './entitlements';
import { appBaseUrl, mail } from './mail';
import { siteRoom, userRoom } from '../realtime/rooms';
import type { PoolClient } from 'pg';
import type { Server } from 'socket.io';

export interface OverageChoice {
  /** Sites the owner wants active; at most the plan's site limit. */
  keepSiteIds?: string[];
  /** Members (users or team accounts) the owner wants active. */
  keepMemberIds?: string[];
}

export interface OverageChange {
  sitesSuspended: string[];
  sitesRestored: string[];
  seatsSuspended: string[];
  seatsRestored: string[];
}

interface Row {
  id: string;
  suspended: boolean;
  /** Blocked by the platform (LEG-05): never takes a slot from a working site. */
  blocked?: boolean;
  kind?: 'user' | 'team';
}

/** The order in which rows keep their place: chosen, active now, oldest. */
function ranked<T extends Row>(rows: T[], keep: Set<string>): T[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      const usable = Number(!a.row.blocked) - Number(!b.row.blocked);
      if (usable) return -usable;
      const chosen = Number(keep.has(b.row.id)) - Number(keep.has(a.row.id));
      if (chosen) return chosen;
      const active = Number(!b.row.suspended) - Number(!a.row.suspended);
      if (active) return active;
      return a.index - b.index;
    })
    .map(({ row }) => row);
}

async function auditRow(
  client: PoolClient,
  organizationId: string,
  action: 'SITE_SUSPENDED' | 'SITE_REACTIVATED' | 'SEAT_SUSPENDED' | 'SEAT_RESTORED',
  entityType: string,
  entityId: string,
  metadata: object
) {
  await client.query(
    `INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, NULL, $3, $4, $5, $6)`,
    [generateId(), organizationId, action, entityType, entityId, JSON.stringify(metadata)]
  );
}

/**
 * Brings an organization's active sites and seats within its plan, and back
 * when the plan grows. Idempotent; returns what changed.
 */
export async function reconcilePlanLimits(
  organizationId: string,
  choice: OverageChoice = {}
): Promise<OverageChange> {
  const change = await withTransaction(async (client) => {
    await lockOrganization(client, organizationId);
    const { plan, limits } = await limitsFor(organizationId, client);
    const out: OverageChange = {
      sitesSuspended: [],
      sitesRestored: [],
      seatsSuspended: [],
      seatsRestored: []
    };

    const sites = await client.query<Row>(
      `SELECT id, suspended_at IS NOT NULL AS suspended, blocked_at IS NOT NULL AS blocked
         FROM sites WHERE organization_id = $1 ORDER BY created_at, id`,
      [organizationId]
    );
    const keepSites = new Set(choice.keepSiteIds ?? []);
    ranked(sites.rows, keepSites).forEach((site, index) => {
      const active = index < limits.sites;
      if (active && site.suspended) out.sitesRestored.push(site.id);
      if (!active && !site.suspended) out.sitesSuspended.push(site.id);
    });
    if (out.sitesSuspended.length) {
      await client.query(
        'UPDATE sites SET suspended_at = now(), updated_at = now() WHERE id = ANY($1)',
        [out.sitesSuspended]
      );
    }
    if (out.sitesRestored.length) {
      await client.query(
        'UPDATE sites SET suspended_at = NULL, updated_at = now() WHERE id = ANY($1)',
        [out.sitesRestored]
      );
    }
    for (const id of out.sitesSuspended) {
      // eslint-disable-next-line no-await-in-loop
      await auditRow(client, organizationId, 'SITE_SUSPENDED', 'site', id, {
        plan,
        limit: limits.sites
      });
    }
    for (const id of out.sitesRestored) {
      // eslint-disable-next-line no-await-in-loop
      await auditRow(client, organizationId, 'SITE_REACTIVATED', 'site', id, {
        plan,
        limit: limits.sites
      });
    }

    // The owner holds a seat and keeps it whatever the order says.
    const members = await client.query<Row & { owner: boolean }>(
      `SELECT u.id, 'user' AS kind, u.seat_suspended_at IS NOT NULL AS suspended,
              (u.id = o.owner_user_id) AS owner, u.created_at
         FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE u.organization_id = $1 AND u.is_active
       UNION ALL
       SELECT t.id, 'team', t.seat_suspended_at IS NOT NULL, false, t.created_at
         FROM teams t
        WHERE t.organization_id = $1 AND t.is_active
       ORDER BY owner DESC, created_at, id`,
      [organizationId]
    );
    const keepMembers = new Set(choice.keepMemberIds ?? []);
    const owners = members.rows.filter((m) => m.owner);
    const others = ranked(
      members.rows.filter((m) => !m.owner),
      keepMembers
    );
    [...owners, ...others].forEach((member, index) => {
      const active = member.owner || index < limits.agents;
      if (active && member.suspended) out.seatsRestored.push(`${member.kind}:${member.id}`);
      if (!active && !member.suspended) out.seatsSuspended.push(`${member.kind}:${member.id}`);
    });
    for (const [list, value, action] of [
      [out.seatsSuspended, 'now()', 'SEAT_SUSPENDED'],
      [out.seatsRestored, 'NULL', 'SEAT_RESTORED']
    ] as const) {
      for (const key of list) {
        const [kind, id] = key.split(':');
        const table = kind === 'team' ? 'teams' : 'users';
        // eslint-disable-next-line no-await-in-loop
        await client.query(
          `UPDATE ${table} SET seat_suspended_at = ${value}, updated_at = now() WHERE id = $1`,
          [id]
        );
        // eslint-disable-next-line no-await-in-loop
        await auditRow(client, organizationId, action, kind === 'team' ? 'team' : 'user', id, {
          plan,
          limit: limits.agents
        });
      }
    }
    return out;
  });

  // A suspended or restored member's live connection carries the old rights;
  // closing it makes the panel reconnect with the new ones.
  for (const key of [...change.seatsSuspended, ...change.seatsRestored]) {
    realtime
      ?.of('/admin')
      .in(userRoom(key.split(':')[1]))
      .disconnectSockets(true);
  }
  // Visitors on a suspended site lose the bubble; their widget finds no
  // session on reconnect and stays silent.
  for (const id of change.sitesSuspended) {
    realtime?.of('/widget').in(siteRoom(id)).disconnectSockets(true);
  }
  if (change.sitesSuspended.length || change.seatsSuspended.length) {
    // Awaited so a one-off command does not close the pool under it.
    await tellOwner(organizationId, change).catch(() => undefined);
  }
  return change;
}

async function tellOwner(organizationId: string, change: OverageChange) {
  const { rows } = await getPool().query<{ email: string; name: string; org: string }>(
    `SELECT u.email, u.name, o.name AS org FROM organizations o
       JOIN users u ON u.id = o.owner_user_id AND u.is_active
      WHERE o.id = $1`,
    [organizationId]
  );
  const owner = rows[0];
  if (!owner) return;
  await mail.sendPlanOverage(owner.email, {
    name: owner.name || '',
    organization: owner.org,
    sites: change.sitesSuspended.length,
    seats: change.seatsSuspended.length,
    link: `${appBaseUrl()}/dashboard/billing`
  });
}

/** Every organization whose active sites or seats do not match its plan. */
export async function reconcileAllPlanLimits(): Promise<number> {
  // Cheap filter first: anything suspended (an upgrade may restore it) or
  // anything with more sites or members than the smallest plan allows.
  const { rows } = await getPool().query<{ id: string }>(
    `SELECT o.id FROM organizations o
      WHERE o.is_active AND (
        EXISTS (SELECT 1 FROM sites s WHERE s.organization_id = o.id AND s.suspended_at IS NOT NULL)
        OR EXISTS (SELECT 1 FROM users u WHERE u.organization_id = o.id AND u.seat_suspended_at IS NOT NULL)
        OR EXISTS (SELECT 1 FROM teams t WHERE t.organization_id = o.id AND t.seat_suspended_at IS NOT NULL)
        OR (SELECT count(*) FROM sites s WHERE s.organization_id = o.id) > 1
        OR (SELECT count(*) FROM teams t WHERE t.organization_id = o.id AND t.is_active) > 0
        OR (SELECT count(*) FROM users u WHERE u.organization_id = o.id AND u.is_active) > 1
      )`
  );
  let changed = 0;
  for (const { id } of rows) {
    // eslint-disable-next-line no-await-in-loop
    const change = await reconcilePlanLimits(id);
    if (Object.values(change).some((list) => list.length)) changed += 1;
  }
  return changed;
}

/**
 * Why nobody may reply on a site, if they may not: over its plan's limit
 * (BIL-04) or blocked by the platform (LEG-05). Null when replies are fine.
 */
export async function siteHold(siteId: unknown): Promise<'SITE_SUSPENDED' | 'SITE_BLOCKED' | null> {
  if (!siteId) return null;
  const { rows } = await getPool().query<{ suspended: boolean; blocked: boolean }>(
    `SELECT suspended_at IS NOT NULL AS suspended, blocked_at IS NOT NULL AS blocked
       FROM sites WHERE id = $1`,
    [String(siteId)]
  );
  if (rows[0]?.blocked) return 'SITE_BLOCKED';
  return rows[0]?.suspended ? 'SITE_SUSPENDED' : null;
}

/** What the billing page shows when something is over the plan. */
export async function overageSummary(organizationId: string) {
  const { plan, limits } = await limitsFor(organizationId);
  const pool = getPool();
  const [sites, members] = await Promise.all([
    pool.query<{ id: string; name: string; domain: string; suspended_at: Date | null }>(
      `SELECT id, name, domain, suspended_at FROM sites
        WHERE organization_id = $1 ORDER BY created_at, id`,
      [organizationId]
    ),
    pool.query<{
      id: string;
      kind: string;
      name: string;
      email: string;
      role: string;
      owner: boolean;
      seat_suspended_at: Date | null;
    }>(
      `SELECT u.id, 'user' AS kind, u.name, u.email, u.role, (u.id = o.owner_user_id) AS owner,
              u.seat_suspended_at, u.created_at
         FROM users u JOIN organizations o ON o.id = u.organization_id
        WHERE u.organization_id = $1 AND u.is_active
       UNION ALL
       SELECT t.id, 'team', t.name, t.email, t.role, false, t.seat_suspended_at, t.created_at
         FROM teams t WHERE t.organization_id = $1 AND t.is_active
       ORDER BY owner DESC, created_at, id`,
      [organizationId]
    )
  ]);
  return {
    plan,
    limits: { sites: limits.sites, agents: limits.agents },
    sites: sites.rows.map((s) => ({
      id: s.id,
      name: s.name,
      domain: s.domain,
      suspendedAt: s.suspended_at
    })),
    members: members.rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      name: m.name,
      email: m.email,
      role: m.role,
      owner: m.owner,
      suspendedAt: m.seat_suspended_at
    })),
    over: sites.rows.some((s) => s.suspended_at) || members.rows.some((m) => m.seat_suspended_at)
  };
}

// The socket server, when this process runs one (server.ts), so a change
// made from a webhook or the sweep reaches live connections.
let realtime: Server | null = null;
export function usePlanOverageRealtime(io: Server | null): void {
  realtime = io;
}
