-- 0009 — account security (plan v10 SEC-03, SEC-04, SEC-05, SEC-06).
--
-- auth_tokens gains a third purpose, `email_change`: the link sent to a new
-- address before it replaces the old one. The new address travels in
-- `payload`, so the token row says what it confirms. A verification link
-- also records the password hash it was issued for (payload.pw): a link
-- mailed for one sign-up attempt cannot verify an account whose password
-- someone else has set since.
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_purpose_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_purpose_check
  CHECK (purpose IN ('verify', 'reset', 'email_change'));

-- Two-step sign-in with an authenticator app (TOTP, RFC 6238). The secret
-- is sealed (config/secretBox.ts) before it is stored; recovery codes are
-- kept only as keyed hashes; totp_last_step refuses a code that was already
-- used once, within its own 30-second window or a later one.
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step bigint;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS totp_secret_enc text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS totp_last_step bigint;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- billing_exempt: the plan is the one set by hand (scripts/updatePlan.ts
-- --exempt) and no subscription event moves it — the platform owner's own
-- workspace, beta customers. enforce_2fa: every member must sign in with a
-- second step (an Enterprise setting).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enforce_2fa boolean NOT NULL DEFAULT false;

-- Audited actions added by this release and the ones right after it. Only
-- the list widens; no row changes.
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
  'CONVERSATIONS_MERGED'));
