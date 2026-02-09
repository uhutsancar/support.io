const express = require('express');
const router = express.Router();
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const { auth } = require('../middleware/auth');

// Get all conversations for a site
router.get('/:siteId', auth, async (req, res) => {
  try {
    const { status } = req.query;
    
    let filter = { siteId: req.params.siteId };
    if (status) {
      filter.status = status;
    }

    const conversations = await Conversation.find(filter)
      .populate('assignedAgent', 'name avatar status')
      .sort({ lastMessageAt: -1 })
      .limit(50);

    // Get last message for each conversation
    const conversationsWithLastMessage = await Promise.all(
      conversations.map(async (conv) => {
        const lastMessage = await Message.findOne({ conversationId: conv._id })
          .sort({ createdAt: -1 })
          .limit(1);
        
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

// Get single conversation with messages
router.get('/:siteId/:conversationId', auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      siteId: req.params.siteId
    }).populate('assignedAgent', 'name avatar status');

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    const messages = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: 1 });

    res.json({ conversation, messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign conversation to agent
router.put('/:conversationId/assign', auth, async (req, res) => {
  try {
    const { agentId } = req.body;
    
    const conversation = await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      { 
        assignedAgent: agentId || null,
        status: agentId ? 'assigned' : 'open'
      },
      { new: true }
    ).populate('assignedAgent', 'name avatar status');

    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Update conversation status
router.put('/:conversationId/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    const updateData = { status };
    if (status === 'closed' || status === 'resolved') {
      updateData.closedAt = new Date();
    }

    const conversation = await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      updateData,
      { new: true }
    ).populate('assignedAgent', 'name avatar status');

    res.json({ conversation });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
