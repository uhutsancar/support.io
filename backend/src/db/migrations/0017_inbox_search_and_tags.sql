-- 0017 — the inbox's word search and its tag filter (plan v10 PRD-07).
--
-- Message text is searched by words with Turkish stemming as well as by
-- substring: "siparişim" finds a message that says "siparişimi", which the
-- trigram index alone (idx_messages_content_trgm, 0000) does not. The
-- expression is the one db/inboxQueries.ts writes, so the planner uses it.
--
-- Conversations are filtered by tag (conversations.tags, a text array).
--
-- Plain CREATE INDEX (migrations run in a transaction). At launch the tables
-- are small; on a large table this would be a CONCURRENTLY build by hand
-- first (docs/production-runbook.md).

CREATE INDEX IF NOT EXISTS idx_messages_content_fts
  ON messages USING gin (to_tsvector('turkish'::regconfig, coalesce(content, '')));

CREATE INDEX IF NOT EXISTS idx_conversations_tags
  ON conversations USING gin (tags);
