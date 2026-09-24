import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { ConversationDoc } from './Conversation';
import { MESSAGE_SENDER_TYPES, MESSAGE_TYPES } from '../domain';
import type { MessageAiMetadata, MessageFileData, MessageSenderType, MessageType } from '../domain';

// Declared once in src/domain/constants.ts; re-exported for callers that
// already import these names from the model.
export type { MessageSenderType, MessageType };

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
  /** The widget's id for the message; a resend carries the same one. */
  clientMessageId: string | null;
  /** Set on automatic replies only. */
  aiMetadata: MessageAiMetadata | null;
}

export default defineModel<MessageDoc>({
  name: 'Message',
  table: 'messages',
  fields: {
    conversationId: { column: 'conversation_id', type: 'id', ref: 'Conversation', required: true },
    senderType: {
      column: 'sender_type',
      type: 'string',
      enum: MESSAGE_SENDER_TYPES,
      required: true
    },
    senderId: { column: 'sender_id', type: 'string', required: true },
    senderName: { column: 'sender_name', type: 'string', required: true },
    content: { column: 'content', type: 'string', required: true },
    messageType: { column: 'message_type', type: 'string', enum: MESSAGE_TYPES, default: 'text' },
    fileData: { column: 'file_data', type: 'json' },
    isRead: { column: 'is_read', type: 'boolean', default: false },
    readAt: { column: 'read_at', type: 'date', default: null },
    clientMessageId: { column: 'client_message_id', type: 'string', default: null },
    aiMetadata: { column: 'ai_metadata', type: 'json', default: null }
  }
});
