const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

const conversationSchema = new mongoose.Schema({
  ticketNumber: {
    type: Number,
    unique: true,
    index: true
  },
  ticketId: {
    type: String,
    unique: true,
    index: true
  },
  
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
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
    ref: 'Team',
    default: null
  },
  assignedAt: {
    type: Date,
    default: null
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
    default: null
  },
  status: {
    type: String,
    enum: ['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned'],
    default: 'open',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  requiredSkills: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  unreadCount: {
    type: Number,
    default: 0,
    min: 0
  },
  nextSlaCheckAt: {
    type: Date,
    default: null,
    index: true
  },
  autoReassignAttempts: {
    type: Number,
    default: 0
  },
  lastReassignAt: {
    type: Date,
    default: null
  },
  sla: {
    firstResponseTarget: {
      type: Number,
      default: function() {
        const targets = { urgent: 5, high: 10, normal: 15, low: 30 };
        return targets[this.priority] || 15;
      }
    },
    resolutionTarget: {
      type: Number,
      default: function() {
        const targets = { urgent: 60, high: 120, normal: 240, low: 480 };
        return targets[this.priority] || 240;
      }
    },
    firstResponseStatus: {
      type: String,
      enum: ['met', 'breached', 'pending'],
      default: 'pending'
    },
    resolutionStatus: {
      type: String,
      enum: ['met', 'breached', 'pending'],
      default: 'pending'
    },
    firstResponseTimeRemaining: {
      type: Number,
      default: null
    },
    resolutionTimeRemaining: {
      type: Number,
      default: null
    },
    firstResponseBreachedAt: {
      type: Date,
      default: null
    },
    resolutionBreachedAt: {
      type: Date,
      default: null
    }
  },
  
  channel: {
    type: String,
    enum: ['web-chat', 'email', 'whatsapp', 'phone'],
    default: 'web-chat'
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

conversationSchema.pre('save', async function(next) {

  if (!this.organizationId && this.siteId) {
    try {
      const Site = require('./Site');
      const site = await Site.findById(this.siteId).select('organizationId');
      if (site && site.organizationId) {
        this.organizationId = site.organizationId;
      }
    } catch (e) {

    }
  }

  if (!this.ticketNumber) {
    try {
      const counter = await Counter.findByIdAndUpdate(
        { _id: 'ticketNumber' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
      );
      this.ticketNumber = counter.seq;
      this.ticketId = `#${counter.seq.toString().padStart(4, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  next();
});

conversationSchema.index({ siteId: 1, status: 1, createdAt: -1 });
conversationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
conversationSchema.index({ siteId: 1, department: 1, status: 1 });
conversationSchema.index({ assignedAgent: 1, status: 1 });
conversationSchema.index({ department: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ 'sla.firstResponseStatus': 1 });
conversationSchema.index({ 'sla.resolutionStatus': 1 });

conversationSchema.index({ status: 1, nextSlaCheckAt: 1 });
conversationSchema.index({ organizationId: 1, status: 1, nextSlaCheckAt: 1 });

conversationSchema.virtual('responseTime').get(function() {
  if (this.firstResponseAt && this.createdAt) {
    return Math.floor((this.firstResponseAt - this.createdAt) / 1000 / 60);
  }
  return null;
});

conversationSchema.virtual('resolutionTime').get(function() {
  if (this.resolvedAt && this.createdAt) {
    return Math.floor((this.resolvedAt - this.createdAt) / 1000 / 60);
  }
  return null;
});

conversationSchema.methods.calculateSLA = function() {
  const now = new Date();

  if (!this.createdAt || !(this.createdAt instanceof Date) || isNaN(new Date(this.createdAt).getTime())) {

    this.createdAt = now;
  } else {

    this.createdAt = new Date(this.createdAt);
  }
  const createdTime = this.createdAt.getTime();
  const elapsedMinutes = Math.floor((now - createdTime) / 1000 / 60);

  let nextCheckMinutes = 5;
  
  if (!this.firstResponseAt) {
    const remaining = this.sla.firstResponseTarget - elapsedMinutes;
    this.sla.firstResponseTimeRemaining = remaining;

    if (remaining > 0 && remaining <= 10) {
      nextCheckMinutes = Math.max(1, Math.floor(remaining / 2));
    }
    
    if (remaining < 0) {
      this.sla.firstResponseStatus = 'breached';
      if (!this.sla.firstResponseBreachedAt) {
        this.sla.firstResponseBreachedAt = new Date(createdTime + this.sla.firstResponseTarget * 60 * 1000);
      }
      nextCheckMinutes = 1;
    } else {
      this.sla.firstResponseStatus = 'pending';
    }
  } else {
    const responseMinutes = Math.floor((this.firstResponseAt - createdTime) / 1000 / 60);
    this.sla.firstResponseStatus = responseMinutes <= this.sla.firstResponseTarget ? 'met' : 'breached';
    this.sla.firstResponseTimeRemaining = null;
    
    if (this.sla.firstResponseStatus === 'breached' && !this.sla.firstResponseBreachedAt) {
      this.sla.firstResponseBreachedAt = this.firstResponseAt;
    }
  }
  
  if (this.status !== 'resolved' && this.status !== 'closed') {
    const remaining = this.sla.resolutionTarget - elapsedMinutes;
    this.sla.resolutionTimeRemaining = remaining;

    if (remaining > 0 && remaining <= 30) {
      nextCheckMinutes = Math.min(nextCheckMinutes, Math.max(1, Math.floor(remaining / 3)));
    }
    
    if (remaining < 0) {
      this.sla.resolutionStatus = 'breached';
      if (!this.sla.resolutionBreachedAt) {
        this.sla.resolutionBreachedAt = new Date(createdTime + this.sla.resolutionTarget * 60 * 1000);
      }
      nextCheckMinutes = 1;
    } else {
      this.sla.resolutionStatus = 'pending';
    }
  } else if (this.resolvedAt) {
    const resolutionMinutes = Math.floor((this.resolvedAt - createdTime) / 1000 / 60);
    this.sla.resolutionStatus = resolutionMinutes <= this.sla.resolutionTarget ? 'met' : 'breached';
    this.sla.resolutionTimeRemaining = null;
    
    if (this.sla.resolutionStatus === 'breached' && !this.sla.resolutionBreachedAt) {
      this.sla.resolutionBreachedAt = this.resolvedAt;
    }

    this.nextSlaCheckAt = null;
    return this;
  }

  this.nextSlaCheckAt = new Date(now.getTime() + nextCheckMinutes * 60 * 1000);
  
  return this;
};

conversationSchema.set('toJSON', { virtuals: true });
conversationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Conversation', conversationSchema);
