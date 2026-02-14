const mongoose = require('mongoose');

// Counter for ticket numbers
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

const conversationSchema = new mongoose.Schema({
  // Ticket sistemi için temel alanlar
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
    enum: ['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned'],
    default: 'open',
    index: true
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  
  // SLA (Service Level Agreement) Alanları
  sla: {
    // İlk yanıt süresi hedefi (dakika cinsinden)
    firstResponseTarget: {
      type: Number,
      default: 15 // 15 dakika
    },
    // Çözüm süresi hedefi (dakika cinsinden)
    resolutionTarget: {
      type: Number,
      default: 240 // 4 saat
    },
    // İlk yanıt SLA durumu
    firstResponseStatus: {
      type: String,
      enum: ['met', 'breached', 'pending'],
      default: 'pending'
    },
    // Çözüm SLA durumu
    resolutionStatus: {
      type: String,
      enum: ['met', 'breached', 'pending'],
      default: 'pending'
    },
    // İlk yanıt için kalan süre (dakika)
    firstResponseTimeRemaining: {
      type: Number,
      default: null
    },
    // Çözüm için kalan süre (dakika)
    resolutionTimeRemaining: {
      type: Number,
      default: null
    },
    // SLA ihlal zamanları
    firstResponseBreachedAt: {
      type: Date,
      default: null
    },
    resolutionBreachedAt: {
      type: Date,
      default: null
    }
  },
  
  // Kanal bilgisi
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

// Ticket numarası otomatik oluşturma
conversationSchema.pre('save', async function(next) {
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

// Index for querying
conversationSchema.index({ siteId: 1, status: 1, lastMessageAt: -1 });
conversationSchema.index({ siteId: 1, department: 1, status: 1 });
conversationSchema.index({ assignedAgent: 1, status: 1 });
conversationSchema.index({ department: 1, status: 1, lastMessageAt: -1 });
// ticketNumber ve ticketId için index zaten schema'da "index: true" ile tanımlı
conversationSchema.index({ 'sla.firstResponseStatus': 1 });
conversationSchema.index({ 'sla.resolutionStatus': 1 });

// Virtual for response time (dakika cinsinden)
conversationSchema.virtual('responseTime').get(function() {
  if (this.firstResponseAt && this.createdAt) {
    return Math.floor((this.firstResponseAt - this.createdAt) / 1000 / 60);
  }
  return null;
});

// Virtual for resolution time (dakika cinsinden)
conversationSchema.virtual('resolutionTime').get(function() {
  if (this.resolvedAt && this.createdAt) {
    return Math.floor((this.resolvedAt - this.createdAt) / 1000 / 60);
  }
  return null;
});

// SLA durumunu hesaplayan method
conversationSchema.methods.calculateSLA = function() {
  const now = new Date();
  const createdTime = this.createdAt.getTime();
  const elapsedMinutes = Math.floor((now - createdTime) / 1000 / 60);
  
  // İlk yanıt SLA kontrolü
  if (!this.firstResponseAt) {
    const remaining = this.sla.firstResponseTarget - elapsedMinutes;
    this.sla.firstResponseTimeRemaining = remaining;
    
    if (remaining < 0) {
      this.sla.firstResponseStatus = 'breached';
      if (!this.sla.firstResponseBreachedAt) {
        this.sla.firstResponseBreachedAt = new Date(createdTime + this.sla.firstResponseTarget * 60 * 1000);
      }
    } else {
      this.sla.firstResponseStatus = 'pending';
    }
  } else {
    const responseMinutes = Math.floor((this.firstResponseAt - createdTime) / 1000 / 60);
    this.sla.firstResponseStatus = responseMinutes <= this.sla.firstResponseTarget ? 'met' : 'breached';
    this.sla.firstResponseTimeRemaining = 0;
    
    if (this.sla.firstResponseStatus === 'breached' && !this.sla.firstResponseBreachedAt) {
      this.sla.firstResponseBreachedAt = this.firstResponseAt;
    }
  }
  
  // Çözüm SLA kontrolü
  if (this.status !== 'resolved' && this.status !== 'closed') {
    const remaining = this.sla.resolutionTarget - elapsedMinutes;
    this.sla.resolutionTimeRemaining = remaining;
    
    if (remaining < 0) {
      this.sla.resolutionStatus = 'breached';
      if (!this.sla.resolutionBreachedAt) {
        this.sla.resolutionBreachedAt = new Date(createdTime + this.sla.resolutionTarget * 60 * 1000);
      }
    } else {
      this.sla.resolutionStatus = 'pending';
    }
  } else if (this.resolvedAt) {
    const resolutionMinutes = Math.floor((this.resolvedAt - createdTime) / 1000 / 60);
    this.sla.resolutionStatus = resolutionMinutes <= this.sla.resolutionTarget ? 'met' : 'breached';
    this.sla.resolutionTimeRemaining = 0;
    
    if (this.sla.resolutionStatus === 'breached' && !this.sla.resolutionBreachedAt) {
      this.sla.resolutionBreachedAt = this.resolvedAt;
    }
  }
  
  return this;
};

// Virtuals'ları JSON'a dahil et
conversationSchema.set('toJSON', { virtuals: true });
conversationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Conversation', conversationSchema);
