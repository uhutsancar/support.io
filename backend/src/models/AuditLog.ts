import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';

export type AuditAction =
  | 'LOGIN_SUCCESS' | 'LOGIN_FAILED'
  | 'CREATE_AGENT' | 'DELETE_AGENT' | 'UPDATE_AGENT_ROLE'
  | 'PLAN_CHANGED' | 'UPDATE_SLA'
  | 'TICKET_CLOSED' | 'TICKET_REOPENED' | 'SLA_BREACH'
  | 'AUTOMATION_RULE_CREATED' | 'AUTOMATION_RULE_UPDATED'
  | 'AUTOMATION_RULE_DELETED' | 'AUTOMATION_EXECUTED';

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
      enum: [
        'LOGIN_SUCCESS', 'LOGIN_FAILED',
        'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
        'PLAN_CHANGED', 'UPDATE_SLA',
        'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
        'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
        'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED'
      ]
    },
    entityType: { column: 'entity_type', type: 'string' },
    entityId: { column: 'entity_id', type: 'id' },
    metadata: { column: 'metadata', type: 'json', default: () => ({}) },
    ipAddress: { column: 'ip_address', type: 'string' },
    userAgent: { column: 'user_agent', type: 'string' },
    createdAt: { column: 'created_at', type: 'date', default: () => new Date() }
  }
});
