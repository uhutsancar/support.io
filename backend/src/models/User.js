const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'manager', 'agent'],
    default: 'agent'
  },
  avatar: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // For agent users
  assignedSites: [{
    type: String,
    ref: 'Site'
  }],
  departments: [{
    departmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department'
    },
    role: {
      type: String,
      enum: ['manager', 'agent'],
      default: 'agent'
    }
  }],
  status: {
    type: String,
    enum: ['online', 'offline', 'busy', 'away'],
    default: 'offline'
  },
  permissions: {
    canManageTeam: {
      type: Boolean,
      default: false
    },
    canManageDepartments: {
      type: Boolean,
      default: false
    },
    canViewAllConversations: {
      type: Boolean,
      default: false
    },
    canAssignConversations: {
      type: Boolean,
      default: true
    },
    canDeleteConversations: {
      type: Boolean,
      default: false
    }
  },
  preferences: {
    autoAcceptAssignments: {
      type: Boolean,
      default: true
    },
    maxActiveConversations: {
      type: Number,
      default: 10
    },
    notificationSound: {
      type: Boolean,
      default: true
    }
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
    resolvedConversations: {
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

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
