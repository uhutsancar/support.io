const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  siteId: {
    type: String,
    ref: 'Site',
    required: true,
    index: true
  },
  color: {
    type: String,
    default: '#3B82F6' // Default blue color
  },
  icon: {
    type: String,
    default: '💬'
  },
  members: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team'
    },
    role: {
      type: String,
      enum: ['manager', 'agent'],
      default: 'agent'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  autoAssignRules: {
    enabled: {
      type: Boolean,
      default: false
    },
    strategy: {
      type: String,
      enum: ['round-robin', 'least-active', 'manual'],
      default: 'round-robin'
    }
  },
  businessHours: {
    enabled: {
      type: Boolean,
      default: false
    },
    timezone: {
      type: String,
      default: 'Europe/Istanbul'
    },
    schedule: {
      monday: { 
        start: { type: String, default: '09:00' }, 
        end: { type: String, default: '18:00' }, 
        enabled: { type: Boolean, default: true } 
      },
      tuesday: { 
        start: { type: String, default: '09:00' }, 
        end: { type: String, default: '18:00' }, 
        enabled: { type: Boolean, default: true } 
      },
      wednesday: { 
        start: { type: String, default: '09:00' }, 
        end: { type: String, default: '18:00' }, 
        enabled: { type: Boolean, default: true } 
      },
      thursday: { 
        start: { type: String, default: '09:00' }, 
        end: { type: String, default: '18:00' }, 
        enabled: { type: Boolean, default: true } 
      },
      friday: { 
        start: { type: String, default: '09:00' }, 
        end: { type: String, default: '18:00' }, 
        enabled: { type: Boolean, default: true } 
      },
      saturday: { 
        start: { type: String, default: '09:00' }, 
        end: { type: String, default: '18:00' }, 
        enabled: { type: Boolean, default: false } 
      },
      sunday: { 
        start: { type: String, default: '09:00' }, 
        end: { type: String, default: '18:00' }, 
        enabled: { type: Boolean, default: false } 
      }
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  stats: {
    totalConversations: {
      type: Number,
      default: 0
    },
    activeConversations: {
      type: Number,
      default: 0
    },
    averageResponseTime: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true
});

// Index for faster queries
departmentSchema.index({ siteId: 1, isActive: 1 });
departmentSchema.index({ 'members.userId': 1 });

module.exports = mongoose.model('Department', departmentSchema);
