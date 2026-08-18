const { defineModel } = require('../db/model');

// Audit rows are append only; the database refuses updates with a trigger.
module.exports = defineModel({
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
        'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH'
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
