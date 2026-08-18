const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'Message',
  table: 'messages',
  fields: {
    conversationId: { column: 'conversation_id', type: 'id', ref: 'Conversation', required: true },
    senderType: { column: 'sender_type', type: 'string', enum: ['visitor', 'agent', 'bot'], required: true },
    senderId: { column: 'sender_id', type: 'string', required: true },
    senderName: { column: 'sender_name', type: 'string', required: true },
    content: { column: 'content', type: 'string', required: true },
    messageType: { column: 'message_type', type: 'string', enum: ['text', 'image', 'file', 'system'], default: 'text' },
    fileData: { column: 'file_data', type: 'json' },
    isRead: { column: 'is_read', type: 'boolean', default: false },
    readAt: { column: 'read_at', type: 'date', default: null }
  }
});
