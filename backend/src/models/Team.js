const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const teamSchema = new mongoose.Schema({
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
    enum: ['admin', 'manager', 'agent'],
    default: 'agent'
  },
  avatar: {
    type: String,
    default: null
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    index: true,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
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
    enum: ['online', 'offline', 'away', 'busy'],
    default: 'offline',
    index: true
  },
  skills: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  maxCapacity: {
    type: Number,
    default: 10,
    min: 1
  },
  currentLoad: {
    type: Number,
    default: 0,
    min: 0
  },
  permissions: {
    canManageConversations: {
      type: Boolean,
      default: true
    },
    canManageDepartments: {
      type: Boolean,
      default: false
    },
    canManageTeam: {
      type: Boolean,
      default: false
    },
    canManageSites: {
      type: Boolean,
      default: false
    },
    canViewAnalytics: {
      type: Boolean,
      default: true
    },
    canManageFAQs: {
      type: Boolean,
      default: false
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
    },
    satisfactionRate: {
      type: Number,
      default: 0
    }
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  phone: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

teamSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

teamSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

teamSchema.methods.toJSON = function() {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model('Team', teamSchema);
