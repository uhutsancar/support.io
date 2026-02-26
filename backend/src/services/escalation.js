const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const { autoAssignConversation } = require('./autoAssignment');
const events = require('../events');
function isSLAWarningThreshold(conversation) {
  if (!conversation.sla) return false;
  const now = new Date();
  const createdTime = conversation.createdAt.getTime();
  const elapsedMinutes = Math.floor((now - createdTime) / 1000 / 60);
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
async function sendSLAWarning(conversation, io) {
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
async function handleSLABreach(conversation, organizationId, io) {
  try {
    const breachData = {
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
      const { autoAssignConversation } = require('./autoAssignment');
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
module.exports = {
  isSLAWarningThreshold,
  sendSLAWarning,
  handleSLABreach
};
