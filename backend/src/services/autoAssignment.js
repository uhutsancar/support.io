const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const Department = require('../models/Department');
const Site = require('../models/Site');
async function findBestAgent(conversation, organizationId) {
  try {
    const { requiredSkills = [], department, siteId, priority } = conversation;
    const baseQuery = {
      organizationId,
      isActive: true,
      status: 'online'
    };
    let departmentMembers = [];
    if (department) {
      const dept = await Department.findById(department).lean();
      if (dept && dept.members && dept.members.length > 0) {
        departmentMembers = dept.members.map(m => m.userId.toString());
        baseQuery._id = { $in: departmentMembers };
      }
    }
    let agents = await Team.find(baseQuery)
      .select('_id name email status skills maxCapacity currentLoad organizationId')
      .lean();
    if (agents.length === 0) {
      delete baseQuery._id;
      agents = await Team.find(baseQuery)
        .select('_id name email status skills maxCapacity currentLoad organizationId')
        .lean();
    }
    if (agents.length === 0) {
      return null;
    }
    if (requiredSkills && requiredSkills.length > 0) {
      agents = agents.filter(agent => {
        if (!agent.skills || agent.skills.length === 0) {
          return false;
        }
        return requiredSkills.some(skill => 
          agent.skills.some(agentSkill => 
            agentSkill.toLowerCase() === skill.toLowerCase()
          )
        );
      });
    }
    if (agents.length === 0) {
      agents = await Team.find(baseQuery)
        .select('_id name email status skills maxCapacity currentLoad organizationId')
        .lean();
    }
    agents = agents.filter(agent => {
      const load = agent.currentLoad || 0;
      const capacity = agent.maxCapacity || 10;
      return load < capacity;
    });
    if (agents.length === 0) {
      return null;
    }
    agents.sort((a, b) => {
      const loadA = a.currentLoad || 0;
      const loadB = b.currentLoad || 0;
      return loadA - loadB;
    });
    return agents[0];
  } catch (error) {
    return null;
  }
}
async function autoAssignConversation(conversationId, organizationId) {
  try {
    const conversation = await Conversation.findById(conversationId)
      .populate('department')
      .populate('siteId');
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    if (conversation.assignedAgent && conversation.assignedAt) {
      const timeSinceAssignment = Date.now() - conversation.assignedAt.getTime();
      const minReassignInterval = 5 * 60 * 1000;
      if (timeSinceAssignment < minReassignInterval) {
        return { success: false, reason: 'Recently assigned, skipping auto-reassign' };
      }
    }
    const bestAgent = await findBestAgent(conversation, organizationId);
    if (!bestAgent) {
      await Conversation.findByIdAndUpdate(conversationId, {
        status: 'unassigned'
      });
      return { success: false, reason: 'No eligible agent available' };
    }
    conversation.assignedAgent = bestAgent._id;
    conversation.assignedBy = bestAgent._id;
    conversation.assignedAt = new Date();
    conversation.status = 'assigned';
    await conversation.save();
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
    return { success: false, reason: error.message };
  }
}
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
      (agent.status === 'offline' || agent.status === 'away') ||
      (conversation.sla.firstResponseStatus === 'breached' && !conversation.firstResponseAt) ||
      (conversation.autoReassignAttempts >= 3);
    if (!shouldReassign) {
      return { reassigned: false, reason: 'No need to reassign' };
    }
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
    const assignResult = await autoAssignConversation(conversationId, organizationId);
    return {
      reassigned: assignResult.success,
      reason: assignResult.reason || 'Reassigned successfully',
      newAgentId: assignResult.agentId,
      oldAgentId: oldAgentId.toString()
    };
  } catch (error) {
    return { reassigned: false, reason: error.message };
  }
}
async function updateAgentLoad(agentId, delta) {
  try {
    await Team.findByIdAndUpdate(agentId, {
      $inc: { currentLoad: delta }
    });
  } catch (error) {
  }
}
module.exports = {
  findBestAgent,
  autoAssignConversation,
  checkAndReassign,
  updateAgentLoad
};
