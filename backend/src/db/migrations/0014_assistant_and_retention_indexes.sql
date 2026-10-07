-- 0014 — Two indexes the new reports and the nightly purge need (plan v10
-- OBS-07, SEC-17, PERF-03).
--
-- The assistant's own messages, by time: the assistant overview, org:stats
-- and the weekly report count them for the last 7-30 days. Without it every
-- one of those reads the whole messages table.
--
-- A conversation's last activity per organization: the nightly retention
-- purge looks up conversations whose last message is older than the
-- workspace's window, organization by organization.
--
-- Plain CREATE INDEX (migrations run in a transaction). At launch the
-- tables are small; on a large table this would be a CONCURRENTLY build by
-- hand first (docs/production-runbook.md).

CREATE INDEX IF NOT EXISTS idx_messages_assistant_created
  ON messages (created_at)
  WHERE sender_id = 'assistant';

CREATE INDEX IF NOT EXISTS idx_conversations_org_last_activity
  ON conversations (organization_id, (coalesce(last_message_at, created_at)));
