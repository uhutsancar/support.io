-- 0024 — the referral programme (plan v10 PRD-23).
--
-- Every workspace gets a code of its own the first time it asks for its link.
-- A workspace that signs up with a code is recorded once, as referred by the
-- code's owner; it qualifies when its first paid subscription becomes
-- active, and the referrer is then given a free month (a one-time Paddle
-- discount on their next bill) — once per referred workspace.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS referral_code text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_organizations_referral_code ON organizations (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS referrals (
  id                        varchar(24) PRIMARY KEY,
  referrer_organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  referred_organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  created_at                timestamptz NOT NULL DEFAULT now(),
  -- The referred workspace's first paid subscription became active.
  qualified_at              timestamptz,
  -- The referrer's free month was given; what it was given with.
  rewarded_at               timestamptz,
  reward_reference          text,
  CONSTRAINT referrals_not_self CHECK (referrer_organization_id <> referred_organization_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_referrals_referred ON referrals (referred_organization_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals (referrer_organization_id);
CREATE INDEX IF NOT EXISTS idx_referrals_unrewarded ON referrals (qualified_at)
  WHERE qualified_at IS NOT NULL AND rewarded_at IS NULL;

-- Audit trail: a free month given. Only the action list widens.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_FAILED_LOCKED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  -- Kept so the history written before 0005 stays valid.
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_INTEGRATION_UPDATED', 'SITE_ASSISTANT_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED',
  'SITE_CREATED', 'SITE_UPDATED', 'SITE_DELETED',
  'WIDGET_SETTINGS_UPDATED', 'CONVERSATION_ASSIGNED',
  -- account security
  'PASSWORD_CHANGED', 'EMAIL_CHANGE_REQUESTED', 'EMAIL_CHANGED',
  'MFA_ENABLED', 'MFA_DISABLED', 'MFA_RECOVERY_USED', 'SESSIONS_REVOKED',
  'SECURITY_SETTINGS_UPDATED',
  -- visitors and retention
  'VISITOR_BLOCKED', 'VISITOR_UNBLOCKED', 'VISITOR_DATA_DELETED',
  'RETENTION_PURGE', 'RETENTION_SETTINGS_UPDATED',
  -- assistant
  'ASSISTANT_ENABLED', 'ASSISTANT_KILL_SWITCH',
  -- integrations and plan
  'API_KEY_CREATED', 'API_KEY_REVOKED',
  'WEBHOOK_CREATED', 'WEBHOOK_UPDATED', 'WEBHOOK_DELETED',
  'SITE_SUSPENDED', 'SITE_REACTIVATED',
  'TRIAL_STARTED', 'TRIAL_ENDED',
  'SAVED_REPLY_CREATED', 'SAVED_REPLY_UPDATED', 'SAVED_REPLY_DELETED',
  'CONVERSATIONS_MERGED',
  -- over the plan after a downgrade (0015)
  'SEAT_SUSPENDED', 'SEAT_RESTORED',
  -- sign-in with Google (0021)
  'GOOGLE_LINKED', 'GOOGLE_UNLINKED',
  -- a report downloaded as a file (0022)
  'REPORT_EXPORTED',
  -- a referral's free month given (0024)
  'REFERRAL_REWARDED'));
