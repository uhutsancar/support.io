const mongoose = require('mongoose');
const messageSchema = new mongoose.Schema({
  conversationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Conversation',
    required: true,
    index: true
  },
  senderType: {
    type: String,
    enum: ['visitor', 'agent', 'bot'],
    required: true
  },
  senderId: {
    type: String,
    required: true
  },
  senderName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'system'],
    default: 'text'
  },
  fileData: {
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});
messageSchema.index({ conversationId: 1, createdAt: 1 });
module.exports = mongoose.model('Message', messageSchema);
