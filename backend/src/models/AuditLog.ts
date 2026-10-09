import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'CREATE_AGENT'
  | 'DELETE_AGENT'
  | 'UPDATE_AGENT_ROLE'
  | 'PLAN_CHANGED'
  | 'UPDATE_SLA'
  | 'TICKET_CLOSED'
  | 'TICKET_REOPENED'
  | 'SLA_BREACH'
  | 'AUTOMATION_RULE_CREATED'
  | 'AUTOMATION_RULE_UPDATED'
  | 'AUTOMATION_RULE_DELETED'
  | 'AUTOMATION_EXECUTED'
  | 'SITE_AI_SETTINGS_UPDATED'
  | 'SITE_ASSISTANT_UPDATED'
  | 'SITE_INTEGRATION_UPDATED'
  | 'EMAIL_VERIFIED'
  | 'PASSWORD_RESET_REQUESTED'
  | 'PASSWORD_RESET'
  | 'INVITATION_SENT'
  | 'INVITATION_REVOKED'
  | 'INVITATION_ACCEPTED'
  | 'SITE_CREATED'
  | 'SITE_UPDATED'
  | 'SITE_DELETED'
  | 'WIDGET_SETTINGS_UPDATED'
  | 'CONVERSATION_ASSIGNED'
  | 'LOGIN_FAILED_LOCKED'
  | 'PASSWORD_CHANGED'
  | 'EMAIL_CHANGE_REQUESTED'
  | 'EMAIL_CHANGED'
  | 'MFA_ENABLED'
  | 'MFA_DISABLED'
  | 'MFA_RECOVERY_USED'
  | 'SESSIONS_REVOKED'
  | 'SECURITY_SETTINGS_UPDATED'
  | 'VISITOR_BLOCKED'
  | 'VISITOR_UNBLOCKED'
  | 'VISITOR_DATA_DELETED'
  | 'RETENTION_PURGE'
  | 'RETENTION_SETTINGS_UPDATED'
  | 'ASSISTANT_ENABLED'
  | 'ASSISTANT_KILL_SWITCH'
  | 'API_KEY_CREATED'
  | 'API_KEY_REVOKED'
  | 'GOOGLE_LINKED'
  | 'GOOGLE_UNLINKED'
  | 'WEBHOOK_CREATED'
  | 'WEBHOOK_UPDATED'
  | 'WEBHOOK_DELETED'
  | 'SITE_SUSPENDED'
  | 'SITE_REACTIVATED'
  | 'TRIAL_STARTED'
  | 'TRIAL_ENDED'
  | 'SAVED_REPLY_CREATED'
  | 'SAVED_REPLY_UPDATED'
  | 'SAVED_REPLY_DELETED'
  | 'CONVERSATIONS_MERGED'
  | 'SEAT_SUSPENDED'
  | 'SEAT_RESTORED';

/** Every action the database accepts (migration 0009), in one list. */
export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILED',
  'LOGIN_FAILED_LOCKED',
  'CREATE_AGENT',
  'DELETE_AGENT',
  'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED',
  'UPDATE_SLA',
  'TICKET_CLOSED',
  'TICKET_REOPENED',
  'SLA_BREACH',
  'AUTOMATION_RULE_CREATED',
  'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED',
  'AUTOMATION_EXECUTED',
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_ASSISTANT_UPDATED',
  'SITE_INTEGRATION_UPDATED',
  'EMAIL_VERIFIED',
  'PASSWORD_RESET_REQUESTED',
  'PASSWORD_RESET',
  'INVITATION_SENT',
  'INVITATION_REVOKED',
  'INVITATION_ACCEPTED',
  'SITE_CREATED',
  'SITE_UPDATED',
  'SITE_DELETED',
  'WIDGET_SETTINGS_UPDATED',
  'CONVERSATION_ASSIGNED',
  'PASSWORD_CHANGED',
  'EMAIL_CHANGE_REQUESTED',
  'EMAIL_CHANGED',
  'MFA_ENABLED',
  'MFA_DISABLED',
  'MFA_RECOVERY_USED',
  'SESSIONS_REVOKED',
  'SECURITY_SETTINGS_UPDATED',
  'VISITOR_BLOCKED',
  'VISITOR_UNBLOCKED',
  'VISITOR_DATA_DELETED',
  'RETENTION_PURGE',
  'RETENTION_SETTINGS_UPDATED',
  'ASSISTANT_ENABLED',
  'ASSISTANT_KILL_SWITCH',
  'API_KEY_CREATED',
  'API_KEY_REVOKED',
  'GOOGLE_LINKED',
  'GOOGLE_UNLINKED',
  'WEBHOOK_CREATED',
  'WEBHOOK_UPDATED',
  'WEBHOOK_DELETED',
  'SITE_SUSPENDED',
  'SITE_REACTIVATED',
  'TRIAL_STARTED',
  'TRIAL_ENDED',
  'SAVED_REPLY_CREATED',
  'SAVED_REPLY_UPDATED',
  'SAVED_REPLY_DELETED',
  'CONVERSATIONS_MERGED',
  'SEAT_SUSPENDED',
  'SEAT_RESTORED'
];

export interface AuditLogDoc {
  organizationId: Ref<OrganizationDoc>;
  userId: string | null;
  action: AuditAction;
  entityType: string | null;
  entityId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

// Audit rows are append only; the database refuses updates with a trigger.
export default defineModel<AuditLogDoc>({
  name: 'AuditLog',
  table: 'audit_logs',
  timestamps: false,
  fields: {
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization' },
    userId: { column: 'user_id', type: 'id', default: null },
    action: {
      column: 'action',
      type: 'string',
      required: true,
      enum: AUDIT_ACTIONS
    },
    entityType: { column: 'entity_type', type: 'string' },
    entityId: { column: 'entity_id', type: 'id' },
    metadata: { column: 'metadata', type: 'json', default: () => ({}) },
    ipAddress: { column: 'ip_address', type: 'string' },
    userAgent: { column: 'user_agent', type: 'string' },
    createdAt: { column: 'created_at', type: 'date', default: () => new Date() }
  }
});
