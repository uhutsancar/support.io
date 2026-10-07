-- 0015 — Over the plan after a downgrade (plan v10 BIL-04, KARAR-BIL-1).
--
-- Nothing is deleted when a workspace moves to a smaller plan. Sites over
-- the new limit are suspended (sites.suspended_at, since 0011): their widget
-- answers like a switched-off site, their conversations stay readable. Team
-- members over the seat limit keep signing in and reading, but cannot write
-- or change anything until the owner picks who keeps a seat or upgrades.

ALTER TABLE users ADD COLUMN IF NOT EXISTS seat_suspended_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS seat_suspended_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sites_org_suspended
  ON sites (organization_id) WHERE suspended_at IS NOT NULL;

-- Audit trail: seats taken away and given back. Only the action list widens.
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
  'SEAT_SUSPENDED', 'SEAT_RESTORED'));
