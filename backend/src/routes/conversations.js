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

// Return conversations assigned to the current authenticated user/team across sites
router.get('/assigned/me', auth, async (req, res) => {
  try {
    const userId = req.userId;
    const conversations = await Conversation.find({ assignedAgent: userId })
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon')
      .sort({ lastMessageAt: -1 })
      .limit(100);

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
      io.of('/admin').to(`site:${req.params.siteId}`).emit('messages-read', {
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
      // Determine whether agentId references a Team (team member) or a User
      const Team = require('../models/Team');
      const User = require('../models/User');
      try {
        const team = await Team.findById(agentId).select('_id');
        if (team) {
          await Team.findByIdAndUpdate(agentId, {
            $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
          }).catch(() => {});
        } else {
          const userDoc = await User.findById(agentId).select('_id');
          if (userDoc) {
            await User.findByIdAndUpdate(agentId, {
              $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('Assign stats update error:', e.message);
      }
    }
    
    const io = req.app.get('io');
    if (io) {
      // Notify the assigned agent directly and admins in the site room
      if (agentId) {
        // Emit to the assigned party's personal room. If agentId maps to a team member, emit to that team id.
        // If agentId maps to a User document, emit to that user's personal room as well.
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
            console.log(`[EMIT] conversation-assigned -> user:${agentId} (team)`);
          } else {
            const userDoc = await User.findById(agentId).select('_id');
            if (userDoc) {
              io.of('/admin').to(`user:${agentId}`).emit('conversation-assigned', {
                conversationId: conversation._id,
                agentId,
                assignedBy,
                siteId: conversation.siteId
              });
              console.log(`[EMIT] conversation-assigned -> user:${agentId} (user)`);
            } else {
              // Fallback: still emit to user:<agentId> to avoid silent failures
              io.of('/admin').to(`user:${agentId}`).emit('conversation-assigned', {
                conversationId: conversation._id,
                agentId,
                assignedBy,
                siteId: conversation.siteId
              });
              console.log(`[EMIT] conversation-assigned -> user:${agentId} (fallback)`);
            }
          }
        } catch (e) {
          console.error('Emit conversation-assigned error:', e.message);
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
        console.log(`[EMIT] conversation-assigned -> user:${agentId}`);
        console.log(`[EMIT] conversation-update -> site:${conversation.siteId}`);
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

    const conversation = await Conversation.findById(req.params.conversationId);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    if (conversation.assignedAgent) {
      return res.status(400).json({ error: 'Conversation is already assigned' });
    }

    // Determine whether the requester is a Team member or a User
    const isTeam = req.userType === 'team' || (req.user && req.user.email && req.user.role && req.user.name && req.user.permissions);

    // Check active conversation limits. For Team members we use team.stats, for Users we fall back to user.preferences if available
    if (isTeam) {
      const Team = require('../models/Team');
      const agent = await Team.findById(agentId);
      const maxActive = process.env.MAX_ACTIVE_CONVERSATIONS ? parseInt(process.env.MAX_ACTIVE_CONVERSATIONS, 10) : 50;
      if (agent && agent.stats && agent.stats.activeConversations >= maxActive) {
        return res.status(400).json({ error: 'Agent has reached maximum active conversations' });
      }
    } else {
      const User = require('../models/User');
      const agent = await User.findById(agentId);
      const maxActive = agent?.preferences?.maxActiveConversations || parseInt(process.env.MAX_ACTIVE_CONVERSATIONS || '50', 10);
      if (agent && agent.stats && agent.stats.activeConversations >= maxActive) {
        return res.status(400).json({ error: 'Agent has reached maximum active conversations' });
      }
    }

    conversation.assignedAgent = agentId;
    conversation.assignedBy = agentId;
    conversation.assignedAt = new Date();
    conversation.status = 'assigned';

    await conversation.save();
    await conversation.populate('assignedAgent', 'name avatar status');
    await conversation.populate('department', 'name color icon');

    // Increment stats on the proper model
    if (isTeam) {
      await require('../models/Team').findByIdAndUpdate(agentId, {
        $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
      }).catch(() => {});
    } else {
      await require('../models/User').findByIdAndUpdate(agentId, {
        $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
      }).catch(() => {});
    }

    const io = req.app.get('io');
    if (io) {
      // Emit to the user's personal room and to the site room so admins see the update
      io.of('/admin').to(`user:${agentId}`).emit('conversation-claimed', {
        conversationId: conversation._id,
        agentId
      });
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
        conversationId: conversation._id,
        conversation: conversation.toObject()
      });
      // helpful server-side logging for debugging
      try {
        console.log(`[EMIT] conversation-claimed -> user:${agentId}`);
        console.log(`[EMIT] conversation-update -> site:${conversation.siteId}`);
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
