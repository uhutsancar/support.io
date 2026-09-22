import { defineModel } from '../db/model';
import type { ChatType } from './TeamChat';

export interface TeamMessageDoc {
  chatId: string;
  chatType: ChatType;
  senderId: string;
  senderName: string;
  content: string;
  messageType: 'text' | 'system';
  groupName: string | null;
  readBy: string[];
  participants: string[];
}

export interface TeamMessageStatics {
  /** The deterministic id of the direct chat between two people. */
  getDirectChatId(userId1: string, userId2: string): string;
}

const TeamMessage = defineModel<TeamMessageDoc, TeamMessageStatics>({
  name: 'TeamMessage',
  table: 'team_messages',
  fields: {
    chatId: { column: 'chat_id', type: 'string', required: true },
    chatType: { column: 'chat_type', type: 'string', enum: ['direct', 'group'], required: true },
    senderId: { column: 'sender_id', type: 'id', required: true },
    senderName: { column: 'sender_name', type: 'string', required: true },
    content: { column: 'content', type: 'string', required: true },
    messageType: { column: 'message_type', type: 'string', enum: ['text', 'system'], default: 'text' },
    groupName: { column: 'group_name', type: 'string', default: null }
  },
  children: {
    readBy: {
      table: 'team_message_read_by',
      parentKey: 'team_message_id',
      valueColumn: 'reader_id',
      scalar: true
    },
    participants: {
      table: 'team_message_participants',
      parentKey: 'team_message_id',
      valueColumn: 'participant_id',
      scalar: true
    }
  },
  statics: {
    getDirectChatId(userId1: string, userId2: string) {
      return [userId1, userId2].sort().join('_');
    }
  }
});

export default TeamMessage;
