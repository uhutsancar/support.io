const mongoose = require('mongoose');

const ProactiveTriggerLogSchema = new mongoose.Schema({
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ProactiveRule',
    required: true,
    index: true
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
    index: true
  },
  visitorId: {
    type: String,
    required: true,
    index: true
  },
  triggeredAt: {
    type: Date,
    default: Date.now
  },
  converted: { // E.g., if the user replied to the proactive message
    type: Boolean,
    default: false
  },
  convertedAt: {
    type: Date
  }
}, { timestamps: true });

// Compound index to quickly check if a rule was triggered for a visitor
ProactiveTriggerLogSchema.index({ ruleId: 1, visitorId: 1 });

module.exports = mongoose.model('ProactiveTriggerLog', ProactiveTriggerLogSchema);
