-- 0021 — sign-in with Google (plan v10 PRD-14).
--
-- An account is tied to a Google account by Google's own subject id (`sub`),
-- which never changes; the address is kept only to show which Google account
-- is connected. An account is found by its `sub` and never by its address:
-- someone who controls a Google account with the same address does not get
-- into an existing account unless its owner connected it while signed in.
-- A Google account opens one account at most, in either table; the indexes
-- hold that within a table and services/googleSignIn.ts across the two.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS google_sub text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS google_email text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub ON users (google_sub)
  WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_google_sub ON teams (google_sub)
  WHERE google_sub IS NOT NULL;

-- Audit trail: a Google account connected or disconnected. Only the action
-- list widens.
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
  'GOOGLE_LINKED', 'GOOGLE_UNLINKED'));
