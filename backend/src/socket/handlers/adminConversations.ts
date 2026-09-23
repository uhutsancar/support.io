// The agent's side of a conversation: reading it, replying, and the moves they
// make on it.
//
// Authorisation for every one of these is `ctx.conversationFor`, which checks
// the organization *and* the agent's site allow-list. A handler never queries a
// conversation by id on its own.

import Department from '../../models/Department';
import Message from '../../models/Message';
import Team from '../../models/Team';
import User from '../../models/User';
import { refreshSla } from '../../services/conversationSla';
import {
  recordAgentAssignment,
  recordAgentResolution,
  recordDepartmentChange,
  recordResolution
} from '../../services/departmentStats';
import {
  CLIENT_MESSAGE_TYPES,
  PRIORITIES,
  isActiveConversationStatus,
  isClientMessageType,
  isPriority,
  slaTargetsFor
} from '../../domain';
import { conversationRoom, siteRoom } from '../../realtime/rooms';
import type { Doc } from '../../db/model';
import type { CreateInput } from '../../db/model';
import type { ConversationDoc } from '../../models/Conversation';
import type { MessageDoc } from '../../models/Message';
import type { SocketContext } from '../context';
import type {
  AdminSocket,
  AssignConversationPayload,
  ConversationPayload,
  JoinSitePayload,
  SendMessagePayload,
  SetDepartmentPayload,
  SetPriorityPayload
} from '../types';

const MAX_MESSAGE_LENGTH = 10000;

/** Default cap for an account whose row does not set one. */
const DEFAULT_CAPACITY = 10;

/** Roles allowed to move work between agents or between departments. */
const ROUTING_ROLES = new Set(['owner', 'admin']);

/**
 * The agent, from whichever table holds them.
 *
 * An account is a Team row or a User row, and the caller usually needs the
 * model back so it can update that row's counters.
 */
async function findAgent(agentId: unknown, organizationId: string) {
  if (!agentId) return null;
  const team = await Team.findOne({ _id: agentId, organizationId, isActive: true });
  if (team) return { agent: team, Model: Team };
  const user = await User.findOne({ _id: agentId, organizationId, isActive: true });
  return user ? { agent: user, Model: User } : null;
}

/** Whether an agent restricted to certain sites may work on this one. */
function mayWorkOnSite(assignedSites: readonly unknown[] | undefined, siteId: unknown): boolean {
  const sites = (assignedSites ?? []).map(String);
  return sites.length === 0 || sites.includes(String(siteId));
}

/**
 * Folds one reply into the agent's rolling average response time.
 *
 * Kept next to its only caller because it reads two fields that only mean
 * anything together: `totalResponses` is the divisor `averageResponseTime` was
 * computed with.
 */
async function recordFirstResponse(
  agentId: string,
  conversation: Doc<ConversationDoc>
): Promise<void> {
  const agent = await Team.findById(agentId);
  if (!agent || !conversation.firstResponseAt) return;

  const minutes = Math.floor(
    (conversation.firstResponseAt.getTime() - conversation.createdAt.getTime()) / 1000 / 60
  );
  const previousCount = agent.stats.totalResponses || 0;
  const previousAverage = agent.stats.averageResponseTime || 0;

  agent.stats.averageResponseTime =
    (previousAverage * previousCount + minutes) / (previousCount + 1);
  agent.stats.totalResponses = previousCount + 1;
  await agent.save();
}

export function installAdminConversationHandlers(ctx: SocketContext, socket: AdminSocket): void {
  // ------------------------------------------------------------------ joining

  socket.on(
    'join-site',
    ctx.guard(socket, async (data: JoinSitePayload | undefined) => {
      const siteId = data?.siteId;
      // Team Chat opens with no site selected and needs only the user/org rooms.
      if (!siteId) return;

      const site = await ctx.siteFor(socket, siteId);
      if (!site) return ctx.reject(socket);

      if (socket.siteId && String(socket.siteId) !== String(site._id)) {
        await socket.leave(siteRoom(socket.siteId));
      }
      socket.siteId = String(site._id);
      // Awaited: with the Redis adapter joining is asynchronous, and a
      // broadcast issued before it resolves would miss this socket.
      await socket.join(siteRoom(site._id));
    })
  );

  socket.on(
    'join-conversation',
    ctx.guard(socket, async (data: ConversationPayload | undefined) => {
      const conversation = await ctx.conversationFor(socket, data?.conversationId);
      if (!conversation) return ctx.reject(socket);

      await socket.join(conversationRoom(conversation._id));
      await Message.updateMany(
        { conversationId: conversation._id, isRead: false, senderType: 'visitor' },
        { isRead: true, readAt: new Date() }
      );
    })
  );

  // ---------------------------------------------------------------- replying

  socket.on(
    'send-message',
    ctx.guard(socket, async (data: SendMessagePayload | undefined) => {
      const { content, messageType, fileData } = data || {};

      if (typeof content !== 'string' || !content.trim() || content.length > MAX_MESSAGE_LENGTH) {
        return socket.emit('error', { message: 'Invalid message content' });
      }
      if (messageType && !isClientMessageType(messageType)) {
        return socket.emit('error', {
          message: `messageType must be one of: ${CLIENT_MESSAGE_TYPES.join(', ')}`
        });
      }

      const conversation = await ctx.conversationFor(socket, data?.conversationId, {
        populateDepartment: true
      });
      if (!conversation) return ctx.reject(socket);

      const needsAttachment = messageType === 'file' || messageType === 'image';
      const verifiedFile = needsAttachment
        ? ctx.verifyAttachment(fileData, conversation.siteId)
        : null;
      if (needsAttachment && !verifiedFile) {
        return socket.emit('error', { message: 'Invalid or expired file upload' });
      }

      // Answering an unclaimed conversation takes it: an agent who has started
      // typing is the one handling it.
      if (!conversation.assignedAgent) {
        conversation.assignedAgent = socket.userId;
        conversation.assignedAt = new Date();
        conversation.status = 'assigned';
      }

      const isFirstResponse = !conversation.firstResponseAt;
      if (isFirstResponse) {
        conversation.firstResponseAt = new Date();
        refreshSla(conversation);
        await recordFirstResponse(socket.userId, conversation);
        ctx.toAdminSite(conversation.siteId, 'conversation-update', {
          conversationId: conversation._id,
          conversation: conversation.toObject()
        });
      }

      const messageData: CreateInput<MessageDoc> = {
        conversationId: conversation._id,
        senderType: 'agent',
        senderId: socket.userId,
        senderName: socket.userName,
        content: content.trim(),
        messageType: messageType || 'text',
        isRead: true
      };
      if (verifiedFile) messageData.fileData = verifiedFile;

      const message = await Message.create(messageData);

      // An agent reply clears the badge: the unread count tracks what the *agent*
      // has not read, and they have just been here.
      conversation.unreadCount = 0;
      conversation.lastMessageAt = new Date();
      await conversation.save();

      ctx.toWidgetConversation(conversation._id, 'new-message', { message });
      ctx.toAdminConversation(conversation._id, 'new-message', { message, conversation });
      ctx.toAdminSite(conversation.siteId, 'new-message', { message, conversation });
    })
  );

  socket.on(
    'typing',
    ctx.guard(socket, async (data: ConversationPayload | undefined) => {
      const conversation = await ctx.conversationFor(socket, data?.conversationId);
      if (!conversation) return;
      ctx.toWidgetConversation(conversation._id, 'agent-typing', {
        conversationId: conversation._id
      });
    })
  );

  // --------------------------------------------------------------- assignment

  socket.on(
    'assign-conversation',
    ctx.guard(socket, async (data: AssignConversationPayload) => {
      const { agentId } = data;

      const conversation = await ctx.conversationFor(socket, data.conversationId);
      if (!conversation) return ctx.reject(socket);

      if (!ROUTING_ROLES.has(socket.role)) {
        return socket.emit('error', {
          message: 'Yetersiz yetki: atama işlemi için admin gerekli.'
        });
      }

      const target = await findAgent(agentId, socket.organizationId);
      if (!target || !mayWorkOnSite(target.agent.assignedSites, conversation.siteId)) {
        return ctx.reject(socket);
      }

      conversation.assignedAgent = agentId;
      conversation.assignedBy = socket.userId;
      conversation.assignedAt = new Date();
      conversation.status = 'assigned';
      await conversation.save();

      await recordAgentAssignment(target.Model, agentId, socket.organizationId);

      // The previous version wrapped this in two nested try/catch blocks that
      // looked the agent up again, branched three ways on which table they were
      // in, and emitted the identical payload in all three branches plus the
      // catch — forty lines with exactly one outcome.
      const assignment = {
        conversationId: conversation._id,
        agentId,
        assignedBy: socket.userId,
        siteId: conversation.siteId
      };
      ctx.toAdminSite(conversation.siteId, 'conversation-assigned', assignment);
      ctx.toAdminUser(agentId, 'conversation-assigned', assignment);
    })
  );

  socket.on(
    'claim-conversation',
    ctx.guard(socket, async (data: ConversationPayload) => {
      const conversation = await ctx.conversationFor(socket, data.conversationId);
      if (!conversation) return ctx.reject(socket);

      if (conversation.assignedAgent) {
        return socket.emit('error', { message: 'Conversation is already assigned' });
      }

      const target = await findAgent(socket.userId, socket.organizationId);
      if (!target) return ctx.reject(socket);

      // The two account tables name the same limit differently, so each side is
      // read where it exists.
      const { agent, Model } = target;
      const capacity =
        ('maxCapacity' in agent ? agent.maxCapacity : undefined) ??
        ('preferences' in agent ? agent.preferences?.maxActiveConversations : undefined) ??
        DEFAULT_CAPACITY;
      const load =
        ('currentLoad' in agent ? agent.currentLoad : undefined) ??
        agent.stats?.activeConversations ??
        0;

      if (load >= capacity) {
        return socket.emit('error', { message: 'Maximum active conversations reached' });
      }

      conversation.assignedAgent = socket.userId;
      conversation.assignedBy = socket.userId;
      conversation.assignedAt = new Date();
      conversation.status = 'assigned';
      await conversation.save();

      await recordAgentAssignment(Model, socket.userId, socket.organizationId);

      const claim = { conversationId: conversation._id, agentId: socket.userId };
      ctx.toAdminSite(conversation.siteId, 'conversation-claimed', claim);
      ctx.toAdminUser(socket.userId, 'conversation-claimed', claim);
    })
  );

  // ------------------------------------------------------------------ routing

  socket.on(
    'set-department',
    ctx.guard(socket, async (data: SetDepartmentPayload) => {
      const { departmentId } = data;

      const conversation = await ctx.conversationFor(socket, data.conversationId);
      if (!conversation) return ctx.reject(socket);

      if (!ROUTING_ROLES.has(socket.role)) {
        return socket.emit('error', {
          message: 'Yetersiz yetki: departman ataması için admin gerekli.'
        });
      }

      // The department must belong to this conversation's own site, not merely
      // to the caller's organization.
      const department = departmentId
        ? await Department.findOne({
            _id: departmentId,
            siteId: conversation.siteId,
            isActive: true
          })
        : null;
      if (departmentId && !department) return ctx.reject(socket);

      const previousDepartmentId = conversation.department;
      const wasActive = isActiveConversationStatus(conversation.status);

      conversation.department = department?._id ?? null;
      if (department) {
        Object.assign(conversation.sla, slaTargetsFor(conversation.priority, department.sla));
        refreshSla(conversation);
      }
      await conversation.save();

      await recordDepartmentChange(conversation, previousDepartmentId, department?._id ?? null, {
        wasActive
      });

      ctx.toAdminSite(conversation.siteId, 'conversation-department-changed', {
        conversationId: conversation._id,
        departmentId,
        conversation
      });
    })
  );

  socket.on(
    'set-priority',
    ctx.guard(socket, async (data: SetPriorityPayload) => {
      const { priority } = data;
      if (!isPriority(priority)) {
        return socket.emit('error', {
          message: `priority must be one of: ${PRIORITIES.join(', ')}`
        });
      }

      const conversation = await ctx.conversationFor(socket, data.conversationId, {
        populateDepartment: true
      });
      if (!conversation) return ctx.reject(socket);

      conversation.priority = priority;
      Object.assign(conversation.sla, slaTargetsFor(priority, conversation.department?.sla));
      refreshSla(conversation);
      await conversation.save();

      ctx.toAdminSite(conversation.siteId, 'conversation-priority-changed', {
        conversationId: conversation._id,
        priority,
        conversation
      });
    })
  );

  // ---------------------------------------------------------------- resolving

  socket.on(
    'resolve-conversation',
    ctx.guard(socket, async (data: ConversationPayload) => {
      const conversation = await ctx.conversationFor(socket, data.conversationId, {
        populateDepartment: true
      });
      if (!conversation) return ctx.reject(socket);

      if (!isActiveConversationStatus(conversation.status)) {
        // Already resolved or closed: answer with the current state rather than
        // counting it a second time.
        return socket.emit('conversation-resolved', {
          conversationId: conversation._id,
          conversation
        });
      }

      conversation.status = 'resolved';
      conversation.resolvedAt = new Date();
      refreshSla(conversation);
      await conversation.save();

      // The identical rollup the HTTP route performs; see
      // services/departmentStats.ts for why it is no longer written out twice.
      await recordResolution(conversation);
      await recordAgentResolution(conversation.assignedAgent);

      ctx.toAdminSite(conversation.siteId, 'conversation-resolved', {
        conversationId: conversation._id,
        conversation
      });
    })
  );
}
