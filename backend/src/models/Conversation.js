const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
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
  visitorName: {
    type: String,
    default: 'Visitor'
  },
  visitorEmail: {
    type: String,
    default: null
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'resolved', 'closed'],
    default: 'open',
    index: true
  },
  currentPage: {
    type: String,
    default: '/'
  },
  metadata: {
    userAgent: String,
    ip: String,
    country: String,
    referrer: String
  },
  tags: [{
    type: String
  }],
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  closedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for querying
conversationSchema.index({ siteId: 1, status: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
