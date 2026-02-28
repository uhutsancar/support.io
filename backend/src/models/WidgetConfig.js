const mongoose = require('mongoose');
const widgetConfigSchema = new mongoose.Schema({
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
    unique: true,
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true
  },
  colors: {
    primary: {
      type: String,
      default: '#4F46E5'
    },
    header: {
      type: String,
      default: '#4F46E5'
    },
    background: {
      type: String,
      default: '#FFFFFF'
    },
    text: {
      type: String,
      default: '#1F2937'
    },
    textSecondary: {
      type: String,
      default: '#6B7280'
    },
    border: {
      type: String,
      default: '#E5E7EB'
    },
    visitorMessageBg: {
      type: String,
      default: '#4F46E5'
    },
    agentMessageBg: {
      type: String,
      default: '#F3F4F6'
    }
  },
  branding: {
    logo: {
      type: String,
      default: null
    },
    logoWidth: {
      type: Number,
      default: 40
    },
    logoHeight: {
      type: Number,
      default: 40
    },
    brandName: {
      type: String,
      default: 'Support'
    },
    showBrandName: {
      type: Boolean,
      default: true
    }
  },
  button: {
    position: {
      type: String,
      enum: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
      default: 'bottom-right'
    },
    size: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium'
    },
    icon: {
      type: String,
      default: 'message-circle'
    },
    showLabel: {
      type: Boolean,
      default: false
    },
    labelText: {
      type: String,
      default: 'Chat with us'
    },
    borderRadius: {
      type: Number,
      default: 50
    },
    shadow: {
      type: Boolean,
      default: true
    },
    shadowColor: {
      type: String,
      default: 'rgba(0,0,0,0.15)'
    }
  },
  window: {
    width: {
      type: Number,
      default: 400
    },
    height: {
      type: Number,
      default: 650
    },
    borderRadius: {
      type: Number,
      default: 16
    },
    headerHeight: {
      type: Number,
      default: 60
    },
    showHeader: {
      type: Boolean,
      default: true
    },
    showCloseButton: {
      type: Boolean,
      default: true
    }
  },
  messages: {
    welcomeMessage: {
      type: String,
      default: ''
    },
    placeholderText: {
      type: String,
      default: 'Type your message...'
    },
    showTimestamps: {
      type: Boolean,
      default: true
    },
    showAvatars: {
      type: Boolean,
      default: true
    },
    messageBubbleRadius: {
      type: Number,
      default: 12
    }
  },
  behavior: {
    autoOpen: {
      type: Boolean,
      default: false
    },
    autoOpenDelay: {
      type: Number,
      default: 5000
    },
    showOnPages: [{
      type: String
    }],
    hideOnPages: [{
      type: String
    }],
    showUnreadBadge: {
      type: Boolean,
      default: true
    },
    enableSound: {
      type: Boolean,
      default: true
    },
    enableNotifications: {
      type: Boolean,
      default: true
    }
  },
  typography: {
    fontFamily: {
      type: String,
      default: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    },
    fontSize: {
      type: String,
      enum: ['small', 'medium', 'large'],
      default: 'medium'
    },
    fontWeight: {
      type: String,
      enum: ['normal', 'medium', 'semibold', 'bold'],
      default: 'normal'
    }
  },
  advanced: {
    customCSS: {
      type: String,
      default: null
    },
    zIndex: {
      type: Number,
      default: 999999
    },
    animationSpeed: {
      type: String,
      enum: ['slow', 'normal', 'fast'],
      default: 'normal'
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});
widgetConfigSchema.index({ siteId: 1, isActive: 1 });
widgetConfigSchema.index({ organizationId: 1 });
module.exports = mongoose.model('WidgetConfig', widgetConfigSchema);
