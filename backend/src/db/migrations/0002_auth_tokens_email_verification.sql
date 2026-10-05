-- 0002 — e-mail verification, password reset, and sessions that can end.
--
-- auth_tokens holds one-time links sent by e-mail. Only a SHA-256 of the
-- token is stored: a database leak must not hand out working reset links.
--
-- session_version is signed into every session (`sv`). Raising it ends every
-- session of that account at once — what a password reset needs, since the
-- reason for a reset is often that someone else has the password.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

-- Accounts that exist already predate verification; they are not locked out
-- of the widget by a rule that did not exist when they signed up.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
UPDATE teams SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id            varchar(24) PRIMARY KEY,
  -- A users.id or a teams.id, as account_type says; polymorphic, so no FK.
  account_id    varchar(24) NOT NULL,
  account_type  text NOT NULL,
  purpose       text NOT NULL,
  token_hash    text NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_tokens_account_type_check CHECK (account_type IN ('user', 'team')),
  CONSTRAINT auth_tokens_purpose_check CHECK (purpose IN ('verify', 'reset'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_tokens_hash ON auth_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_account ON auth_tokens (account_type, account_id, purpose);
-- The retention sweep deletes expired rows.
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON auth_tokens (expires_at);

-- New audited actions. A CHECK cannot be widened in place.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  'SITE_AI_SETTINGS_UPDATED', 'SITE_INTEGRATION_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET'));
