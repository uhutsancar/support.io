-- 0011 — what the inbox needs before launch (plan v10 PRD-01…08, SEC-09,
-- SEC-17, BIL-04).

-- A site's chat behaviour beyond the bubble's look: missed-chat mails, the
-- offline form, e-mailed replies, the pre-chat form and its consent box,
-- satisfaction ratings, transcripts, spam mode. One jsonb, read with the site;
-- the defaults live in services/chatSettings.ts.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS chat_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Set when a plan downgrade leaves more sites than the plan allows (BIL-04):
-- the widget stays silent and the panel shows the site read-only.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Conversations: what the visitor left in the forms, and the mails sent.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS visitor_phone text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS prechat jsonb NOT NULL DEFAULT '{}'::jsonb;
-- When the visitor ticked the site's privacy notice box (PRD-05).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS visitor_consent_at timestamptz;
-- When the "unanswered chat" mail went out for it (PRD-01); once only.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS missed_notified_at timestamptz;
-- The visitor asked not to get e-mailed replies for this conversation.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS email_replies_opt_out boolean NOT NULL DEFAULT false;
-- When a satisfaction request was mailed (PRD-04).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS csat_requested_at timestamptz;
-- Hidden from the open inbox until then (PRD-07).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
-- Set on the conversation that was merged into another one.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS merged_into_id varchar(24);

CREATE INDEX IF NOT EXISTS idx_conversations_missed_due
  ON conversations (created_at)
  WHERE missed_notified_at IS NULL AND first_response_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_snoozed
  ON conversations (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- Unanswered-chat notices waiting to be mailed, one row per person and site:
-- the first goes out at once, the ones within the next ten minutes (or the
-- hour, for an hourly digest) go out together (PRD-01).
CREATE TABLE IF NOT EXISTS missed_chat_notices (
  account_type   text NOT NULL,
  account_id     varchar(24) NOT NULL,
  site_id        varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  pending        jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_sent_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_type, account_id, site_id),
  CONSTRAINT missed_chat_notices_account_type_check CHECK (account_type IN ('user', 'team'))
);

-- Saved replies an agent drops in with "/" (PRD-03). site_id NULL: every site
-- of the organization.
CREATE TABLE IF NOT EXISTS saved_replies (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) REFERENCES sites (id) ON DELETE CASCADE,
  shortcut         text NOT NULL,
  title            text NOT NULL,
  body             text NOT NULL,
  created_by       varchar(24),
  usage_count      integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_replies_shortcut_check CHECK (shortcut ~ '^[a-z0-9][a-z0-9_-]{0,31}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_replies_shortcut ON saved_replies (organization_id, shortcut);

-- The organization's list of conversation tags, with a colour (PRD-07).
-- conversations.tags keeps the names.
CREATE TABLE IF NOT EXISTS conversation_tag_catalog (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name             text NOT NULL,
  color            text NOT NULL DEFAULT '#6366F1',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_tag_catalog_name
  ON conversation_tag_catalog (organization_id, lower(name));

-- Visitors an agent blocked (SEC-09): by visitor id and by a hash of the IP,
-- for 30 days unless lifted earlier.
CREATE TABLE IF NOT EXISTS visitor_blocks (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  visitor_id       text,
  ip_hash          text,
  reason           text,
  blocked_by       varchar(24),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visitor_blocks_site_visitor ON visitor_blocks (site_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_blocks_site_ip ON visitor_blocks (site_id, ip_hash);

-- How long conversations are kept (SEC-17): NULL means the plan's default.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS retention_days integer;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_retention_days_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_retention_days_check
  CHECK (retention_days IS NULL OR retention_days BETWEEN 30 AND 1830);

-- The set-up mails a new owner gets (PRD-08): which went out, and when the
-- widget was first seen on a page.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS activation jsonb NOT NULL DEFAULT '{}'::jsonb;
