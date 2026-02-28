const mongoose = require('mongoose');

const AutomationLogSchema = new mongoose.Schema({
  ruleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AutomationRule',
    required: true,
    index: true
  },
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
    index: true
  },
  triggerType: {
    type: String,
    required: true
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId // Can be Conversation ID, Message ID, etc.
  },
  status: {
    type: String,
    enum: ['success', 'failed'],
    required: true
  },
  errorDetails: {
    type: String
  },
  executionTimeMs: {
    type: Number
  },
  executedAt: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30 // TTL index: Keep logs for 30 days
  }
}, { timestamps: true });

module.exports = mongoose.model('AutomationLog', AutomationLogSchema);
