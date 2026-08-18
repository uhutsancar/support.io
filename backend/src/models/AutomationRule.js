const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'AutomationRule',
  table: 'automation_rules',
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    name: { column: 'name', type: 'string', required: true },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    priority: { column: 'priority', type: 'number', default: 0 },
    triggerType: {
      column: 'trigger_type',
      type: 'string',
      enum: ['message_received', 'conversation_created', 'visitor_event', 'schedule'],
      required: true
    },
    // Rule bodies are always read and written as a whole.
    conditions: { column: 'conditions', type: 'json', default: () => [] },
    conditionOperator: { column: 'condition_operator', type: 'string', default: 'AND' },
    actions: { column: 'actions', type: 'json', default: () => [] },
    metrics: {
      column: 'metrics',
      type: 'json',
      default: () => ({ executionsCount: 0, successCount: 0, failureCount: 0 })
    }
  }
});
