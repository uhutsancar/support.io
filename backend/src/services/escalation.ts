/** Which clock is close to breaching, and by how much. */
import Team from '../models/Team';
import Conversation from '../models/Conversation';
import { autoAssignConversation } from './autoAssignment';
import events from '../events';
import type { Server } from 'socket.io';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

interface SlaWarning {
  type: 'firstResponse' | 'resolution';
  remaining: number;
  threshold: number;
}

function isSLAWarningThreshold(conversation: Doc<ConversationDoc>): SlaWarning | false {
  if (!conversation.sla) return false;
  const now = new Date();
  const createdTime = conversation.createdAt.getTime();
  const elapsedMinutes = Math.floor((now.getTime() - createdTime) / 1000 / 60);
  if (!conversation.firstResponseAt) {
    const remaining = conversation.sla.firstResponseTarget - elapsedMinutes;
    const threshold = conversation.sla.firstResponseTarget * 0.8;
    if (remaining > 0 && remaining <= (conversation.sla.firstResponseTarget - threshold)) {
      return { type: 'firstResponse', remaining, threshold };
    }
  }
  if (conversation.status !== 'resolved' && conversation.status !== 'closed') {
    const remaining = conversation.sla.resolutionTarget - elapsedMinutes;
    const threshold = conversation.sla.resolutionTarget * 0.8;
    if (remaining > 0 && remaining <= (conversation.sla.resolutionTarget - threshold)) {
      return { type: 'resolution', remaining, threshold };
    }
  }
  return false;
}
async function sendSLAWarning(conversation: Doc<ConversationDoc>, io: Server) {
  const warning = isSLAWarningThreshold(conversation);
  if (!warning) return warning;
  const warningData = {
    conversationId: conversation._id,
    ticketNumber: conversation.ticketNumber,
    ticketId: conversation.ticketId,
    type: warning.type,
    remaining: warning.remaining,
    siteId: conversation.siteId,
    assignedAgent: conversation.assignedAgent
  };
  if (conversation.assignedAgent) {
    io.of('/admin').to(`user:${conversation.assignedAgent}`).emit('sla-warning', warningData);
  }
  io.of('/admin').to(`site:${conversation.siteId}`).emit('sla-warning', warningData);
  return warningData;
}
async function handleSLABreach(conversation: Doc<ConversationDoc>, organizationId: string, io: Server) {
  try {
    // `reassigned` / `newAgentId` are added below when the breach triggers a
    // hand-over, so the shape is declared up front rather than grown ad hoc.
    const breachData: {
      conversationId: string;
      ticketNumber: number;
      ticketId: string;
      siteId: unknown;
      assignedAgent: unknown;
      firstResponseBreached: boolean;
      resolutionBreached: boolean;
      reassigned?: boolean;
      newAgentId?: string | null;
    } = {
      conversationId: conversation._id,
      ticketNumber: conversation.ticketNumber,
      ticketId: conversation.ticketId,
      siteId: conversation.siteId,
      assignedAgent: conversation.assignedAgent,
      firstResponseBreached: conversation.sla.firstResponseStatus === 'breached',
      resolutionBreached: conversation.sla.resolutionStatus === 'breached'
    };
    const teamLeads = await Team.find({
      organizationId,
      isActive: true,
      role: { $in: ['admin', 'manager'] }
    }).select('_id name email').lean();
    teamLeads.forEach(lead => {
      io.of('/admin').to(`user:${lead._id}`).emit('sla-breach-escalation', breachData);
    });
    io.of('/admin').to(`site:${conversation.siteId}`).emit('sla-breach-escalation', breachData);
    if (conversation.sla.firstResponseStatus === 'breached' && !conversation.firstResponseAt) {
      const reassignResult = await autoAssignConversation(conversation._id, organizationId);
      if (reassignResult.success) {
        breachData.reassigned = true;
        breachData.newAgentId = reassignResult.agentId;
        io.of('/admin').to(`site:${conversation.siteId}`).emit('sla-breach-reassigned', breachData);
      }
    }
    try {
      events.emit('sla.breach', {
        organizationId,
        userId: conversation.assignedAgent || null,
        entityId: conversation._id,
        metadata: breachData,
        ip: null,
        ua: null
      });
    } catch (e) {
    }
    return breachData;
  } catch (error) {
    return null;
  }
}
export { isSLAWarningThreshold, sendSLAWarning, handleSLABreach };