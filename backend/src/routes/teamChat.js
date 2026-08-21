const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const TeamMessage = require('../models/TeamMessage');
const TeamChat = require('../models/TeamChat');
const Team = require('../models/Team');
const User = require('../models/User');
const { resolveChatParticipants, unreadTeamChatCount } = require('../db/queries');

// Bir kimliğin çağıranla AYNI organizasyonda olduğunu doğrular.
//
// Sohbet açma uçları gövdeden gelen id'ye koşulsuz güveniyordu: başka bir
// organizasyonun kullanıcı id'si gönderilerek onunla doğrudan sohbet
// açılabiliyordu. Kiracı sınırı artık yazma yolunda da kontrol ediliyor.
async function belongsToOrganization(id, orgId) {
  if (!id || !orgId) return false;
  const [asUser, asTeam] = await Promise.all([
    User.findOne({ _id: id, organizationId: orgId, isActive: true }),
    Team.findOne({ _id: id, organizationId: orgId, isActive: true })
  ]);
  return Boolean(asUser || asTeam);
}
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
    if (!targetUserId) {
      return res.status(400).json({ error: 'targetUserId is required', code: 'VALIDATION_ERROR' });
    }
    if (String(targetUserId) === String(req.user._id)) {
      return res.status(400).json({ error: 'Cannot open a chat with yourself', code: 'VALIDATION_ERROR' });
    }
    const orgId = req.organization?._id || req.user.organizationId;
    if (!(await belongsToOrganization(targetUserId, orgId))) {
      return res.status(404).json({ error: 'Team member not found', code: 'NOT_FOUND' });
    }
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
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
      return res.status(400).json({ error: 'participantIds must be a non-empty array', code: 'VALIDATION_ERROR' });
    }
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required', code: 'VALIDATION_ERROR' });
    }
    const orgId = req.organization?._id || req.user.organizationId;
    const checked = await Promise.all(
      participantIds.map(async (id) => ((await belongsToOrganization(id, orgId)) ? String(id) : null))
    );
    if (checked.some((id) => id === null)) {
      return res.status(404).json({ error: 'One or more members are not in your organization', code: 'NOT_FOUND' });
    }
    const allParticipants = [...new Set([req.user._id.toString(), ...checked])];
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

    // Sohbet mesajları yalnızca katılımcılara açıktır. Eski kod chatId'yi
    // doğrudan sorguya koyuyordu: id'yi bilen (veya tahmin eden) herkes
    // başkasının yazışmasını okuyabiliyordu.
    const chat = await TeamChat.findOne({ chatId });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found', code: 'NOT_FOUND' });
    }
    const isParticipant = (chat.participants || []).some((p) => String(p) === String(req.user._id));
    if (!isParticipant) {
      return res.status(403).json({ error: 'You are not a participant of this chat', code: 'FORBIDDEN' });
    }

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
    // Kiracı izolasyonu. Eski sorgu `Team.find({ isActive: true })` ve
    // `User.find({})` idi: filtre yoktu, yani ekip sohbeti üye seçicisi
    // SİSTEMDEKİ TÜM organizasyonların kullanıcılarını listeliyordu. Panelde
    // aynı ismin ("advisory owner") defalarca görünmesinin sebebi buydu —
    // farklı organizasyonlara ait ayrı kayıtlardı. Bu hem bir veri sızıntısı
    // hem de bir UI hatasıydı: yabancı bir kullanıcı seçilip ona doğrudan
    // mesaj açılabiliyordu.
    const orgId = req.organization?._id || req.user.organizationId;
    if (!orgId) {
      // Organizasyonu olmayan bir hesap yalnızca kendisini görür; boş liste
      // döndürmek "ekip yok" durumundan ayırt edilemezdi.
      return res.json([]);
    }

    const [teamMembers, users] = await Promise.all([
      Team.find({ isActive: true, organizationId: orgId })
        .select('name email avatar status role')
        .sort({ name: 1 })
        .lean(),
      User.find({ isActive: true, organizationId: orgId })
        .select('name email avatar status role')
        .sort({ name: 1 })
        .lean()
    ]);

    // Aynı kişi hem users hem teams tablosunda bulunabilir (sahip hesabı ekip
    // üyesi olarak da eklendiğinde). id bazlı tekilleştirme, seçicide çift
    // satır çıkmasını engeller.
    const seen = new Set();
    const members = [];
    for (const person of [...users, ...teamMembers]) {
      const key = String(person._id);
      if (seen.has(key)) continue;
      seen.add(key);
      // Kişinin kendisi listede olmamalı: kendine DM açmak anlamsız.
      if (key === String(req.user._id)) continue;
      members.push(person);
    }

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
