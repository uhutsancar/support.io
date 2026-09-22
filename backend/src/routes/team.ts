import express from 'express';
import { sendError } from '../middleware/errors';
import { requireOrgId } from '../middleware/siteAuth';
import Team from '../models/Team';
import Conversation from '../models/Conversation';
import Department from '../models/Department';
import { auth } from '../middleware/auth';
import { checkPermission, hasPermission } from '../middleware/rbac';
import {
  isTeamRole, canAssignRole, canManageMember,
  sanitizePermissions, ownedSiteIds, ownedDepartments
} from '../middleware/teamPolicy';
import events from '../events';
import { passwordProblem } from '../config/passwords';
import { conversationCountsByAgent, agentConversationStats, agentPerformance } from '../db/queries';
import type { Request, Response } from 'express';
import type { Doc, Filter } from '../db/model';
import type { TeamDoc } from '../models/Team';

const router = express.Router();
// Performance figures for the signed-in agent. Declared before the "/:id"
// routes below so "me" is not captured as an agent id.
//
// The window is chosen from a fixed set rather than parsed from the query
// string, so no caller-supplied value ever reaches the interval expression.
const PERFORMANCE_RANGES = { '7d': 7, '30d': 30, '90d': 90 };

router.get('/me/performance', auth, async (req: Request, res: Response) => {
  try {
    const range = String(req.query.range || '7d');
    const days = (PERFORMANCE_RANGES as Record<string, number>)[range];
    if (!days) {
      return res.status(400).json({
        error: `range must be one of: ${Object.keys(PERFORMANCE_RANGES).join(', ')}`
      });
    }

    // Scoped to the caller's own id, so an agent can only ever read their own
    // numbers regardless of what they send.
    const performance = await agentPerformance(req.userId, days);
    res.json({ range, days, performance });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const { siteId } = req.query;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const query: Filter = { isActive: true };
    query.organizationId = orgId;
    if (siteId) {
      query.assignedSites = siteId;
    }
    const members = await Team.find(query)
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .sort({ createdAt: -1 });
    // Counted for every member in a single grouped query.
    const counts = await conversationCountsByAgent(members.map((m) => m._id));
    const membersWithStats = members.map((member) => {
      const counted = counts.get(member._id) || { activeConversations: 0, resolvedConversations: 0 };
      return {
        ...member.toObject(),
        stats: {
          ...member.stats,
          activeConversations: counted.activeConversations,
          resolvedConversations: counted.resolvedConversations
        }
      };
    });
    res.json(membersWithStats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    // Org filtresi sorgunun icinde: kayit yuklendikten sonra karsilastirmak,
    // organizationId bos olan bir kaydi kontrolsuz geciriyordu.
    const member = await Team.findOne({ _id: req.params.id, organizationId: orgId })
      .select('-password')
      .populate('departments.departmentId', 'name color icon')
      .populate('assignedSites', 'name domain');
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch team member' });
  }
});
router.post('/', auth, checkPermission('manage_users'), async (req: Request, res: Response) => {
  try {
    const { email, password, name, role = 'agent', assignedSites, departments, permissions } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;

    // Rol, izinler, siteler ve departmanlar gövdeden geliyor; hiçbiri
    // doğrulanmadan yazılmıyor. Ayrıntı: middleware/teamPolicy.ts
    if (!isTeamRole(role)) {
      return res.status(400).json({ error: 'Invalid role', code: 'VALIDATION_ERROR' });
    }
    // Eskiden bu uç parolayı hiç kontrol etmiyordu: bir admin tek karakterli
    // bir parolayla hesap açabiliyordu.
    const passwordIssue = passwordProblem(password);
    if (passwordIssue) {
      return res.status(400).json({ error: passwordIssue, code: 'VALIDATION_ERROR' });
    }
    if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return res.status(400).json({ error: 'Invalid email address', code: 'VALIDATION_ERROR' });
    }
    if (typeof name !== 'string' || !name.trim() || name.length > 100) {
      return res.status(400).json({ error: 'Invalid name', code: 'VALIDATION_ERROR' });
    }
    if (!canAssignRole(req.user.role, role)) {
      return res.status(403).json({ error: 'You cannot assign this role', code: 'FORBIDDEN' });
    }
    const cleanPermissions = sanitizePermissions(permissions);
    if (!cleanPermissions) {
      return res.status(400).json({ error: 'Invalid permissions', code: 'VALIDATION_ERROR' });
    }
    const siteIds = await ownedSiteIds(orgId, assignedSites);
    if (!siteIds) {
      return res.status(400).json({ error: 'Unknown site in assignedSites', code: 'VALIDATION_ERROR' });
    }
    const departmentEntries = await ownedDepartments(orgId, departments);
    if (!departmentEntries) {
      return res.status(400).json({ error: 'Unknown department', code: 'VALIDATION_ERROR' });
    }

    const existingTeamMember = await Team.findOne({ email, isActive: true });
    if (existingTeamMember) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor' });
    }
    const teamMember = new Team({
      email,
      password,
      name,
      role,
      assignedSites: siteIds,
      departments: departmentEntries,
      permissions: cleanPermissions,
      organizationId: orgId,
      isActive: true,
      status: 'offline'
    });
    await teamMember.save();
    // Kimlikler yukarıda bu şirketin departmanlarıyla eşleştirildi; burada
    // yalnızca doğrulanmış kayıtlar yazılıyor.
    for (const dept of departmentEntries) {
      await Department.findByIdAndUpdate(dept.departmentId, {
        $addToSet: { members: { userId: teamMember._id, role: dept.role } }
      });
    }
    // Read back right after the insert in this same handler, so the row is there.
    const memberData = (await Team.findById(teamMember._id)
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .populate('assignedSites', 'name domain')) as Doc<TeamDoc>;
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').to(`user:${memberData._id}`).emit('team-member-added', memberData);
      if (memberData.assignedSites && memberData.assignedSites.length > 0) {
        memberData.assignedSites.forEach(s => {
          const siteId = s._id ? s._id.toString() : s.toString();
          io.of('/admin').to(`site:${siteId}`).emit('team-member-added', memberData);
        });
      }
    }
    res.status(201).json(memberData);
    events.emit('agent.created', {
      organizationId: orgId,
      userId: req.user ? req.user._id : null,
      entityId: memberData._id,
      metadata: { name: memberData.name, email: memberData.email },
      ip: req.ip,
      ua: req.get('user-agent')
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create team member' });
  }
});
router.put('/:id', auth, checkPermission('manage_users'), async (req: Request, res: Response) => {
  try {
    const { name, role, assignedSites, status, permissions, preferences, isActive } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const existing = await Team.findOne({ _id: req.params.id, organizationId: orgId });
    if (!existing) return res.status(404).json({ error: 'Team member not found' });

    // Akranını ya da üstünü yönetemez; kendi rütbesinin altına rol verebilir.
    if (!canManageMember(req.user.role, existing.role)) {
      return res.status(403).json({ error: 'You cannot manage this member', code: 'FORBIDDEN' });
    }
    if (role !== undefined) {
      if (!isTeamRole(role)) {
        return res.status(400).json({ error: 'Invalid role', code: 'VALIDATION_ERROR' });
      }
      if (!canAssignRole(req.user.role, role)) {
        return res.status(403).json({ error: 'You cannot assign this role', code: 'FORBIDDEN' });
      }
    }
    if (status !== undefined && !['online', 'offline', 'busy', 'away'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status', code: 'VALIDATION_ERROR' });
    }
    if (isActive !== undefined && typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'isActive must be a boolean', code: 'VALIDATION_ERROR' });
    }
    if (name !== undefined && (typeof name !== 'string' || !name.trim() || name.length > 100)) {
      return res.status(400).json({ error: 'Invalid name', code: 'VALIDATION_ERROR' });
    }
    const cleanPermissions = permissions === undefined ? undefined : sanitizePermissions(permissions);
    if (cleanPermissions === null) {
      return res.status(400).json({ error: 'Invalid permissions', code: 'VALIDATION_ERROR' });
    }
    const siteIds = assignedSites === undefined ? undefined : await ownedSiteIds(orgId, assignedSites);
    if (siteIds === null) {
      return res.status(400).json({ error: 'Unknown site in assignedSites', code: 'VALIDATION_ERROR' });
    }
    if (preferences !== undefined && (typeof preferences !== 'object' || preferences === null || Array.isArray(preferences))) {
      return res.status(400).json({ error: 'Invalid preferences', code: 'VALIDATION_ERROR' });
    }

    // Yalnızca gönderilen ve doğrulanan alanlar yazılır.
    const updateData = Object.fromEntries(Object.entries({
      name: typeof name === 'string' ? name.trim() : undefined,
      role, assignedSites: siteIds, status, permissions: cleanPermissions, preferences, isActive
    }).filter(([, value]) => value !== undefined));
    const previousRole = existing.role;
    // `existing` was loaded under the same filter a line above, so the update
    // matches the row it just read.
    const member = (await Team.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId },
      updateData,
      { new: true }
    )
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .populate('assignedSites', 'name domain')) as Doc<TeamDoc>;
    if (previousRole && role && previousRole !== role) {
      events.emit('agent.role.updated', {
        organizationId: orgId,
        userId: req.user ? req.user._id : null,
        entityId: member._id,
        metadata: { previousRole, newRole: role },
        ip: req.ip,
        ua: req.get('user-agent')
      });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update team member' });
  }
});
router.patch('/:id/status', auth, async (req: Request, res: Response) => {
  try {
    const { status } = req.body;
    if (!['online', 'offline', 'busy', 'away'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    // Eskiden yalnızca oturum isteniyordu: herhangi bir şirketin kullanıcısı
    // başka bir şirketin temsilcisini çevrimdışı yapabiliyor (otomatik atama
    // bozulur) ve yanıtta o kişinin profilini okuyabiliyordu. Artık üye
    // çağıranın şirketinde aranıyor; başkasının durumunu değiştirmek ekip
    // yönetimi izni istiyor.
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const target = await Team.findOne({ _id: req.params.id, organizationId: orgId }).select('_id role');
    if (!target) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    const isSelf = String(target._id) === String(req.user._id);
    if (!isSelf && !(hasPermission(req.user.role, 'manage_team') && canManageMember(req.user.role, target.role))) {
      return res.status(403).json({ error: "You cannot change this member's status", code: 'FORBIDDEN' });
    }
    const member = await Team.findOneAndUpdate(
      { _id: target._id, organizationId: orgId },
      { status },
      { new: true }
    ).select('-password');
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    const io = req.app.get('io');
    if (io) {
      if (member.assignedSites && member.assignedSites.length > 0) {
        member.assignedSites.forEach(s => {
          const siteId = s._id ? s._id.toString() : s.toString();
          io.of('/admin').to(`site:${siteId}`).emit('agent-status-changed', {
            userId: req.params.id,
            status
          });
        });
      }
      io.of('/admin').to(`user:${req.params.id}`).emit('agent-status-changed', {
        userId: req.params.id,
        status
      });
    }
    res.json(member);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});
router.get('/:id/stats', auth, async (req: Request, res: Response) => {
  try {
    const member = await Team.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    const counted = await agentConversationStats(member._id);
    const stats = {
      total: counted.total,
      assigned: counted.assigned,
      pending: counted.pending,
      resolved: counted.resolved,
      closed: counted.closed,
      avgResponseTime: member.stats.averageResponseTime || 0,
      currentLoad: member.stats.activeConversations || 0,
      // Team permissions carry no per-agent conversation cap — the capacity a
      // Team row actually holds is `maxCapacity` — so this lookup falls through
      // to the default. Kept as it was rather than silently changing the number
      // the panel shows.
      maxLoad: ((member.permissions as unknown as Record<string, unknown>)?.maxActiveConversations as number) || 10
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});
router.delete('/:id', auth, checkPermission('manage_users'), async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const member = await Team.findOne({ _id: req.params.id, organizationId: orgId });
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    if (!canManageMember(req.user.role, member.role)) {
      return res.status(403).json({ error: 'You cannot manage this member', code: 'FORBIDDEN' });
    }
    const activeConversations = await Conversation.countDocuments({
      assignedAgent: member._id,
      status: { $in: ['assigned', 'pending'] }
    });
    if (activeConversations > 0) {
      return res.status(400).json({
        error: 'Cannot delete team member with active conversations',
        activeConversations
      });
    }
    await Department.updateMany(
      { 'members.userId': member._id },
      {
        $pull: {
          members: { userId: member._id }
        }
      }
    );
    await Team.deleteOne({ _id: member._id, organizationId: orgId });
    const io = req.app.get('io');
    if (io) {
      if (member.assignedSites && member.assignedSites.length > 0) {
        member.assignedSites.forEach(s => {
          const siteId = s._id ? s._id.toString() : s.toString();
          io.of('/admin').to(`site:${siteId}`).emit('team-member-deleted', { userId: req.params.id });
        });
      }
      io.of('/admin').to(`user:${req.params.id}`).emit('team-member-deleted', { userId: req.params.id });
    }
    events.emit('agent.deleted', {
      organizationId: orgId,
      userId: req.user ? req.user._id : null,
      entityId: req.params.id,
      metadata: { email: member.email, name: member.name },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});
export default router;