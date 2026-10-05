-- 0007 — AI assistant answers per organization and month.
--
-- Each plan includes a number of assistant answers a month
-- (domain/plans.ts). The answer is counted by the same kind of conditional
-- UPSERT as conversations (services/entitlements.ts), so two answers at the
-- same moment cannot both take the last one.
ALTER TABLE organization_usage_monthly
  ADD COLUMN IF NOT EXISTS assistant_replies integer NOT NULL DEFAULT 0;
