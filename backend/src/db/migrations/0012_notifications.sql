-- 0012 — notifications (plan v10 PRD-01, PRD-02, PRD-09).

-- Team accounts get the preferences users already have: how they hear about
-- unanswered chats, which events raise a desktop notification, the language
-- their mails go out in.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The last time an agent's reply went to the visitor by e-mail (PRD-01): only
-- replies written after it, while the visitor is away, are mailed next.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS visitor_reply_mailed_at timestamptz;

-- Web Push subscriptions of the panel (PRD-09): one per browser an agent
-- allowed. The endpoint is the push service's address; the keys encrypt.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            varchar(24) PRIMARY KEY,
  account_type  text NOT NULL,
  account_id    varchar(24) NOT NULL,
  organization_id varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  CONSTRAINT push_subscriptions_account_type_check CHECK (account_type IN ('user', 'team'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_endpoint ON push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_account ON push_subscriptions (account_type, account_id);
