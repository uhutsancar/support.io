const mongoose = require('mongoose');
const teamMessageSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    index: true
  },
  chatType: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team',
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
    enum: ['text', 'system'],
    default: 'text'
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],
  groupName: String,
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }]
}, {
  timestamps: true
});
teamMessageSchema.index({ chatId: 1, createdAt: 1 });
teamMessageSchema.statics.getDirectChatId = function(userId1, userId2) {
  return [userId1, userId2].sort().join('_');
};
module.exports = mongoose.model('TeamMessage', teamMessageSchema);
