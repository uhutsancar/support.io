const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const { autoAssignConversation } = require('./autoAssignment');

/**
 * Escalation Service
 * - %80 SLA threshold: Send warning
 * - Breach: Notify team lead and reassign if needed
 */

/**
 * Check if SLA is approaching breach threshold (%80)
 */
function isSLAWarningThreshold(conversation) {
  if (!conversation.sla) return false;
  
  const now = new Date();
  const createdTime = conversation.createdAt.getTime();
  const elapsedMinutes = Math.floor((now - createdTime) / 1000 / 60);
  
  // First response warning
  if (!conversation.firstResponseAt) {
    const remaining = conversation.sla.firstResponseTarget - elapsedMinutes;
    const threshold = conversation.sla.firstResponseTarget * 0.8;
    if (remaining > 0 && remaining <= (conversation.sla.firstResponseTarget - threshold)) {
      return { type: 'firstResponse', remaining, threshold };
    }
  }
  
  // Resolution warning
  if (conversation.status !== 'resolved' && conversation.status !== 'closed') {
    const remaining = conversation.sla.resolutionTarget - elapsedMinutes;
    const threshold = conversation.sla.resolutionTarget * 0.8;
    if (remaining > 0 && remaining <= (conversation.sla.resolutionTarget - threshold)) {
      return { type: 'resolution', remaining, threshold };
    }
  }
  
  return false;
}

/**
 * Send SLA warning notification
 */
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
  
  // Notify assigned agent
  if (conversation.assignedAgent) {
    io.of('/admin').to(`user:${conversation.assignedAgent}`).emit('sla-warning', warningData);
  }
  
  // Notify site admins
  io.of('/admin').to(`site:${conversation.siteId}`).emit('sla-warning', warningData);
  
  console.log(`⚠️ SLA Warning: ${warning.type} for ticket ${conversation.ticketId}, ${warning.remaining} minutes remaining`);
  
  return warningData;
}

/**
 * Handle SLA breach: Notify team lead and reassign if needed
 */
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
    
    // Find team lead/manager in the organization
    const teamLeads = await Team.find({
      organizationId,
      isActive: true,
      role: { $in: ['admin', 'manager'] }
    }).select('_id name email').lean();
    
    // Notify team leads
    teamLeads.forEach(lead => {
      io.of('/admin').to(`user:${lead._id}`).emit('sla-breach-escalation', breachData);
    });
    
    // Notify site admins
    io.of('/admin').to(`site:${conversation.siteId}`).emit('sla-breach-escalation', breachData);
    
    // If first response breached and no response yet, try to reassign
    if (conversation.sla.firstResponseStatus === 'breached' && !conversation.firstResponseAt) {
      const { autoAssignConversation } = require('./autoAssignment');
      const reassignResult = await autoAssignConversation(conversation._id, organizationId);
      
      if (reassignResult.success) {
        breachData.reassigned = true;
        breachData.newAgentId = reassignResult.agentId;
        io.of('/admin').to(`site:${conversation.siteId}`).emit('sla-breach-reassigned', breachData);
      }
    }
    
    console.log(`🚨 SLA Breach: Ticket ${conversation.ticketId} breached, team leads notified`);
    
    return breachData;
  } catch (error) {
    console.error('Error handling SLA breach:', error);
    return null;
  }
}

module.exports = {
  isSLAWarningThreshold,
  sendSLAWarning,
  handleSLABreach
};
