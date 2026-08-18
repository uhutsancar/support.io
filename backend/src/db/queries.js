'use strict';

// Hand written queries for the places where a document-database access pattern
// would turn into one round trip per row. Each function returns exactly the
// shape the route already produced, so callers keep their existing logic.

const { query } = require('./pool');

// Newest message of every conversation in one pass. `DISTINCT ON` walks the
// (conversation_id, created_at DESC) index instead of running a query per row.
async function latestMessagesByConversation(conversationIds) {
  const result = new Map();
  if (!conversationIds || !conversationIds.length) return result;

  const { rows } = await query(
    `SELECT DISTINCT ON (conversation_id) *
       FROM messages
      WHERE conversation_id = ANY($1)
      ORDER BY conversation_id, created_at DESC`,
    [conversationIds]
  );

  const Message = require('../models/Message');
  for (const row of rows) {
    result.set(row.conversation_id, Message.$model.hydrate(row));
  }
  return result;
}

// Unread totals per site for one organization, aggregated by the database.
async function unreadCountsByOrganization(organizationId) {
  const { rows } = await query(
    `SELECT site_id, sum(unread_count)::int AS total
       FROM conversations
      WHERE organization_id = $1 AND unread_count > 0
      GROUP BY site_id`,
    [organizationId]
  );

  let totalUnreadCount = 0;
  const unreadBySite = {};
  for (const row of rows) {
    totalUnreadCount += row.total;
    unreadBySite[row.site_id] = row.total;
  }
  return { totalUnreadCount, unreadBySite };
}

// Active / resolved conversation counts for many agents at once.
async function conversationCountsByAgent(agentIds) {
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
async function agentConversationStats(agentId) {
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
async function departmentConversationStats(departmentId) {
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
async function resolveChatParticipants(ids) {
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
async function unreadTeamChatCount(userId) {
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

module.exports = {
  latestMessagesByConversation,
  unreadCountsByOrganization,
  conversationCountsByAgent,
  agentConversationStats,
  departmentConversationStats,
  resolveChatParticipants,
  unreadTeamChatCount
};
