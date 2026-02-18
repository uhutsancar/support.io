const mongoose = require('mongoose');

const teamChatSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  chatType: {
    type: String,
    enum: ['direct', 'group'],
    required: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }],
  groupName: {
    type: String,
    default: null
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  },
  lastMessage: {
    content: String,
    senderId: mongoose.Schema.Types.ObjectId,
    senderName: String,
    createdAt: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('TeamChat', teamChatSchema);
