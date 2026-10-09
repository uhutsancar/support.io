-- 0022 — reports (plan v10 PRD-22): the weekly summary mail and report files.
--
-- The weekly mail goes out once per week and workspace; this column says when
-- it last did, so a sweep that runs every hour sends it only once. A report
-- downloaded as a file carries visitors' names and addresses, so each
-- download is audited; only the action list widens.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS weekly_report_sent_at timestamptz;

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
  'REPORT_EXPORTED'));
