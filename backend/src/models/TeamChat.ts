import { defineModel } from '../db/model';

export type ChatType = 'direct' | 'group';

/**
 * The denormalised preview shown in the chat list.
 *
 * `createdAt` is what the socket handler actually writes and what the chat list
 * sorts on. This interface declared `timestamp` instead, and the open index
 * signature below meant neither the write nor the read was ever type-checked
 * against it — the sort silently read `undefined` and fell back to the row's
 * `updatedAt` every time. `timestamp` is kept as optional for rows written
 * before the mismatch was noticed.
 */
export interface TeamChatPreview {
  content?: string;
  senderId?: string;
  senderName?: string;
  createdAt?: Date | string;
  /** @deprecated Older rows only; new previews carry `createdAt`. */
  timestamp?: Date | string;
  [extra: string]: unknown;
}

export interface TeamChatDoc {
  chatId: string;
  chatType: ChatType;
  groupName: string | null;
  /** Participants may be Users or Team agents, so the route resolves them itself. */
  createdBy: string | null;
  lastMessage: TeamChatPreview | null;
  participants: string[];
}

export default defineModel<TeamChatDoc>({
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
