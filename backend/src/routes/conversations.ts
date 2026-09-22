import express from 'express';
import { sendError } from '../middleware/errors';
import { requireOrgId } from '../middleware/siteAuth';
import { checkPermission, hasPermission } from '../middleware/rbac';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { auth } from '../middleware/auth';
import events from '../events';
import { isValidObjectId } from '../db/objectId';
import { latestMessagesByConversation, unreadCountsByOrganization } from '../db/queries';
import { listConversations, conversationCounts, messageMatchesForSearch } from '../db/inboxQueries';
import Team from '../models/Team';
import User from '../models/User';
import Site from '../models/Site';
import { updateAgentLoad } from '../services/autoAssignment';
import Department from '../models/Department';
import type { Request, Response } from 'express';
import type { UpdateSpec } from '../db/model';
import type { InboxScope } from '../db/inboxQueries';

const router = express.Router();

async function findOrganizationAgentWithModel(agentId: unknown, organizationId: unknown, siteId?: unknown) {
  if (!agentId) return null;
  const teamAgent = await Team.findOne({ _id: agentId, organizationId, isActive: true });
  const userAgent = teamAgent
    ? null
    : await User.findOne({ _id: agentId, organizationId, isActive: true });
  const agent = teamAgent || userAgent;
  if (!agent) return null;
  const assignedSites = (agent.assignedSites || []).map(String);
  if (assignedSites.length > 0 && !assignedSites.includes(String(siteId))) return null;
  return { agent, Model: teamAgent ? Team : User };
}
router.get('/unread-count', auth, async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    // Summed by the database rather than by loading every conversation.
    const { totalUnreadCount, unreadBySite } = await unreadCountsByOrganization(orgId);
    res.json({
      totalUnreadCount,
      unreadBySite
    });
  } catch (error) {
    sendError(res, error);
  }
});
router.get('/:siteId', auth, async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    if (!isValidObjectId(siteId)) {
      return res.status(400).json({ error: 'Invalid site id' });
    }
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({
      _id: siteId,
      organizationId: orgId
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    // Arama ve filtreler veritabaninda uygulanir. Panel bunlari tarayicida
    // yapiyordu ve yalnizca yuklenmis olan sayfayi tariyordu; ayrintili
    // gerekce icin db/inboxQueries.js.
    const search = typeof req.query.search === 'string'
      ? req.query.search.trim().slice(0, 120)
      : '';
    const departmentId = typeof req.query.departmentId === 'string' ? req.query.departmentId : null;
    if (departmentId && departmentId !== 'none' && !isValidObjectId(departmentId)) {
      return res.status(400).json({ error: 'Invalid department id' });
    }
    const assignedAgentId = typeof req.query.assignedTo === 'string' && req.query.assignedTo !== 'unassigned'
      ? req.query.assignedTo
      : null;
    if (assignedAgentId && !isValidObjectId(assignedAgentId)) {
      return res.status(400).json({ error: 'Invalid agent id' });
    }

    // Mesaj icerigi eslesmeleri bir kez cozulur ve hem sayfa hem sayimlar
    // ayni listeyi kullanir; iki kez aramak ayni isi tekrarlardi.
    const searchMessageMatches = search ? await messageMatchesForSearch(siteId, search) : [];

    const filters: InboxScope = {
      organizationId: orgId,
      siteId,
      status: typeof req.query.status === 'string' ? req.query.status : null,
      priority: typeof req.query.priority === 'string' ? req.query.priority : null,
      departmentId,
      assignedAgentId,
      unassigned: req.query.assignedTo === 'unassigned',
      search,
      searchMessageMatches
    };

    const [page, counts] = await Promise.all([
      listConversations({
        ...filters,
        limit: typeof req.query.limit === 'string' ? req.query.limit : undefined,
        cursor: typeof req.query.cursor === 'string' ? req.query.cursor : null
      }),
      // Sayimlar yalnizca ilk sayfada gerekir; sonraki sayfalarda serit
      // basliklari zaten ekranda ve yeniden saymak bosa is olur.
      req.query.cursor ? Promise.resolve(null) : conversationCounts(filters)
    ]);

    // Satirlar ham SQL'den gelir; modelin hydrate'i onlari panelin bekledigi
    // bicime cevirir (SLA hesabi ve toObject dahil).
    const conversations = page.rows.map((row) => Conversation.$model.hydrate(row));
    await Conversation.$model.populateDocuments(conversations, [
      { path: 'assignedAgent', select: 'name avatar status' },
      { path: 'department', select: 'name color icon' }
    ]);

    const lastMessages = await latestMessagesByConversation(conversations.map((c) => c._id));
    const conversationsWithLastMessage = conversations.map((conv) => {
      try {
        if (typeof conv.calculateSLA === 'function') conv.calculateSLA();
      } catch (slaErr) {
        // Bozuk SLA verisi listeyi engellememeli.
      }
      return {
        ...conv.toObject(),
        lastMessage: lastMessages.get(conv._id) || null
      };
    });

    res.json({
      conversations: conversationsWithLastMessage,
      hasMore: page.hasMore,
      nextCursor: page.nextCursor,
      ...(counts ? { counts } : {})
    });
  } catch (error) {
    sendError(res, error);
  }
});
router.get('/assigned/me', auth, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const conversations = await Conversation.find({
      assignedAgent: userId,
      organizationId: orgId
    })
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon')
      .sort({ lastMessageAt: -1 })
      .limit(100);
    const lastMessages = await latestMessagesByConversation(conversations.map((c) => c._id));
    // Burada da yazma yok; bkz. yukaridaki aciklama.
    const conversationsWithLastMessage = conversations.map((conv) => {
      try {
        conv.calculateSLA();
      } catch (slaErr) {
      }
      return {
        ...conv.toObject(),
        lastMessage: lastMessages.get(conv._id) || null
      };
    });
    res.json({ conversations: conversationsWithLastMessage });
  } catch (error) {
    sendError(res, error);
  }
});
router.get('/:siteId/:conversationId', auth, async (req: Request, res: Response) => {
  try {
    const { siteId, conversationId } = req.params;
    if (!isValidObjectId(siteId) || !isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid id parameter' });
    }
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({
      _id: siteId,
      organizationId: orgId
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
    // Mesaj gecmisi sinirlandirilir: uzun suren bir destek konusmasi binlerce
    // mesaja ulasabilir ve hepsini her acilista cekmek hem sunucuyu hem
    // tarayiciyi kilitler. En yeniler alinip kronolojik siraya cevrilir.
    const limit = Math.min(parseInt(String(req.query.limit), 10) || 100, 200);
    const newestFirst = await Message.find({ conversationId: conversation._id })
      .sort({ createdAt: -1 })
      .limit(limit + 1);

    const hasMore = newestFirst.length > limit;
    const messages = newestFirst.slice(0, limit).reverse();
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
    // hasMore: istemci daha eski mesajlari isteyebilsin diye bildirilir.
    res.json({ conversation, messages, hasMore });
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/:conversationId/assign', auth, async (req: Request, res: Response) => {
  try {
    const { agentId } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const { conversationId } = req.params;
    if (!isValidObjectId(conversationId)) {
      return res.status(400).json({ error: 'Invalid conversation id' });
    }
    // Org filtresi sorgunun içinde; yüklendikten sonra karşılaştırmak boş
    // organizationId'de kontrolü atlıyordu.
    const conversation = await Conversation.findOne({ _id: conversationId, organizationId: orgId });
    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    // Başkasına atamak ya da başkasının konuşmasını almak `assign_tickets`
    // ister (owner/admin/manager). Bu izni olmayan bir temsilci yalnızca
    // atanmamış bir konuşmayı kendine alabilir ya da kendi konuşmasını
    // bırakabilir; iş arkadaşının konuşmasını kapamaz, ona iş yükleyemez.
    if (!hasPermission(req.user.role, 'assign_tickets')) {
      const self = String(req.userId);
      const current = conversation.assignedAgent ? String(conversation.assignedAgent) : null;
      const takingUnassigned = !current && agentId && String(agentId) === self;
      const releasingOwn = current === self && !agentId;
      if (!takingUnassigned && !releasingOwn) {
        return res.status(403).json({ error: 'You cannot reassign this conversation', code: 'FORBIDDEN' });
      }
    }
    const target = agentId
      ? await findOrganizationAgentWithModel(agentId, orgId, conversation.siteId)
      : null;
    if (agentId && !target) return res.status(404).json({ error: 'Agent not found' });
    const oldAgentId = conversation.assignedAgent;
    const updateData: UpdateSpec = {
      assignedAgent: agentId || null,
      assignedBy: req.userId,
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
    const assignmentChanged = String(oldAgentId || '') !== String(agentId || '');
    if (agentId && assignmentChanged) {
      if (oldAgentId) {
        await updateAgentLoad(oldAgentId, -1);
      }
      await updateAgentLoad(agentId, 1);
      await target!.Model.findOneAndUpdate(
        { _id: agentId, organizationId: orgId },
        {
        $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
        }
      ).catch(() => {});
    } else if (!agentId && oldAgentId && assignmentChanged) {
      await updateAgentLoad(oldAgentId, -1);
    }
    const io = req.app.get('io');
    if (io) {
      if (agentId) {
        io.of('/admin').to(`user:${agentId}`).emit('conversation-assigned', {
          conversationId: conversation._id,
          agentId,
          assignedBy: req.userId,
          siteId: conversation.siteId
        });
      }
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
        conversationId: conversation._id,
        conversation: updatedConversation!.toObject()
      });
      try {
      } catch (e) {}
    }
    res.json({ conversation: updatedConversation });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.put('/:conversationId/claim', auth, async (req: Request, res: Response) => {
  try {
    const agentId = req.userId || req.user._id;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
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
    const target = await findOrganizationAgentWithModel(agentId, orgId, conversation.siteId);
    if (!target) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    const { agent, Model: AgentModel } = target;
    if (agent.status !== 'online') {
      return res.status(400).json({ error: 'Agent must be online to claim conversations' });
    }
    // Only a Team row carries the load counters; a User account falls back to
    // the same defaults the check used before.
    const currentLoad = ('currentLoad' in agent ? agent.currentLoad : undefined) || 0;
    const maxCapacity = ('maxCapacity' in agent ? agent.maxCapacity : undefined) || 10;
    if (currentLoad >= maxCapacity) {
      return res.status(400).json({ error: 'Agent has reached maximum capacity' });
    }
    // The ownership check and assignment happen in one UPDATE so two agents
    // cannot claim the same conversation at the same time.
    const claimedConversation = await Conversation.findOneAndUpdate(
      {
        _id: conversationId,
        organizationId: orgId,
        assignedAgent: null,
        status: { $in: ['open', 'unassigned', 'pending'] }
      },
      {
        assignedAgent: agentId,
        assignedBy: agentId,
        assignedAt: new Date(),
        status: 'assigned'
      },
      { new: true }
    )
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon');
    if (!claimedConversation) {
      return res.status(409).json({ error: 'Conversation was claimed by another agent' });
    }
    await updateAgentLoad(agentId, 1);
    await AgentModel.findOneAndUpdate({ _id: agentId, organizationId: orgId }, {
      $inc: { 'stats.activeConversations': 1, 'stats.totalConversations': 1 }
    }).catch(() => {});
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`user:${agentId}`).emit('conversation-claimed', {
        conversationId: claimedConversation._id,
        agentId
      });
      io.of('/admin').to(`site:${claimedConversation.siteId}`).emit('conversation-update', {
        conversationId: claimedConversation._id,
        conversation: claimedConversation.toObject()
      });
      try {
      } catch (e) {}
    }
    res.json({ conversation: claimedConversation });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.put('/:conversationId/department', auth, async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
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
    if (departmentId) {
      const department = await Department.findOne({
        _id: departmentId,
        siteId: conversation.siteId,
        isActive: true
      });
      if (!department) return res.status(404).json({ error: 'Department not found' });
    }
    const previousDepartmentId = conversation.department;
    const updatedConversation = await Conversation.findByIdAndUpdate(
      req.params.conversationId,
      { department: departmentId || null },
      { new: true }
    )
      .populate('assignedAgent', 'name avatar status')
      .populate('department', 'name color icon');
    const departmentChanged = String(previousDepartmentId || '') !== String(departmentId || '');
    const isActiveConversation = ['open', 'assigned', 'pending', 'unassigned'].includes(conversation.status);
    if (departmentChanged && departmentId) {
      await Department.findByIdAndUpdate(departmentId, {
        $inc: {
          'stats.totalConversations': 1,
          ...(isActiveConversation ? { 'stats.activeConversations': 1 } : {})
        }
      });
    }
    if (departmentChanged && previousDepartmentId && isActiveConversation) {
      const previous = await Department.findById(previousDepartmentId);
      if (previous) {
        previous.stats.activeConversations = Math.max(0, previous.stats.activeConversations - 1);
        await previous.save();
      }
    }
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-department-changed', {
        conversationId: conversation._id,
        departmentId
      });
      io.of('/admin').to(`site:${conversation.siteId}`).emit('conversation-update', {
        conversationId: conversation._id,
        conversation: updatedConversation!.toObject()
      });
    }
    res.json({ conversation: updatedConversation });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.put('/:conversationId/priority', auth, async (req: Request, res: Response) => {
  try {
    const { priority } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
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
    const slaTargets: Record<string, { firstResponse: number; resolution: number }> = {
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
    sendError(res, error, 400);
  }
});
router.post('/:conversationId/notes', auth, async (req: Request, res: Response) => {
  try {
    const note = typeof req.body?.note === 'string' ? req.body.note.trim() : '';
    if (!note || note.length > 5000) {
      return res.status(400).json({ error: 'Note must be between 1 and 5000 characters' });
    }
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
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
      userId: req.userId,
      note,
      createdAt: new Date()
    });
    await conversation.save();
    await conversation.populate('internalNotes.userId', 'name avatar');
    res.json({ conversation });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.put('/:conversationId/status', auth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
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
    const activeStatuses = ['open', 'assigned', 'pending', 'unassigned'];
    const wasActive = activeStatuses.includes(conversation.status);
    const willBeActive = activeStatuses.includes(status);
    if (wasActive && !willBeActive && conversation.assignedAgent) {
      await updateAgentLoad(conversation.assignedAgent, -1);
    } else if (!wasActive && willBeActive && conversation.assignedAgent) {
      await updateAgentLoad(conversation.assignedAgent, 1);
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
      if (wasActive && conversation.department) {
        const dept = await Department.findById(conversation.department._id);
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
      if (wasActive && conversation.assignedAgent) {
        await Team.findByIdAndUpdate(conversation.assignedAgent, {
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
    sendError(res, error, 400);
  }
});
// Konuşmayı mesajlarıyla birlikte kalıcı olarak siler. Eskiden oturumu olan
// her temsilci yapabiliyordu; müşteri verisini ve izini silmek yönetici işi.
router.delete('/:siteId/:conversationId', auth, checkPermission('manage_operations'), async (req: Request, res: Response) => {
  try {
    const { siteId, conversationId } = req.params;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
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
    sendError(res, error);
  }
});
export default router;