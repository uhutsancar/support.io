-- 0004 — what each organization used, per calendar month (UTC).
--
-- The conversation quota is enforced against this row, by the same UPSERT
-- that counts the new conversation (services/entitlements.ts): the row is
-- only incremented while it is under the plan's limit, so two conversations
-- opening at the same moment cannot both take the last slot.
CREATE TABLE IF NOT EXISTS organization_usage_monthly (
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  period           char(7) NOT NULL,
  conversations    integer NOT NULL DEFAULT 0,
  messages         integer NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, period),
  CONSTRAINT organization_usage_monthly_period_check CHECK (period ~ '^\d{4}-\d{2}$')
);
