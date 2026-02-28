const mongoose = require('mongoose');

const EventLogSchema = new mongoose.Schema({
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
  sessionId: {
    type: String,
    index: true
  },
  eventType: {
    type: String,
    required: true,
    enum: ['page_view', 'time_on_page', 'scroll_depth', 'inactivity', 'exit_intent', 'click', 'custom_event', 'form_start', 'form_submit'],
    index: true
  },
  eventData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  url: {
    type: String
  },
  referrer: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now,
    expires: 60 * 60 * 24 * 30 // TTL index: Keep logs for 30 days
  }
}, { timestamps: true });

module.exports = mongoose.model('EventLog', EventLogSchema);
