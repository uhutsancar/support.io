const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  domain: {
    type: String,
    required: true,
    trim: true
  },
  siteKey: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  // Widget settings
  widgetSettings: {
    position: {
      type: String,
      enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
      default: 'bottom-right'
    },
    primaryColor: {
      type: String,
      default: '#4F46E5'
    },
    welcomeMessage: {
      type: String,
      default: 'Hi! How can we help you today?'
    },
    placeholderText: {
      type: String,
      default: 'Type your message...'
    },
    showOnPages: [{
      type: String // e.g., "/pricing", "/contact", "*" for all
    }],
    autoOpen: {
      type: Boolean,
      default: false
    },
    autoOpenDelay: {
      type: Number,
      default: 5000 // ms
    }
  },
  // AI/Bot settings
  aiSettings: {
    enabled: {
      type: Boolean,
      default: false
    },
    fallbackToHuman: {
      type: Boolean,
      default: true
    },
    aiModel: {
      type: String,
      default: 'faq-based'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Site', siteSchema);
