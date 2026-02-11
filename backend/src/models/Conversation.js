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
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
    index: true
  },
  assignedAgent: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: ['unassigned', 'assigned', 'pending', 'resolved', 'closed'],
    default: 'unassigned',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  currentPage: {
    type: String,
    default: '/'
  },
  metadata: {
    userAgent: String,
    ip: String,
    country: String,
    referrer: String,
    browser: String,
    os: String
  },
  tags: [{
    type: String
  }],
  internalNotes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    note: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  rating: {
    score: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    feedback: {
      type: String,
      default: null
    },
    ratedAt: {
      type: Date,
      default: null
    }
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  firstResponseAt: {
    type: Date,
    default: null
  },
  resolvedAt: {
    type: Date,
    default: null
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
conversationSchema.index({ siteId: 1, department: 1, status: 1 });
conversationSchema.index({ assignedAgent: 1, status: 1 });
conversationSchema.index({ department: 1, status: 1, lastMessageAt: -1 });

// Virtual for response time
conversationSchema.virtual('responseTime').get(function() {
  if (this.firstResponseAt && this.createdAt) {
    return this.firstResponseAt - this.createdAt;
  }
  return null;
});

// Virtual for resolution time
conversationSchema.virtual('resolutionTime').get(function() {
  if (this.resolvedAt && this.createdAt) {
    return this.resolvedAt - this.createdAt;
  }
  return null;
});

module.exports = mongoose.model('Conversation', conversationSchema);
