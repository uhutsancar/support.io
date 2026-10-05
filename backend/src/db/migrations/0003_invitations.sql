-- 0003 — inviting agents instead of creating them with a password.
--
-- An admin used to create an agent by typing the agent's e-mail and a
-- password for them. Now the admin sends an invitation; the agent opens the
-- link, chooses their own password, and only then does a `teams` row exist.
-- As with auth_tokens, only a SHA-256 of the invitation token is stored.
CREATE TABLE IF NOT EXISTS invitations (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  email            text NOT NULL,
  role             text NOT NULL,
  -- Site ids the agent will be restricted to; empty means every site.
  assigned_sites   text[] NOT NULL DEFAULT '{}',
  token_hash       text NOT NULL,
  expires_at       timestamptz NOT NULL,
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  -- A users.id or teams.id; polymorphic, so no FK.
  invited_by       varchar(24),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_role_check CHECK (role IN ('admin', 'manager', 'agent'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_token_hash ON invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_org_created ON invitations (organization_id, created_at DESC);
-- One open invitation per address per organization; re-inviting revokes the
-- previous one first.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_open_email
  ON invitations (organization_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  'SITE_AI_SETTINGS_UPDATED', 'SITE_INTEGRATION_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED'));
