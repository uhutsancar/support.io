const mongoose = require('mongoose');

const faqSchema = new mongoose.Schema({
  siteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Site',
    required: true,
    index: true
  },
  question: {
    type: String,
    required: true,
    trim: true
  },
  answer: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'General'
  },
  keywords: [{
    type: String,
    lowercase: true
  }],
  pageSpecific: {
    type: String, // e.g., "/pricing", "*" for all pages
    default: '*'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  order: {
    type: Number,
    default: 0
  },
  // Analytics
  viewCount: {
    type: Number,
    default: 0
  },
  helpfulCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Text search index
faqSchema.index({ question: 'text', answer: 'text', keywords: 'text' });

module.exports = mongoose.model('FAQ', faqSchema);
