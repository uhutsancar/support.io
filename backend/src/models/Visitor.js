const mongoose = require('mongoose');
const visitorSchema = new mongoose.Schema({
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
  ip: {
    type: String,
    default: null
  },
  country: {
    type: String,
    default: null
  },
  browser: {
    type: String,
    default: null
  },
  os: {
    type: String,
    default: null
  },
  currentPage: {
    type: String,
    default: '/'
  },
  referrer: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastActiveAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });
visitorSchema.index({ lastActiveAt: 1 });
module.exports = mongoose.model('Visitor', visitorSchema);
