// Report figures beyond the dashboard (plan v10 PRD-22): the conversations
// of a window as rows, the SLA breaches, the week-by-hour heatmap and the
// weekly summary. Like db/analyticsQueries.ts, every query is scoped to one
// organization (and optionally one of its sites) and computed by PostgreSQL.

import { query } from './pool';

/** At most this many conversations go into one export. */
export const EXPORT_ROW_LIMIT = 50_000;

function scope(organizationId: string, siteId: string | null, days: number) {
  const params: unknown[] = [organizationId, `${days} days`];
  let sql = 'c.organization_id = $1 AND c.created_at >= now() - $2::interval';
  if (siteId) {
    params.push(siteId);
    sql += ` AND c.site_id = $${params.length}`;
  }
  return { sql, params };
}

/** The person a conversation is assigned to: a team member or an account owner. */
const AGENT_NAME = `coalesce(
  (SELECT t.name FROM teams t WHERE t.id = c.assigned_agent_id),
  (SELECT u.name FROM users u WHERE u.id = c.assigned_agent_id))`;

export interface ConversationRow {
  ticket_id: string | null;
  created_at: Date;
  site: string;
  status: string;
  priority: string;
  channel: string;
  visitor_name: string;
  visitor_email: string | null;
  agent: string | null;
  department: string | null;
  tags: string[];
  messages: number;
  first_response_minutes: number | null;
  resolution_minutes: number | null;
  sla_first_response: string | null;
  rating: number | null;
  rating_comment: string | null;
}

/** Every conversation started in the window, newest first. */
export async function conversationRows(
  organizationId: string,
  siteId: string | null,
  days: number,
  limit = EXPORT_ROW_LIMIT
): Promise<ConversationRow[]> {
  const { sql, params } = scope(organizationId, siteId, days);
  params.push(limit);
  const { rows } = await query<ConversationRow>(
    `SELECT c.ticket_id, c.created_at, s.name AS site, c.status, c.priority, c.channel,
            c.visitor_name, c.visitor_email, ${AGENT_NAME} AS agent, d.name AS department,
            c.tags,
            (SELECT count(*)::int FROM messages m
              WHERE m.conversation_id = c.id AND m.message_type <> 'system') AS messages,
            round((EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60)::numeric, 1)::float
              AS first_response_minutes,
            round((EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 60)::numeric, 1)::float
              AS resolution_minutes,
            c.sla ->> 'firstResponseStatus' AS sla_first_response,
            NULLIF(c.rating ->> 'score', '')::int AS rating,
            c.rating ->> 'feedback' AS rating_comment
       FROM conversations c
       JOIN sites s ON s.id = c.site_id
       LEFT JOIN departments d ON d.id = c.department_id
      WHERE ${sql}
      ORDER BY c.created_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

export interface SlaBreachRow {
  id: string;
  ticket_id: string | null;
  site_id: string;
  site: string;
  created_at: Date;
  breached_at: string | null;
  waited_minutes: number | null;
  status: string;
  priority: string;
  agent: string | null;
  department: string | null;
}

/** Conversations whose first answer came later than the SLA allowed, newest first. */
export async function slaBreaches(
  organizationId: string,
  siteId: string | null,
  days: number,
  limit = 100
): Promise<SlaBreachRow[]> {
  const { sql, params } = scope(organizationId, siteId, days);
  params.push(limit);
  const { rows } = await query<SlaBreachRow>(
    `SELECT c.id, c.ticket_id, c.site_id, s.name AS site, c.created_at,
            c.sla ->> 'firstResponseBreachedAt' AS breached_at,
            round((EXTRACT(EPOCH FROM (coalesce(c.first_response_at, now()) - c.created_at)) / 60)::numeric, 1)::float
              AS waited_minutes,
            c.status, c.priority, ${AGENT_NAME} AS agent, d.name AS department
       FROM conversations c
       JOIN sites s ON s.id = c.site_id
       LEFT JOIN departments d ON d.id = c.department_id
      WHERE ${sql} AND c.sla ->> 'firstResponseStatus' = 'breached'
      ORDER BY c.created_at DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

/**
 * Conversations started per weekday and hour, in the viewer's time zone:
 * seven rows (Monday first) of twenty-four counts. The zone is checked by the
 * caller; PostgreSQL turns it into local time.
 */
export async function weekHeatmap(
  organizationId: string,
  siteId: string | null,
  days: number,
  timeZone: string
): Promise<number[][]> {
  const { sql, params } = scope(organizationId, siteId, days);
  params.push(timeZone);
  const tz = `$${params.length}`;
  const { rows } = await query<{ dow: number; hour: number; n: number }>(
    `SELECT EXTRACT(ISODOW FROM c.created_at AT TIME ZONE ${tz})::int AS dow,
            EXTRACT(HOUR FROM c.created_at AT TIME ZONE ${tz})::int AS hour,
            count(*)::int AS n
       FROM conversations c
      WHERE ${sql}
      GROUP BY 1, 2`,
    params
  );
  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const { dow, hour, n } of rows) grid[dow - 1][hour] = n;
  return grid;
}

export interface WeekSummary {
  conversations: number;
  resolved: number;
  avgFirstResponseMinutes: number | null;
  slaPercent: number | null;
  csat: number | null;
  rated: number;
  assistantAnswered: number;
  busiestHour: number | null;
  topAgent: { name: string; resolved: number } | null;
}

/** The last seven days of one organization, for the weekly mail. */
export async function weekSummary(organizationId: string, timeZone: string): Promise<WeekSummary> {
  const { sql, params } = scope(organizationId, null, 7);
  const [totals, hour, agent, assistant] = await Promise.all([
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE c.status IN ('resolved', 'closed'))::int AS resolved,
              avg(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60)
                FILTER (WHERE c.first_response_at IS NOT NULL) AS first_response,
              count(*) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'met')::int AS sla_met,
              count(*) FILTER (WHERE c.sla ->> 'firstResponseStatus' IN ('met', 'breached'))::int
                AS sla_decided,
              avg(NULLIF(c.rating ->> 'score', '')::numeric)
                FILTER (WHERE c.rating ->> 'score' IS NOT NULL) AS csat,
              count(*) FILTER (WHERE c.rating ->> 'score' IS NOT NULL)::int AS rated
         FROM conversations c WHERE ${sql}`,
      params
    ),
    query<{ hour: number }>(
      `SELECT EXTRACT(HOUR FROM c.created_at AT TIME ZONE $3)::int AS hour
         FROM conversations c WHERE ${sql}
        GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`,
      [...params, timeZone]
    ),
    query<{ name: string; resolved: number }>(
      `SELECT ${AGENT_NAME} AS name, count(*)::int AS resolved
         FROM conversations c
        WHERE ${sql} AND c.status IN ('resolved', 'closed') AND c.assigned_agent_id IS NOT NULL
        GROUP BY c.assigned_agent_id ORDER BY resolved DESC LIMIT 1`,
      params
    ),
    query<{ n: number }>(
      `SELECT count(DISTINCT m.conversation_id)::int AS n
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE ${sql} AND m.assistant IS NOT NULL AND m.assistant ->> 'handoff' IS NULL`,
      params
    )
  ]);
  const t = totals.rows[0];
  const round = (v: unknown, digits = 1) =>
    v === null || v === undefined ? null : Number(Number(v).toFixed(digits));
  return {
    conversations: t.total,
    resolved: t.resolved,
    avgFirstResponseMinutes: round(t.first_response),
    slaPercent: t.sla_decided > 0 ? Math.round((t.sla_met / t.sla_decided) * 100) : null,
    csat: round(t.csat, 1),
    rated: t.rated,
    assistantAnswered: assistant.rows[0]?.n ?? 0,
    busiestHour: hour.rows[0]?.hour ?? null,
    topAgent: agent.rows[0]?.name ? agent.rows[0] : null
  };
}
