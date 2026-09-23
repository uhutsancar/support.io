// The wire protocol between the widget / admin panel and this server.
//
// Payload members are optional and the socket state is split in two because
// both are filled in over time: a widget socket carries nothing until it joins,
// and nothing a client sends is trusted until the handler has checked it. The
// interfaces document what each event is supposed to carry, not what it is
// guaranteed to carry.

/** What the widget reports about the visitor's browser session. */
import type { Socket } from 'socket.io';
import type { UserType } from '../types/auth';
import type { Priority } from '../domain';
import type { MessageType } from '../models/Message';

export interface VisitorMetadata {
  browser: string | null;
  os: string | null;
  country: string | null;
  referrer: string | null;
  language: string | null;
  sessionId: string | null;
  attributes: Record<string, string | number | boolean>;
  /** The block is stored verbatim on the conversation, so it stays open. */
  [extra: string]: unknown;
}

/** State the widget namespace pins on a visitor's socket once it joins. */
export interface WidgetSocketState {
  siteId?: string;
  visitorId?: string;
  visitorName?: string;
  visitorEmail?: string | null;
  currentPage?: string;
  conversationId?: string;
  metadata?: VisitorMetadata;
  /**
   * Set when the visitor asked for a person before writing anything, so the
   * conversation their first message opens starts with a person, not the
   * assistant.
   */
  prefersHuman?: boolean;
}

export type WidgetSocket = Socket & WidgetSocketState;

/** What the admin namespace's authentication middleware guarantees. */
export interface AdminSocketState {
  userId: string;
  userName: string;
  organizationId: string;
  role: string;
  userType: UserType;
  /** Empty for an account that is not restricted to specific sites. */
  allowedSiteIds: Set<string>;
  /** The site room this socket has joined, once it picks one. */
  siteId?: string;
}

export type AdminSocket = Socket & AdminSocketState;

/** Every payload may be absent or carry extra keys; handlers validate first. */
interface ClientPayloadBase {
  [extra: string]: unknown;
}

export interface WidgetJoinPayload extends ClientPayloadBase {
  siteKey?: string;
  visitorId?: string;
  visitorName?: string;
  visitorEmail?: string;
  currentPage?: string;
  metadata?: {
    browser?: string;
    os?: string;
    country?: string;
    referrer?: string;
    language?: string;
    sessionId?: string;
    attributes?: Record<string, string | number | boolean>;
    [extra: string]: unknown;
  };
}

export interface PageViewPayload extends ClientPayloadBase {
  currentPage?: string;
}

/** An attachment, proven by the upload token the files route signed. */
export interface UploadedFilePayload extends ClientPayloadBase {
  uploadToken?: string;
  filename?: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  url?: string;
}

export interface SendMessagePayload extends ClientPayloadBase {
  conversationId?: string;
  content?: string;
  messageType?: MessageType;
  fileData?: UploadedFilePayload;
  /** Echoed back so the widget can reconcile its optimistic message. */
  clientMessageId?: string;
}

/** The visitor pressed "talk to a person" in an assistant-answered chat. */
export interface RequestHumanPayload extends ClientPayloadBase {
  /** The widget's language, for the handoff note. */
  language?: string;
}

export interface JoinSitePayload extends ClientPayloadBase {
  siteId?: string;
}

export interface ConversationPayload extends ClientPayloadBase {
  conversationId?: string;
}

export interface AssignConversationPayload extends ConversationPayload {
  agentId?: string;
}

export interface SetDepartmentPayload extends ConversationPayload {
  departmentId?: string;
}

export interface SetPriorityPayload extends ConversationPayload {
  priority?: Priority;
}

export interface UpdateStatusPayload extends ClientPayloadBase {
  status?: 'online' | 'away' | 'busy' | 'offline';
}

export interface TeamChatPayload extends ClientPayloadBase {
  chatId?: string;
}

export interface TeamChatSendPayload extends TeamChatPayload {
  content?: string;
}

/** A file that passed token verification and is safe to store on a message. */
export interface VerifiedFile {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}
