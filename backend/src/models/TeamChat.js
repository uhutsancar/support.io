const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'TeamChat',
  table: 'team_chats',
  fields: {
    chatId: { column: 'chat_id', type: 'string', required: true },
    chatType: { column: 'chat_type', type: 'string', enum: ['direct', 'group'], required: true },
    groupName: { column: 'group_name', type: 'string', default: null },
    // Participants may be Users or Team agents, so the route resolves them itself.
    createdBy: { column: 'created_by_id', type: 'id' },
    lastMessage: { column: 'last_message', type: 'json', default: null }
  },
  children: {
    participants: {
      table: 'team_chat_participants',
      parentKey: 'team_chat_id',
      valueColumn: 'participant_id',
      scalar: true
    }
  }
});
