const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const TeamMessage = require('../models/TeamMessage');
const TeamChat = require('../models/TeamChat');
const Team = require('../models/Team');
const User = require('../models/User');
router.get('/chats', auth, async (req, res) => {
  try {
    const chats = await TeamChat.find({ participants: req.user._id }).lean();
    
    // Manually populate participants from both User and Team models
    for (const chat of chats) {
      chat.participants = await Promise.all(chat.participants.map(async pId => {
        let p = await Team.findById(pId).select('name email avatar status role').lean();
        if (!p) p = await User.findById(pId).select('name email avatar status role').lean();
        return p || { _id: pId, name: 'Unknown', role: 'unknown' };
      }));
    }
    
    chats.sort((a, b) => new Date(b.lastMessage?.createdAt || b.updatedAt) - new Date(a.lastMessage?.createdAt || a.updatedAt));
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/chats/direct', auth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    const chatId = [req.user._id, targetUserId].sort().join('_');
    let chat = await TeamChat.findOne({ chatId }).lean();
    if (!chat) {
      const newChat = new TeamChat({
        chatId,
        chatType: 'direct',
        participants: [req.user._id, targetUserId],
        createdBy: req.user._id
      });
      await newChat.save();
      chat = newChat.toObject();
    }
    
    // Manually populate
    chat.participants = await Promise.all(chat.participants.map(async pId => {
      let p = await Team.findById(pId).select('name email avatar status role').lean();
      if (!p) p = await User.findById(pId).select('name email avatar status role').lean();
      return p || { _id: pId, name: 'Unknown', role: 'unknown' };
    }));
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
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
    
    const populated = chat.toObject();
    populated.participants = await Promise.all(populated.participants.map(async pId => {
      let p = await Team.findById(pId).select('name email avatar status role').lean();
      if (!p) p = await User.findById(pId).select('name email avatar status role').lean();
      return p || { _id: pId, name: 'Unknown', role: 'unknown' };
    }));
    res.json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
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
    await TeamMessage.updateMany(
      { chatId, readBy: { $ne: req.user._id } },
      { $addToSet: { readBy: req.user._id } }
    );
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/members', auth, async (req, res) => {
  try {
    const teamMembers = await Team.find({ isActive: true })
      .select('name email avatar status role')
      .sort({ name: 1 }).lean();
      
    const users = await User.find({})
      .select('name email avatar status role')
      .sort({ name: 1 }).lean();
      
    // Combine and send back
    const members = [...users, ...teamMembers];
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
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
