import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { ConversationDoc } from './Conversation';
import type { MessageFileData } from '../types/domain';

export type MessageSenderType = 'visitor' | 'agent' | 'bot';
export type MessageType = 'text' | 'image' | 'file' | 'system';

export interface MessageDoc {
  conversationId: Ref<ConversationDoc>;
  senderType: MessageSenderType;
  senderId: string;
  senderName: string;
  content: string;
  messageType: MessageType;
  fileData: MessageFileData | null;
  isRead: boolean;
  readAt: Date | null;
}

export default defineModel<MessageDoc>({
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
