-- 0013 — An agent marks an assistant answer as wrong (plan v10 AI-06).
--
-- One row per answer flagged: who, when and an optional note. Read for the
-- assistant's quality report (P2); the conversation going away takes it
-- with it. The answer itself also carries `flagged` in messages.assistant,
-- so the inbox shows it without a join.

CREATE TABLE IF NOT EXISTS assistant_feedback (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  conversation_id  varchar(24) NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  message_id       varchar(24) NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id          varchar(24),
  verdict          text NOT NULL DEFAULT 'wrong',
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_feedback_verdict_check CHECK (verdict IN ('wrong')),
  CONSTRAINT assistant_feedback_message_unique UNIQUE (message_id)
);
CREATE INDEX IF NOT EXISTS idx_assistant_feedback_org_created
  ON assistant_feedback (organization_id, created_at DESC);
