const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const TeamMessage = require('../models/TeamMessage');
const TeamChat = require('../models/TeamChat');
const Team = require('../models/Team');
const User = require('../models/User');
const { resolveChatParticipants, unreadTeamChatCount } = require('../db/queries');
router.get('/chats', auth, async (req, res) => {
  try {
    const chats = await TeamChat.find({ participants: req.user._id }).lean();

    // Both participant tables are read once for the whole list.
    const people = await resolveChatParticipants(chats.flatMap((chat) => chat.participants));
    for (const chat of chats) {
      chat.participants = chat.participants.map(
        (pId) => people.get(pId) || { _id: pId, name: 'Unknown', role: 'unknown' }
      );
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

    const people = await resolveChatParticipants(chat.participants);
    chat.participants = chat.participants.map(
      (pId) => people.get(pId) || { _id: pId, name: 'Unknown', role: 'unknown' }
    );
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
    const people = await resolveChatParticipants(populated.participants);
    populated.participants = populated.participants.map(
      (pId) => people.get(pId) || { _id: pId, name: 'Unknown', role: 'unknown' }
    );
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
    // Counted across every chat the user belongs to in one query.
    const total = await unreadTeamChatCount(req.user._id);
    res.json({ unreadCount: total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
