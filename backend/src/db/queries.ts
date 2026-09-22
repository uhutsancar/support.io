'use strict';

// Hand written queries for the places where a document-database access pattern
// would turn into one round trip per row. Each function returns exactly the
// shape the route already produced, so callers keep their existing logic.

// Newest message of every conversation in one pass. `DISTINCT ON` walks the
// (conversation_id, created_at DESC) index instead of running a query per row.
import { query } from './pool';
import Message from '../models/Message';

async function latestMessagesByConversation(conversationIds: string[]) {
  const result = new Map();
  if (!conversationIds || !conversationIds.length) return result;

  const { rows } = await query(
    `SELECT DISTINCT ON (conversation_id) *
       FROM messages
      WHERE conversation_id = ANY($1)
      ORDER BY conversation_id, created_at DESC`,
    [conversationIds]
  );

  for (const row of rows) {
    result.set(row.conversation_id, Message.$model.hydrate(row));
  }
  return result;
}

// Unread totals per site for one organization, aggregated by the database.
async function unreadCountsByOrganization(organizationId: string) {
  const { rows } = await query(
    `SELECT site_id, sum(unread_count)::int AS total
       FROM conversations
      WHERE organization_id = $1 AND unread_count > 0
      GROUP BY site_id`,
    [organizationId]
  );

  let totalUnreadCount = 0;
  const unreadBySite: Record<string, number> = {};
  for (const row of rows) {
    totalUnreadCount += row.total;
    unreadBySite[row.site_id] = row.total;
  }
  return { totalUnreadCount, unreadBySite };
}

// Active / resolved conversation counts for many agents at once.
async function conversationCountsByAgent(agentIds: string[]) {
  const result = new Map();
  if (!agentIds || !agentIds.length) return result;

  const { rows } = await query(
    `SELECT assigned_agent_id AS agent_id,
            count(*) FILTER (WHERE status IN ('open', 'assigned', 'pending'))::int AS active,
            count(*) FILTER (WHERE status IN ('resolved', 'closed'))::int AS resolved
       FROM conversations
      WHERE assigned_agent_id = ANY($1)
      GROUP BY assigned_agent_id`,
    [agentIds]
  );

  for (const row of rows) {
    result.set(row.agent_id, { activeConversations: row.active, resolvedConversations: row.resolved });
  }
  return result;
}

// Per-status breakdown for a single agent in one scan.
async function agentConversationStats(agentId: string) {
  const { rows } = await query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'assigned')::int AS assigned,
            count(*) FILTER (WHERE status = 'pending')::int AS pending,
            count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            count(*) FILTER (WHERE status = 'closed')::int AS closed
       FROM conversations
      WHERE assigned_agent_id = $1`,
    [agentId]
  );
  return rows[0];
}

// Per-status breakdown for a department in one scan.
async function departmentConversationStats(departmentId: string) {
  const { rows } = await query(
    `SELECT count(*)::int AS total,
            count(*) FILTER (WHERE status = 'open' AND assigned_agent_id IS NULL)::int AS unassigned,
            count(*) FILTER (WHERE status = 'assigned' AND assigned_agent_id IS NOT NULL)::int AS assigned,
            count(*) FILTER (WHERE status = 'pending')::int AS pending,
            count(*) FILTER (WHERE status = 'resolved')::int AS resolved,
            count(*) FILTER (WHERE status = 'closed')::int AS closed,
            count(*) FILTER (WHERE status IN ('unassigned', 'assigned', 'pending'))::int AS active
       FROM conversations
      WHERE department_id = $1`,
    [departmentId]
  );
  return rows[0];
}

// Team chat participants can be Team agents or User accounts. Both tables are
// read once for the whole page instead of once per participant.
async function resolveChatParticipants(ids: string[]) {
  const map = new Map();
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return map;

  const columns = 'id, name, email, avatar, status, role';
  const [teams, users] = await Promise.all([
    query(`SELECT ${columns} FROM teams WHERE id = ANY($1)`, [unique]),
    query(`SELECT ${columns} FROM users WHERE id = ANY($1)`, [unique])
  ]);

  // Team rows win, matching the previous "look in Team first" lookup order.
  for (const row of users.rows) map.set(row.id, { _id: row.id, name: row.name, email: row.email, avatar: row.avatar, status: row.status, role: row.role });
  for (const row of teams.rows) map.set(row.id, { _id: row.id, name: row.name, email: row.email, avatar: row.avatar, status: row.status, role: row.role });
  return map;
}

// Total unread team-chat messages across every chat the user takes part in.
async function unreadTeamChatCount(userId: string) {
  const { rows } = await query(
    `SELECT count(*)::int AS c
       FROM team_messages m
       JOIN team_chats tc ON tc.chat_id = m.chat_id
       JOIN team_chat_participants p ON p.team_chat_id = tc.id AND p.participant_id = $1
      WHERE m.sender_id <> $1
        AND NOT EXISTS (
          SELECT 1 FROM team_message_read_by r
           WHERE r.team_message_id = m.id AND r.reader_id = $1
        )`,
    [userId]
  );
  return rows[0].c;
}

// Performance figures for one agent over a window, aggregated by the database.
//
// The admin panel previously invented these numbers client side with
// Math.random(). Everything below is derived from conversations actually
// assigned to the agent:
//
//   resolved         conversations they closed or resolved inside the window
//   firstResponse    minutes between a conversation opening and its first reply
//   csat             average of the visitor rating stored on the conversation
//   slaCompliance    share of conversations whose first-response SLA was met
//
// `days` is validated by the caller and interpolated as an interval, never
// taken from user input directly.
async function agentPerformance(agentId: string, days: number) {
  const since = `${parseInt(String(days), 10)} days`;

  const [totals, daily, trend, active] = await Promise.all([
    query(
      `SELECT
         count(*) FILTER (WHERE status IN ('resolved', 'closed'))::int AS resolved,
         avg(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60)
           FILTER (WHERE first_response_at IS NOT NULL) AS avg_first_response_minutes,
         avg(NULLIF((rating ->> 'score'), '')::numeric)
           FILTER (WHERE rating ->> 'score' IS NOT NULL) AS csat,
         count(*) FILTER (WHERE sla ->> 'firstResponseStatus' = 'met')::int AS sla_met,
         count(*) FILTER (WHERE sla ->> 'firstResponseStatus' IN ('met', 'breached'))::int AS sla_decided
       FROM conversations
      WHERE assigned_agent_id = $1
        AND created_at >= now() - $2::interval`,
      [agentId, since]
    ),
    query(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              count(c.id) FILTER (WHERE c.status IN ('resolved', 'closed'))::int AS resolved,
              count(c.id)::int AS assigned
         FROM generate_series(
                date_trunc('day', now() - $2::interval),
                date_trunc('day', now()),
                interval '1 day') AS d(day)
         LEFT JOIN conversations c
                ON c.assigned_agent_id = $1
               AND date_trunc('day', c.created_at) = d.day
        GROUP BY d.day
        ORDER BY d.day`,
      [agentId, since]
    ),
    query(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
              avg(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60) AS avg_minutes
         FROM generate_series(
                date_trunc('day', now() - $2::interval),
                date_trunc('day', now()),
                interval '1 day') AS d(day)
         LEFT JOIN conversations c
                ON c.assigned_agent_id = $1
               AND c.first_response_at IS NOT NULL
               AND date_trunc('day', c.created_at) = d.day
        GROUP BY d.day
        ORDER BY d.day`,
      [agentId, since]
    ),
    // Current workload is a live figure, so it deliberately ignores the window.
    query(
      `SELECT count(*)::int AS c
         FROM conversations
        WHERE assigned_agent_id = $1
          AND status IN ('open', 'assigned', 'pending')`,
      [agentId]
    )
  ]);

  const t = totals.rows[0];
  const round = (value: unknown, digits = 1): number | null =>
    value === null || value === undefined ? null : Number(Number(value).toFixed(digits));

  return {
    totalResolved: t.resolved,
    avgResponseTime: round(t.avg_first_response_minutes),
    csatScore: round(t.csat),
    slaCompliance: t.sla_decided > 0 ? Math.round((t.sla_met / t.sla_decided) * 100) : null,
    activeChats: active.rows[0].c,
    dailyActivity: daily.rows.map((r) => ({ day: r.day, resolved: r.resolved, assigned: r.assigned })),
    responseTrend: trend.rows.map((r) => ({ day: r.day, avgMinutes: round(r.avg_minutes) }))
  };
}

export { latestMessagesByConversation, unreadCountsByOrganization, conversationCountsByAgent, agentConversationStats, departmentConversationStats, resolveChatParticipants, unreadTeamChatCount, agentPerformance };