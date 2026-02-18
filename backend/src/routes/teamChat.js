const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const TeamMessage = require('../models/TeamMessage');
const TeamChat = require('../models/TeamChat');
const Team = require('../models/Team');

// Get all chats for current user
router.get('/chats', auth, async (req, res) => {
  try {
    const chats = await TeamChat.find({ participants: req.user._id })
      .populate('participants', 'name email avatar status role')
      .sort({ updatedAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create or get direct chat
router.post('/chats/direct', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const chatId = [req.user._id, targetUserId].sort().join('_');

    let chat = await TeamChat.findOne({ chatId })
      .populate('participants', 'name email avatar status role');

    if (!chat) {
      chat = new TeamChat({
        chatId,
        chatType: 'direct',
        participants: [req.user._id, targetUserId],
        createdBy: req.user._id
      });
      await chat.save();
      chat = await chat.populate('participants', 'name email avatar status role');
    }

    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create group chat
router.post('/chats/group', auth, async (req, res) => {
  try {
    const { name, participantIds } = req.body;
    const allParticipants = [...new Set([req.user._id.toString(), ...participantIds])];

    const chat = new TeamChat({
      chatId: `group_${Date.now()}_${req.user._id}`,
      chatType: 'group',
      participants: allParticipants,
      groupName: name,
      createdBy: req.user._id
    });
    await chat.save();

    const populated = await chat.populate('participants', 'name email avatar status role');
    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a chat
router.get('/chats/:chatId/messages', auth, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { limit = 50, before } = req.query;

    const query = { chatId };
    if (before) {
      query.createdAt = { $lt: new Date(before) };
    }

    const messages = await TeamMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    // Mark messages as read
    await TeamMessage.updateMany(
      { chatId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get team members (for starting new chats)
router.get('/members', auth, async (req, res) => {
  try {
    const members = await Team.find({ isActive: true })
      .select('name email avatar status role')
      .sort({ name: 1 });
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unread count for team chat
router.get('/unread', auth, async (req, res) => {
  try {
    const chats = await TeamChat.find({ participants: req.user._id });
    let total = 0;
    for (const chat of chats) {
      const count = await TeamMessage.countDocuments({
        chatId: chat.chatId,
        senderId: { $ne: req.user._id },
        readBy: { $ne: req.user._id }
      });
      total += count;
    }
    res.json({ unreadCount: total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
