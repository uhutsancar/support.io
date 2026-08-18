const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'ProactiveTriggerLog',
  table: 'proactive_trigger_logs',
  fields: {
    ruleId: { column: 'rule_id', type: 'id', ref: 'ProactiveRule', required: true },
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    visitorId: { column: 'visitor_id', type: 'string', required: true },
    triggeredAt: { column: 'triggered_at', type: 'date', default: () => new Date() },
    converted: { column: 'converted', type: 'boolean', default: false },
    convertedAt: { column: 'converted_at', type: 'date', default: null }
  }
});
