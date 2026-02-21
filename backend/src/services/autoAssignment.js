const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const Department = require('../models/Department');
const Site = require('../models/Site');

/**
 * Skill-based + Least-load routing
 * Filters agents by required skills and online status,
 * then assigns to agent with lowest current load within capacity
 */
async function findBestAgent(conversation, organizationId) {
  try {
    const { requiredSkills = [], department, siteId, priority } = conversation;
    
    // Build query: must be online, active, and in same organization
    const baseQuery = {
      organizationId,
      isActive: true,
      status: 'online' // Only online agents
    };
    
    // If department specified, filter by department members
    let departmentMembers = [];
    if (department) {
      const dept = await Department.findById(department).lean();
      if (dept && dept.members && dept.members.length > 0) {
        departmentMembers = dept.members.map(m => m.userId.toString());
        baseQuery._id = { $in: departmentMembers };
      }
    }
    
    // Get all eligible agents
    let agents = await Team.find(baseQuery)
      .select('_id name email status skills maxCapacity currentLoad organizationId')
      .lean();
    
    if (agents.length === 0) {
      // Fallback: if no department members or no online agents, try all org agents
      delete baseQuery._id;
      agents = await Team.find(baseQuery)
        .select('_id name email status skills maxCapacity currentLoad organizationId')
        .lean();
    }
    
    if (agents.length === 0) {
      return null; // No eligible agents
    }
    
    // Filter by skills if required
    if (requiredSkills && requiredSkills.length > 0) {
      agents = agents.filter(agent => {
        if (!agent.skills || agent.skills.length === 0) {
          return false; // Agent has no skills, can't handle skill-based tickets
        }
        // Agent must have at least one required skill
        return requiredSkills.some(skill => 
          agent.skills.some(agentSkill => 
            agentSkill.toLowerCase() === skill.toLowerCase()
          )
        );
      });
    }
    
    if (agents.length === 0) {
      // Fallback: if no skill match, use all agents (skill-based is optional)
      agents = await Team.find(baseQuery)
        .select('_id name email status skills maxCapacity currentLoad organizationId')
        .lean();
    }
    
    // Filter by capacity: currentLoad < maxCapacity
    agents = agents.filter(agent => {
      const load = agent.currentLoad || 0;
      const capacity = agent.maxCapacity || 10;
      return load < capacity;
    });
    
    if (agents.length === 0) {
      return null; // All agents at capacity
    }
    
    // Sort by currentLoad (ascending) - least load first
    agents.sort((a, b) => {
      const loadA = a.currentLoad || 0;
      const loadB = b.currentLoad || 0;
      return loadA - loadB;
    });
    
    // Return agent with lowest load
    return agents[0];
  } catch (error) {
    console.error('Error in findBestAgent:', error);
    return null;
  }
}

/**
 * Auto-assign conversation to best available agent
 */
async function autoAssignConversation(conversationId, organizationId) {
  try {
    const conversation = await Conversation.findById(conversationId)
      .populate('department')
      .populate('siteId');
    
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    // Don't reassign if already assigned and recently assigned
    if (conversation.assignedAgent && conversation.assignedAt) {
      const timeSinceAssignment = Date.now() - conversation.assignedAt.getTime();
      const minReassignInterval = 5 * 60 * 1000; // 5 minutes
      if (timeSinceAssignment < minReassignInterval) {
        return { success: false, reason: 'Recently assigned, skipping auto-reassign' };
      }
    }
    
    const bestAgent = await findBestAgent(conversation, organizationId);
    
    if (!bestAgent) {
      // No agent available, keep unassigned
      await Conversation.findByIdAndUpdate(conversationId, {
        status: 'unassigned'
      });
      return { success: false, reason: 'No eligible agent available' };
    }
    
    // Assign conversation
    conversation.assignedAgent = bestAgent._id;
    conversation.assignedBy = bestAgent._id; // Auto-assigned
    conversation.assignedAt = new Date();
    conversation.status = 'assigned';
    await conversation.save();
    
    // Update agent load
    await Team.findByIdAndUpdate(bestAgent._id, {
      $inc: { 
        'currentLoad': 1,
        'stats.activeConversations': 1,
        'stats.totalConversations': 1
      }
    });
    
    return { 
      success: true, 
      agentId: bestAgent._id,
      agentName: bestAgent.name
    };
  } catch (error) {
    console.error('Error in autoAssignConversation:', error);
    return { success: false, reason: error.message };
  }
}

/**
 * Auto-reassign: Check if agent went offline or SLA breached, then reassign
 */
async function checkAndReassign(conversationId, organizationId) {
  try {
    const conversation = await Conversation.findById(conversationId)
      .populate('assignedAgent')
      .populate('department');
    
    if (!conversation || !conversation.assignedAgent) {
      return { reassigned: false, reason: 'No assigned agent' };
    }
    
    const agent = conversation.assignedAgent;
    const shouldReassign = 
      // Agent went offline
      (agent.status === 'offline' || agent.status === 'away') ||
      // First response SLA breached and no response yet
      (conversation.sla.firstResponseStatus === 'breached' && !conversation.firstResponseAt) ||
      // Too many reassign attempts (prevent infinite loop)
      (conversation.autoReassignAttempts >= 3);
    
    if (!shouldReassign) {
      return { reassigned: false, reason: 'No need to reassign' };
    }
    
    // Unassign current agent
    const oldAgentId = conversation.assignedAgent._id;
    await Team.findByIdAndUpdate(oldAgentId, {
      $inc: { 
        'currentLoad': -1,
        'stats.activeConversations': -1
      }
    });
    
    conversation.assignedAgent = null;
    conversation.assignedAt = null;
    conversation.assignedBy = null;
    conversation.status = 'unassigned';
    conversation.autoReassignAttempts = (conversation.autoReassignAttempts || 0) + 1;
    conversation.lastReassignAt = new Date();
    await conversation.save();
    
    // Try to auto-assign to new agent
    const assignResult = await autoAssignConversation(conversationId, organizationId);
    
    return {
      reassigned: assignResult.success,
      reason: assignResult.reason || 'Reassigned successfully',
      newAgentId: assignResult.agentId,
      oldAgentId: oldAgentId.toString()
    };
  } catch (error) {
    console.error('Error in checkAndReassign:', error);
    return { reassigned: false, reason: error.message };
  }
}

/**
 * Update agent load when conversation status changes
 */
async function updateAgentLoad(agentId, delta) {
  try {
    await Team.findByIdAndUpdate(agentId, {
      $inc: { currentLoad: delta }
    });
  } catch (error) {
    console.error('Error updating agent load:', error);
  }
}

module.exports = {
  findBestAgent,
  autoAssignConversation,
  checkAndReassign,
  updateAgentLoad
};
