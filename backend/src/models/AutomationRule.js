const mongoose = require('mongoose');

const AutomationRuleSchema = new mongoose.Schema({
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: Number,
    default: 0 // Higher number = higher priority
  },
  triggerType: {
    type: String,
    enum: ['message_received', 'conversation_created', 'visitor_event', 'schedule'],
    required: true
  },
  conditions: [{
    field: { type: String, required: true }, // e.g., 'message.text', 'visitor.country', 'time.outside_business_hours', 'event.type'
    operator: { type: String, required: true }, // e.g., 'contains', 'equals', 'not_equals', 'exists'
    value: { type: mongoose.Schema.Types.Mixed }
  }],
  conditionOperator: {
    type: String, // 'AND' or 'OR'
    default: 'AND'
  },
  actions: [{
    type: { type: String, required: true }, // 'send_message', 'assign_team', 'assign_agent', 'add_tag', 'change_status', 'escalate_sla', 'webhook', 'internal_note'
    payload: { type: mongoose.Schema.Types.Mixed } // Data required for the action (e.g., text for message, teamId for assign)
  }],
  metrics: {
    executionsCount: { type: Number, default: 0 },
    successCount: { type: Number, default: 0 },
    failureCount: { type: Number, default: 0 }
  }
}, { timestamps: true });

// Index for evaluating rules per site and trigger type
AutomationRuleSchema.index({ siteId: 1, triggerType: 1, isActive: 1, priority: -1 });

module.exports = mongoose.model('AutomationRule', AutomationRuleSchema);
