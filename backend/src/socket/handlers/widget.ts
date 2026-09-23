// The visitor's side of the chat.
//
// Everything a customer's page can send. Nothing here is trusted: the site key
// is looked up, every string is bounded, an attachment must carry the signed
// proof our upload endpoint issued, and a conversation id is only accepted when
// it belongs to this visitor on this site.

import Conversation from '../../models/Conversation';
import Message from '../../models/Message';
import Site from '../../models/Site';
import Team from '../../models/Team';
import Visitor from '../../models/Visitor';
import { checkAndReassign } from '../../services/autoAssignment';
import { openConversation } from '../../services/conversationIntake';
import { refreshSla } from '../../services/conversationSla';
import { tryFaqAutoResponse } from '../../services/faqAutoResponse';
import { runAutomation } from '../../services/automationTrigger';
import { CLIENT_MESSAGE_TYPES, isAwayPresence, isClientMessageType } from '../../domain';
import { conversationRoom } from '../../realtime/rooms';
import type { Socket } from 'socket.io';
import type { CreateInput } from '../../db/model';
import type { MessageDoc } from '../../models/Message';
import type { SocketContext } from '../context';
import type {
  PageViewPayload,
  SendMessagePayload,
  VisitorMetadata,
  WidgetJoinPayload,
  WidgetSocket
} from '../types';

// Bounds for everything a client sends. A value that arrives longer than this
// is truncated rather than rejected: a visitor should not lose their message
// because their browser reported a 3 KB user-agent string.
const LIMITS = {
  siteKey: 128,
  visitorId: 100,
  visitorName: 100,
  visitorEmail: 254,
  page: 2048,
  message: 10000,
  clientMessageId: 100,
  metadataShort: 100,
  language: 30,
  attributeKey: 64,
  attributeValue: 500,
  attributeCount: 20
} as const;

/** Ids we will accept from a client: no separators that could change a room name. */
const SAFE_ID = /^[a-z0-9_.:-]+$/i;

/** How much history a joining visitor receives; the rest is fetched on demand. */
const JOIN_HISTORY_LIMIT = 100;

function boundedString(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

/**
 * The visitor attributes a customer's site chose to send us.
 *
 * Free-form by design — a shop sends a cart total, a SaaS sends a plan — so the
 * shape cannot be validated, only bounded: a capped number of keys, keys that
 * look like identifiers, and primitive values only.
 */
function sanitizeAttributes(raw: unknown): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;

  for (const [key, value] of Object.entries(raw).slice(0, LIMITS.attributeCount)) {
    if (!new RegExp(`^[a-z0-9_.-]{1,${LIMITS.attributeKey}}$`, 'i').test(key)) continue;
    if (typeof value === 'string') out[key] = value.slice(0, LIMITS.attributeValue);
    else if (typeof value === 'number' || typeof value === 'boolean') out[key] = value;
  }
  return out;
}

function sanitizeMetadata(raw: WidgetJoinPayload['metadata']): VisitorMetadata {
  return {
    browser: boundedString(raw?.browser, LIMITS.metadataShort),
    os: boundedString(raw?.os, LIMITS.metadataShort),
    country: boundedString(raw?.country, LIMITS.metadataShort),
    referrer: boundedString(raw?.referrer, LIMITS.page),
    language: boundedString(raw?.language, LIMITS.language),
    sessionId: boundedString(raw?.sessionId, LIMITS.metadataShort),
    attributes: sanitizeAttributes(raw?.attributes)
  };
}

export function installWidgetHandlers(ctx: SocketContext): void {
  ctx.widget.on('connection', (rawSocket: Socket) => {
    const socket = rawSocket as WidgetSocket;

    // ---------------------------------------------------------------- joining

    socket.on(
      'join-conversation',
      ctx.guard(socket, async (data: WidgetJoinPayload | undefined) => {
        const { siteKey, visitorId, visitorName, visitorEmail, currentPage, metadata } = data || {};

        if (
          typeof siteKey !== 'string' ||
          siteKey.length > LIMITS.siteKey ||
          typeof visitorId !== 'string' ||
          visitorId.length > LIMITS.visitorId ||
          !SAFE_ID.test(visitorId)
        ) {
          socket.emit('error', { message: 'Invalid widget session' });
          return;
        }

        const site = await Site.findOne({ siteKey, isActive: true });
        if (!site) {
          socket.emit('error', { message: 'Invalid site key' });
          return;
        }

        socket.siteId = site._id;
        socket.visitorId = visitorId;
        socket.visitorName = boundedString(visitorName, LIMITS.visitorName)?.trim() || 'Visitor';
        socket.visitorEmail = boundedString(visitorEmail, LIMITS.visitorEmail)?.trim() ?? null;
        socket.currentPage = boundedString(currentPage, LIMITS.page) ?? '/';
        socket.metadata = sanitizeMetadata(metadata);

        // An open conversation is resumed; otherwise the widget shows the site's
        // welcome message and the conversation is created on the first message.
        const conversation = await Conversation.findOne({
          siteId: site._id,
          visitorId,
          status: { $in: ['open', 'assigned', 'pending'] }
        }).populate('department', 'name color icon');

        if (conversation) {
          await socket.join(conversationRoom(conversation._id));
          socket.conversationId = conversation._id;
          conversation.currentPage = socket.currentPage;
          refreshSla(conversation);
          await conversation.save();

          // The newest page only: a long thread would otherwise make the join
          // response megabytes large and delay the connection.
          const recent = await Message.find({ conversationId: conversation._id })
            .sort({ createdAt: -1 })
            .limit(JOIN_HISTORY_LIMIT);

          socket.emit('conversation-joined', { conversation, messages: recent.reverse() });
        } else {
          socket.emit('conversation-joined', {
            conversation: null,
            messages: [],
            welcomeMessage: site.widgetSettings.welcomeMessage || 'Hi! How can we help you today?'
          });
        }

        const visitorDoc = await Visitor.findOneAndUpdate(
          { visitorId, siteId: site._id },
          {
            organizationId: site.organizationId,
            ip: socket.handshake.address || null,
            country: socket.metadata.country,
            browser: socket.metadata.browser,
            os: socket.metadata.os,
            currentPage: socket.currentPage,
            referrer: socket.metadata.referrer,
            isActive: true,
            lastActiveAt: new Date()
          },
          { new: true, upsert: true }
        );

        ctx.toAdminSite(site._id, 'visitor-updated', visitorDoc);
      })
    );

    // ------------------------------------------------------------- navigation

    socket.on(
      'visitor-page-view',
      ctx.guard(socket, async (data: PageViewPayload | undefined) => {
        if (!socket.visitorId || !socket.siteId) return;

        const currentPage = boundedString(data?.currentPage, LIMITS.page) ?? '/';
        socket.currentPage = currentPage;

        const visitorDoc = await Visitor.findOneAndUpdate(
          { visitorId: socket.visitorId, siteId: socket.siteId },
          { currentPage, lastActiveAt: new Date(), isActive: true },
          { new: true }
        );

        if (visitorDoc) ctx.toAdminSite(socket.siteId, 'visitor-updated', visitorDoc);
      })
    );

    // ---------------------------------------------------------------- talking

    socket.on(
      'send-message',
      ctx.guard(socket, async (data: SendMessagePayload | undefined) => {
        const { content, messageType, fileData, clientMessageId } = data || {};

        if (typeof content !== 'string' || !content.trim() || content.length > LIMITS.message) {
          return socket.emit('error', { message: 'Invalid message content' });
        }
        if (messageType && !isClientMessageType(messageType)) {
          return socket.emit('error', {
            message: `messageType must be one of: ${CLIENT_MESSAGE_TYPES.join(', ')}`
          });
        }
        if (
          clientMessageId != null &&
          (typeof clientMessageId !== 'string' ||
            clientMessageId.length > LIMITS.clientMessageId ||
            !SAFE_ID.test(clientMessageId))
        ) {
          return socket.emit('error', { message: 'Invalid client message id' });
        }

        // The first message opens the conversation. Everything that involves —
        // routing, SLA seeding, counters, auto-assignment, the out-of-hours
        // greeting — lives in services/conversationIntake.ts.
        if (!socket.conversationId) {
          const site = await Site.findById(socket.siteId);
          if (!site?.organizationId) {
            return socket.emit('error', { message: 'Site not found' });
          }

          const { conversation: opened, greeting } = await openConversation(
            site,
            {
              visitorId: socket.visitorId!,
              visitorName: socket.visitorName!,
              visitorEmail: socket.visitorEmail ?? null,
              currentPage: socket.currentPage!,
              metadata: socket.metadata
            },
            content
          );

          await socket.join(conversationRoom(opened._id));
          socket.conversationId = opened._id;

          if (greeting) {
            ctx.toWidgetConversation(opened._id, 'new-message', { message: greeting });
          }

          ctx.toAdminSite(socket.siteId, 'new-conversation', {
            conversation: await opened.populate('department', 'name color icon')
          });

          runAutomation('conversation_created', opened, { content });
        }

        const conversation = await ctx.widgetConversationFor(socket, socket.conversationId);
        if (!conversation) return ctx.reject(socket);

        const needsAttachment = messageType === 'file' || messageType === 'image';
        const verifiedFile = needsAttachment
          ? ctx.verifyAttachment(fileData, conversation.siteId)
          : null;
        if (needsAttachment && !verifiedFile) {
          return socket.emit('error', { message: 'Invalid or expired file upload' });
        }

        const messageData: CreateInput<MessageDoc> = {
          conversationId: conversation._id,
          senderType: 'visitor',
          senderId: conversation.visitorId,
          senderName: conversation.visitorName,
          content: content.trim(),
          messageType: messageType || 'text',
          isRead: false
        };
        if (verifiedFile) messageData.fileData = verifiedFile;

        const message = await Message.create(messageData);
        // Echoed back so the widget can reconcile its optimistic copy.
        const emitted = {
          ...message.toObject(),
          ...(clientMessageId ? { clientMessageId } : {})
        };

        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
        conversation.lastMessageAt = new Date();
        await conversation.save();

        // The assigned agent has gone away since they took this: hand it on
        // rather than leaving the visitor waiting on somebody who is not there.
        if (conversation.assignedAgent) {
          const agent = await Team.findById(conversation.assignedAgent);
          if (agent && isAwayPresence(agent.status) && conversation.organizationId) {
            await checkAndReassign(conversation._id, String(conversation.organizationId));
            await conversation.populate('assignedAgent', 'name avatar status');
          }
        }

        ctx.toWidgetConversation(conversation._id, 'new-message', { message: emitted });
        ctx.toAdminSite(conversation.siteId, 'new-message', { message: emitted, conversation });
        if (conversation.assignedAgent) {
          ctx.toAdminUser(conversation.assignedAgent, 'new-message', {
            message: emitted,
            conversation
          });
        }
        ctx.toAdminSite(conversation.siteId, 'notification', {
          type: 'new-message',
          message: `New message from ${conversation.visitorName}`,
          siteId: conversation.siteId,
          conversationId: conversation._id,
          timestamp: new Date()
        });

        runAutomation('message_received', conversation, { content, message });
        await tryFaqAutoResponse(ctx, conversation, content);
      })
    );

    socket.on('typing', () => {
      if (!socket.conversationId) return;
      ctx.toAdminConversation(socket.conversationId, 'visitor-typing', {
        conversationId: socket.conversationId
      });
    });

    // ------------------------------------------------------------- going away

    socket.on(
      'disconnect',
      ctx.guard(socket, async () => {
        if (!socket.visitorId || !socket.siteId) return;

        const visitorDoc = await Visitor.findOneAndUpdate(
          { visitorId: socket.visitorId, siteId: socket.siteId },
          { isActive: false, lastActiveAt: new Date() },
          { new: true }
        );
        if (visitorDoc) ctx.toAdminSite(socket.siteId, 'visitor-updated', visitorDoc);
      })
    );
  });
}
