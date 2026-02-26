const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');
const events = require('../events');
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);
router.get('/unread-count', auth, async (req, res) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    if (!orgId) {
      return res.json({ totalUnreadCount: 0, unreadBySite: {} });
    }
    const conversations = await Conversation.find({
      organizationId: orgId,
      unreadCount: { $gt: 0 }
    }).select('siteId unreadCount');
    let totalUnreadCount = 0;
    const unreadBySite = {};
    for (const conversation of conversations) {
      const unreadCount = conversation.unreadCount || 0;
      if (unreadCount > 0) {
        totalUnreadCount += unreadCount;
        const siteIdStr = conversation.siteId.toString();
        if (!unreadBySite[siteIdStr]) {
          unreadBySite[siteIdStr] = 0;
        }
        unreadBySite[siteIdStr] += unreadCount;
      }
    }
    res.json({ 
      totalUnreadCount,
      unreadBySite
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/:siteId', auth, async (req, res) => {
  try {
    const { status } = req.query;
    const { siteId } = req.params;
    if (!isValidObjectId(siteId)) {
      return res.status(400).json({ error: 'Invalid site id' });
    }
    const orgId = req.organization?._id || req.user.organizationId;
    const Site = require('../models/Site');
    const site = await Site.findOne({
      _id: siteId,
      ...(orgId ? { organizationId: orgId } : {})
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    let filter = { 
      siteId,
      organizationId: orgId
    };
    if (status) {
      filter.status = status;
    }
    const conversations = await Conversation.find(filter)
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon')
      .sort({ lastMessageAt: -1 })
      .limit(50);
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        try {
          const lastMessage = await Message.findOne({ conversationId: conv._id })
            .sort({ createdAt: -1 })
            .limit(1);
          if (typeof conv.calculateSLA === 'function') {
            try {
              conv.calculateSLA();
            } catch (slaErr) {
            }
          }
          if (conv.organizationId) {
            await conv.save().catch(saveErr => {
            });
          } else {
          }
          return {
            ...conv.toObject(),
            lastMessage
          };
        } catch (innerErr) {
          return { ...conv.toObject(), lastMessage: null };
        }
      })
    );
    res.json({ conversations: conversationsWithLastMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/assigned/me', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const orgId = req.organization?._id || req.user.organizationId;
    const conversations = await Conversation.find({ 
      assignedAgent: userId,
      organizationId: orgId
    })
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon')
      .sort({ lastMessageAt: -1 })
      .limit(100);
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .limit(1);
        try {
          conv.calculateSLA();
        } catch (slaErr) {
        }
        if (conv.organizationId) {
          await conv.save().catch(() => {});
        } else {
        }
        return {
          ...conv.toObject(),
          lastMessage
        };
      })
    );
    res.json({ conversations: conversationsWithLastMessage });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/:siteId/:conversationId', auth, async (req, res) => {
  try {
    const { siteId, conversationId } = req.params;
    if (!isValidObjectId(siteId) || !isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid id parameter' });
    }
    const orgId = req.organization?._id || req.user.organizationId;
    const Site = require('../models/Site');
    const site = await Site.findOne({
      _id: siteId,
      ...(orgId ? { organizationId: orgId } : {})
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    const conversation = await Conversation.findOne({
      _id: conversationId,
      siteId,
      organizationId: orgId
    })
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    try {
      if (typeof conversation.calculateSLA === 'function') {
        conversation.calculateSLA();
      }
      await conversation.save();
    } catch (e) {
    }
    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 });
    await Message.updateMany(
      { 
        conversationId: conversation._id, 
        senderType: 'visitor',
        isRead: false 
      },
      { 
        isRead: true, 
        readAt: new Date() 
      }
    );
    conversation.unreadCount = 0;
    await conversation.save();
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`site:${siteId}`).emit('messages-read', {
        conversationId: conversation._id,
        siteId
      });
    }
    res.json({ conversation, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.put('/:conversationId/assign', auth, async (req, res) => {
  try {
    const { agentId, assignedBy } = req.body;
    const orgId = req.organization?._id || req.user.organizationId;
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (conversation.organizationId && conversation.organizationId.toString() !== orgId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    const oldAgentId = conversation.assignedAgent;
    const updateData = {
      assignedAgent: agentId || null,
      assignedBy: assignedBy || req.user.id,
      status: agentId ? 'assigned' : 'unassigned'
    };
    if (agentId) {
      updateData.assignedAt = new Date();
    } else {
      updateData.assignedAt = null;
    }
    const updatedConversation = await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      updateData,
      { new: true }
    )
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon');
    if (agentId) {
      const Team = require('../models/Team');
      const { updateAgentLoad } = require('../services/autoAssignment');
      if (oldAgentId) {
        await updateAgentLoad(oldAgentId, -1);
      }
      await updateAgentLoad(agentId, 1);
      await Team.findByIdAndUpdate(agentId, {
        $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
      }).catch(() => {});
    } else if (oldAgentId) {
      const { updateAgentLoad } = require('../services/autoAssignment');
      await updateAgentLoad(oldAgentId, -1);
    }
    const io = req.app.get('io');
    if (io) {
      if (agentId) {
        const Team = require('../models/Team');
        const User = require('../models/User');
        try {
          const team = await Team.findById(agentId).select('_id');
          if (team) {
            io.of('/admin').to(`user:${agentId}`).emit('conversation-assigned', {
              conversationId: conversation._id,
              agentId,
              assignedBy,
              siteId: conversation.siteId
            });
          } else {
            const userDoc = await User.findById(agentId).select('_id');
            if (userDoc) {
              io.of('/admin').to(`user:${agentId}`).emit('conversation-assigned', {
                conversationId: conversation._id,
                agentId,
                assignedBy,
                siteId: conversation.siteId
              });
            } else {
              io.of('/admin').to(`user:${agentId}`).emit('conversation-assigned', {
                conversationId: conversation._id,
                agentId,
                assignedBy,
                siteId: conversation.siteId
              });
            }
          }
        } catch (e) {
          io.of('/admin').to(`user:${agentId}`).emit('conversation-assigned', {
            conversationId: conversation._id,
            agentId,
            assignedBy,
            siteId: conversation.siteId
          });
        }
      }
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
        conversationId: conversation._id,
        conversation: conversation.toObject()
      });
      try {
      } catch (e) {}
    }
    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.put('/:conversationId/claim', auth, async (req, res) => {
  try {
    const agentId = req.userId || req.user._id;
    const orgId = req.organization?._id || req.user.organizationId;
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    const conversation = await Conversation.findOne({
      _id: conversationId,
      organizationId: orgId
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (conversation.assignedAgent) {
      return res.status(400).json({ error: 'Conversation is already assigned' });
    }
    const Team = require('../models/Team');
    const agent = await Team.findById(agentId);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    if (agent.status !== 'online') {
      return res.status(400).json({ error: 'Agent must be online to claim conversations' });
    }
    const currentLoad = agent.currentLoad || 0;
    const maxCapacity = agent.maxCapacity || 10;
    if (currentLoad >= maxCapacity) {
      return res.status(400).json({ error: 'Agent has reached maximum capacity' });
    }
    conversation.assignedAgent = agentId;
    conversation.assignedBy = agentId;
    conversation.assignedAt = new Date();
    conversation.status = 'assigned';
    await conversation.save();
    await conversation.populate('assignedAgent', 'name avatar status');
    await conversation.populate('department', 'name color icon');
    const { updateAgentLoad } = require('../services/autoAssignment');
    await updateAgentLoad(agentId, 1);
    await Team.findByIdAndUpdate(agentId, {
      $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
    }).catch(() => {});
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`user:${agentId}`).emit('conversation-claimed', {
        conversationId: conversation._id,
        agentId
      });
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
        conversationId: conversation._id,
        conversation: conversation.toObject()
      });
      try {
      } catch (e) {}
    }
    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.put('/:conversationId/department', auth, async (req, res) => {
  try {
    const { departmentId } = req.body;
    const orgId = req.organization?._id || req.user.organizationId;
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    const conversation = await Conversation.findOne({
      _id: conversationId,
      organizationId: orgId
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    const updatedConversation = await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      { department: departmentId || null },
      { new: true }
    )
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon');
    if (departmentId) {
      await require('../models/Department').findByIdAndUpdate(departmentId, {
        $inc: { 'stats.totalConversations': 1, 'stats.activeConversations': 1 }
      });
    }
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-department-changed', {
        conversationId: conversation._id,
        departmentId
      });
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
        conversationId: conversation._id,
        conversation: conversation.toObject()
      });
    }
    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.put('/:conversationId/priority', auth, async (req, res) => {
  try {
    const { priority } = req.body;
    const orgId = req.organization?._id || req.user.organizationId;
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    const conversation = await Conversation.findOne({
      _id: conversationId,
      organizationId: orgId
    })
      .populate('department');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    conversation.priority = priority;
    const slaTargets = {
      urgent: { firstResponse: 5, resolution: 60 },
      high: { firstResponse: 10, resolution: 120 },
      normal: { firstResponse: 15, resolution: 240 },
      low: { firstResponse: 30, resolution: 480 }
    };
    if (conversation.department && conversation.department.sla && conversation.department.sla.enabled) {
      conversation.sla.firstResponseTarget = conversation.department.sla.firstResponse?.[priority] || slaTargets[priority].firstResponse;
      conversation.sla.resolutionTarget = conversation.department.sla.resolution?.[priority] || slaTargets[priority].resolution;
    } else {
      conversation.sla.firstResponseTarget = slaTargets[priority].firstResponse;
      conversation.sla.resolutionTarget = slaTargets[priority].resolution;
    }
    try {
      conversation.calculateSLA();
    } catch (slaErr) {
    }
    await conversation.save();
    await conversation.populate('assignedAgent', 'name avatar status');
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
        conversationId: conversation._id,
        conversation
      });
    }
    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.post('/:conversationId/notes', auth, async (req, res) => {
  try {
    const { note } = req.body;
    const orgId = req.organization?._id || req.user.organizationId;
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    const conversation = await Conversation.findOne({
      _id: conversationId,
      organizationId: orgId
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    conversation.internalNotes.push({
      userId: req.user.id,
      note,
      createdAt: new Date()
    });
    await conversation.save();
    await conversation.populate('internalNotes.userId', 'name avatar');
    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.put('/:conversationId/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const orgId = req.organization?._id || req.user.organizationId;
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    const conversation = await Conversation.findOne({
      _id: conversationId,
      organizationId: orgId
    })
      .populate('department');
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if ((status === 'resolved' || status === 'closed') && conversation.assignedAgent) {
      const { updateAgentLoad } = require('../services/autoAssignment');
      await updateAgentLoad(conversation.assignedAgent, -1);
    }
    const previousStatus = conversation.status;
    conversation.status = status;
    if (status === 'closed') {
      conversation.closedAt = new Date();
      try {
        events.emit('ticket.closed', {
          organizationId: orgId,
          userId: req.user ? req.user._id : null,
          entityId: conversation._id,
          metadata: { previousStatus },
          ip: req.ip,
          ua: req.get('user-agent')
        });
      } catch (e) {  }
    } else if (status === 'resolved') {
      conversation.resolvedAt = new Date();
      try {
        conversation.calculateSLA();
      } catch (slaErr) {
      }
      if (conversation.department) {
        const dept = await require('../models/Department').findById(conversation.department._id);
        if (dept) {
          dept.stats.activeConversations = Math.max(0, dept.stats.activeConversations - 1);
          if (conversation.sla.firstResponseStatus === 'met') {
            dept.stats.slaMetrics.firstResponseMet++;
          } else if (conversation.sla.firstResponseStatus === 'breached') {
            dept.stats.slaMetrics.firstResponseBreached++;
          }
          if (conversation.sla.resolutionStatus === 'met') {
            dept.stats.slaMetrics.resolutionMet++;
          } else if (conversation.sla.resolutionStatus === 'breached') {
            dept.stats.slaMetrics.resolutionBreached++;
          }
          if (conversation.responseTime) {
            const total = dept.stats.slaMetrics.firstResponseMet + dept.stats.slaMetrics.firstResponseBreached;
            const currentAvg = dept.stats.slaMetrics.averageFirstResponseTime || 0;
            dept.stats.slaMetrics.averageFirstResponseTime = ((currentAvg * (total - 1)) + conversation.responseTime) / total;
          }
          if (conversation.resolutionTime) {
            const total = dept.stats.slaMetrics.resolutionMet + dept.stats.slaMetrics.resolutionBreached;
            const currentAvg = dept.stats.slaMetrics.averageResolutionTime || 0;
            dept.stats.slaMetrics.averageResolutionTime = ((currentAvg * (total - 1)) + conversation.resolutionTime) / total;
          }
          await dept.save();
        }
      }
      if (conversation.assignedAgent) {
        await require('../models/Team').findByIdAndUpdate(conversation.assignedAgent, {
          $inc: { 
            'stats.activeConversations': -1,
            'stats.resolvedConversations': 1
          }
        });
      }
    }
    await conversation.save();
    await conversation.populate('assignedAgent', 'name avatar status');
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
        conversationId: conversation._id,
        conversation
      });
      if (status === 'resolved') {
        io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-resolved', {
          conversationId: conversation._id,
          conversation
        });
      }
      if (previousStatus === 'closed' && status !== 'closed') {
        try {
          events.emit('ticket.reopened', {
            organizationId: orgId,
            userId: req.user ? req.user._id : null,
            entityId: conversation._id,
            metadata: { previousStatus },
            ip: req.ip,
            ua: req.get('user-agent')
          });
        } catch (e) {  }
      }
    }
    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.delete('/:siteId/:conversationId', auth, async (req, res) => {
  try {
    const { siteId, conversationId } = req.params;
    const orgId = req.organization?._id || req.user.organizationId;
    if (!isValidObjectId(siteId) || !isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid id parameter' });
    }
    const conversation = await Conversation.findOne({
      _id: conversationId,
      siteId: siteId,
      organizationId: orgId
    });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (conversation.assignedAgent) {
      const { updateAgentLoad } = require('../services/autoAssignment');
      await updateAgentLoad(conversation.assignedAgent, -1);
    }
    await Message.deleteMany({ conversationId: conversationId });
    await Conversation.findByIdAndDelete(conversationId);
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`site:${siteId}`).emit('stats-update', {
        type: 'conversation-deleted',
        siteId,
        conversationId
      });
    }
    res.json({ message: 'Conversation deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
