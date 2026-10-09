-- 0010 — free trial of the paid plan (plan v10 PRD-15).
--
-- A new workspace gets Pro for TRIAL_DAYS (14) without a card. Nothing is
-- written when it ends: the plan in force is computed from the clock
-- (services/entitlements.ts#getPlan), exactly like a cancelled subscription
-- that runs out. The two timestamps only remember which mails went out.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ended_notified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at
  ON organizations (trial_ends_at) WHERE trial_ends_at IS NOT NULL;
