const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');

router.get('/unread-count', auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({});
    
    let totalUnreadCount = 0;
    const unreadBySite = {};

    for (const conversation of conversations) {
      const unreadCount = await Message.countDocuments({
        conversationId: conversation._id,
        senderType: 'visitor',
        isRead: false
      });
      
      if (unreadCount > 0) {
        totalUnreadCount += unreadCount;
        if (!unreadBySite[conversation.siteId]) {
          unreadBySite[conversation.siteId] = 0;
        }
        unreadBySite[conversation.siteId] += unreadCount;
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
    
    let filter = { siteId: req.params.siteId };
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
        const lastMessage = await Message.findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .limit(1);
        
        conv.calculateSLA();
        await conv.save();
        
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
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      siteId: req.params.siteId
    })
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    conversation.calculateSLA();
    await conversation.save();

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

    const io = req.app.get('io');
    if (io) {
      io.of('/admin').emit('messages-read', {
        conversationId: conversation._id,
        siteId: req.params.siteId
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
    
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      updateData,
      { new: true }
    )
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon');
    if (agentId) {
      await require('../models/User').findByIdAndUpdate(agentId, {
        $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
      });
    }
    
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').emit('conversation-assigned', {
        conversationId: conversation._id,
        agentId,
        assignedBy
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

router.put('/:conversationId/claim', auth, async (req, res) => {
  try {
    const agentId = req.user.id;
    
    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (conversation.assignedAgent) {
      return res.status(400).json({ error: 'Conversation is already assigned' });
    }
    const agent = await require('../models/User').findById(agentId);
    if (agent.stats.activeConversations >= agent.preferences.maxActiveConversations) {
      return res.status(400).json({ error: 'Agent has reached maximum active conversations' });
    }
    
    conversation.assignedAgent = agentId;
    conversation.assignedBy = agentId;
    conversation.assignedAt = new Date();
    conversation.status = 'assigned';
    
    await conversation.save();
    await conversation.populate('assignedAgent', 'name avatar status');
    await conversation.populate('department', 'name color icon');
    
    await require('../models/User').findByIdAndUpdate(agentId, {
      $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
    });
    
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').emit('conversation-claimed', {
        conversationId: conversation._id,
        agentId
      });
    }

    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:conversationId/department', auth, async (req, res) => {
  try {
    const { departmentId } = req.body;
    
    const conversation = await Conversation.findByIdAndUpdate(
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
      io.of('/admin').emit('conversation-department-changed', {
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
    
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }
    
    const conversation = await Conversation.findById(req.params.conversationId)
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
    

    conversation.calculateSLA();
    
    await conversation.save();
    await conversation.populate('assignedAgent', 'name avatar status');

    const io = req.app.get('io');
    if (io) {
      io.of('/admin').emit('conversation-update', {
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
    
    const conversation = await Conversation.findById(req.params.conversationId);
    
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
    
    const conversation = await Conversation.findById(req.params.conversationId)
      .populate('department');
    
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    conversation.status = status;
    
    if (status === 'closed') {
      conversation.closedAt = new Date();
    } else if (status === 'resolved') {
      conversation.resolvedAt = new Date();
      
      conversation.calculateSLA();
      
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
        await require('../models/User').findByIdAndUpdate(conversation.assignedAgent, {
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
      io.of('/admin').emit('conversation-update', {
        conversationId: conversation._id,
        conversation
      });
      
      if (status === 'resolved') {
        io.of('/admin').emit('conversation-resolved', {
          conversationId: conversation._id,
          conversation
        });
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

    const conversation = await Conversation.findOne({
      _id: conversationId,
      siteId: siteId
    });

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    await Message.deleteMany({ conversationId: conversationId });
    
    await Conversation.findByIdAndDelete(conversationId);

    const io = req.app.get('io');
    if (io) {
      io.of('/admin').emit('stats-update', {
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
