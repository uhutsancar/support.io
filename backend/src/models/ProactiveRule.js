const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'ProactiveRule',
  table: 'proactive_rules',
  fields: {
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    name: { column: 'name', type: 'string', required: true },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    triggerCondition: {
      column: 'trigger_condition',
      type: 'json',
      default: () => ({ urlMatch: 'any', timeThresholdSeconds: 0, scrollPercentage: 0 })
    },
    audienceContext: { column: 'audience_context', type: 'json', default: () => ({ deviceType: 'all' }) },
    action: { column: 'action', type: 'json', default: () => ({}) },
    frequencyControl: {
      column: 'frequency_control',
      type: 'json',
      default: () => ({ triggerOncePerVisitor: true, cooldownMinutes: 1440 })
    },
    metrics: { column: 'metrics', type: 'json', default: () => ({ triggersCount: 0, conversionsCount: 0 }) }
  }
});
