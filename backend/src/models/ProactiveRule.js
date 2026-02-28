const mongoose = require('mongoose');

const ProactiveRuleSchema = new mongoose.Schema({
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
  triggerCondition: {
    eventType: {
      type: String,
      required: true,
      enum: ['page_view', 'time_on_page', 'scroll_depth', 'inactivity', 'exit_intent', 'custom_event']
    },
    urlMatch: {
      type: String, // e.g. "contains", "exact", "regex"
      default: 'any'
    },
    urlValue: {
      type: String
    },
    timeThresholdSeconds: {
      type: Number, // Minimum time for time_on_page or inactivity
      default: 0
    },
    scrollPercentage: {
      type: Number, // Used for scroll_depth (0-100)
      default: 0
    },
    customEventName: {
      type: String
    }
  },
  audienceContext: {
    deviceType: {
      type: String, // 'desktop', 'mobile', 'all'
      default: 'all'
    },
    country: {
      type: String
    },
    returningVisitor: {
      type: Boolean // true: only returning, false: only new, null: both
    }
  },
  action: {
    type: {
      type: String,
      required: true,
      enum: ['send_message', 'open_popup', 'add_tag', 'assign_agent']
    },
    messageContent: {
      type: String // Text for send_message or open_popup
    },
    tag: {
      type: String
    },
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  frequencyControl: {
    triggerOncePerVisitor: {
      type: Boolean,
      default: true
    },
    cooldownMinutes: {
      type: Number,
      default: 1440 // 24 hours
    }
  },
  metrics: {
    triggersCount: { type: Number, default: 0 },
    conversionsCount: { type: Number, default: 0 }
  }
}, { timestamps: true });

module.exports = mongoose.model('ProactiveRule', ProactiveRuleSchema);
