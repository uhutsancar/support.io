-- 0005 — the self-hosted AI is gone; a small FAQ assistant on Gemini replaces it.
--
-- What the old assistant needed — per-site AI settings (mode, tone, blocked
-- terms...), an order-lookup integration, an ownership version and per-message
-- AI metadata — is dropped. What the new one needs is a switch per site, who
-- answers a conversation right now, and a short note on its own messages.

-- Sites: one switch for the assistant, one for the keyword FAQ reply (off by
-- default: an automatic answer must be something the site chose).
ALTER TABLE sites ADD COLUMN IF NOT EXISTS assistant_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS faq_auto_reply boolean NOT NULL DEFAULT false;
ALTER TABLE sites DROP COLUMN IF EXISTS ai_settings;

-- Integrations keep identity verification only; the order lookup went with
-- the old assistant.
UPDATE sites SET integrations = jsonb_build_object('identitySecret', integrations -> 'identitySecret');
ALTER TABLE sites ALTER COLUMN integrations SET DEFAULT '{"identitySecret":null}'::jsonb;

-- Who answers the visitor right now: the assistant or a person.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_response_owner_check;
UPDATE conversations SET response_owner = 'human' WHERE response_owner <> 'human';
ALTER TABLE conversations ADD CONSTRAINT conversations_response_owner_check
  CHECK (response_owner IN ('assistant', 'human'));
ALTER TABLE conversations DROP COLUMN IF EXISTS ai_control_version;

-- On the assistant's own messages: which FAQ entries it used, or why it
-- handed over. Never the prompt, never the model's raw output.
ALTER TABLE messages DROP COLUMN IF EXISTS ai_metadata;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS assistant jsonb;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  -- Kept so the history written before 0005 stays valid.
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_INTEGRATION_UPDATED', 'SITE_ASSISTANT_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED'));
