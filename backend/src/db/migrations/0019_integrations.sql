-- 0019 — notifications to Slack and Telegram, and outgoing webhooks (plan v10
-- PRD-11).
--
-- An integration belongs to a workspace and, optionally, to one site
-- (site_id NULL: every site). Its address and keys — the Slack URL, the
-- Telegram bot token, the webhook's signing secret — are sealed together in
-- `config` (config/secretBox.ts) and never leave the server in the clear
-- again; the panel sees a masked form.
--
-- Each event becomes a delivery row: tried at once, then again with growing
-- waits for up to 24 hours. The payload, which carries visitor data, is
-- dropped as soon as the delivery succeeds or is given up; the row stays as
-- the delivery log for 30 days (services/dataRetention.ts).

CREATE TABLE IF NOT EXISTS integrations (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) REFERENCES sites (id) ON DELETE CASCADE,
  kind             text NOT NULL,
  name             text NOT NULL,
  events           text[] NOT NULL DEFAULT '{}',
  config           text NOT NULL,
  hint             text,
  is_active        boolean NOT NULL DEFAULT true,
  created_by       varchar(24),
  last_status      text,
  last_delivery_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_kind_check CHECK (kind IN ('webhook', 'slack', 'telegram'))
);
CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations (organization_id);

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id               varchar(24) PRIMARY KEY,
  integration_id   varchar(24) NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  event            text NOT NULL,
  payload          jsonb,
  status           text NOT NULL DEFAULT 'pending',
  attempts         integer NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  last_status_code integer,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  CONSTRAINT integration_deliveries_status_check CHECK (status IN ('pending', 'delivered', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_due
  ON integration_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_log
  ON integration_deliveries (integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_created
  ON integration_deliveries (created_at);
