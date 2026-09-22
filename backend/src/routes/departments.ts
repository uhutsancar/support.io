import express from 'express';
import Department from '../models/Department';
import Team from '../models/Team';
import Conversation from '../models/Conversation';
import Site from '../models/Site';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { requireOrgId } from '../middleware/siteAuth';
import { ownedMembers } from '../middleware/teamPolicy';
import events from '../events';
import { departmentConversationStats } from '../db/queries';
import type { Request, Response } from 'express';

const router = express.Router();
router.get('/site/:siteId', auth, async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({ _id: siteId, organizationId: orgId });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const departments = await Department.find({
      siteId: siteId,
      isActive: true
    })
      .populate('members.userId', 'name email avatar status')
      .sort({ createdAt: -1 });
    res.json(departments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});
router.get('/:id', auth, async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const department = await Department.findById(req.params.id)
      .populate('members.userId', 'name email avatar status stats');
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const site = await Site.findById(department.siteId);
    if (!site || site.organizationId.toString() !== orgId.toString()) {
      return res.status(404).json({ error: 'Department not found' });
    }
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});
router.post('/', auth, checkPermission('manage_team'), async (req: Request, res: Response) => {
  try {
    const { name, description, siteId, color, icon, members, autoAssignRules, businessHours } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({ _id: siteId, organizationId: orgId });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    // Üyeler bu şirketin ekibinden olmak zorunda; ayrıntı teamPolicy.ownedMembers.
    const memberEntries = await ownedMembers(orgId, members);
    if (!memberEntries) {
      return res.status(400).json({ error: 'Unknown team member in members', code: 'VALIDATION_ERROR' });
    }
    const department = new Department({
      name,
      description,
      siteId: siteId,
      color,
      icon,
      members: memberEntries.map((m) => ({ ...m, addedAt: new Date() })),
      autoAssignRules: autoAssignRules || { enabled: false, strategy: 'round-robin' },
      businessHours: businessHours || { enabled: false }
    });
    await department.save();
    for (const member of memberEntries) {
      await Team.findOneAndUpdate(
        { _id: member.userId, organizationId: orgId },
        { $addToSet: { departments: { departmentId: department._id, role: member.role } } }
      );
    }
    await department.populate('members.userId', 'name email avatar status');
    res.status(201).json(department);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create department' });
  }
});
router.put('/:id', auth, checkPermission('manage_team'), async (req: Request, res: Response) => {
  try {
    const { name, description, color, icon, members, autoAssignRules, businessHours, isActive } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const site = await Site.findById(department.siteId);
    if (!site || site.organizationId.toString() !== orgId.toString()) {
      return res.status(404).json({ error: 'Department not found' });
    }
    // Gönderilmeyen üye listesi "değişmedi" demektir; eskiden boş liste
    // sayılıp departmanın bütün üyeleri siliniyordu. Gönderildiyse her kişi
    // bu şirketin ekibinden olmak zorunda.
    const memberEntries = members === undefined
      ? department.members.map((m) => ({ userId: String(m.userId), role: (m.role === 'manager' ? 'manager' : 'agent') as 'manager' | 'agent' }))
      : await ownedMembers(orgId, members);
    if (!memberEntries) {
      return res.status(400).json({ error: 'Unknown team member in members', code: 'VALIDATION_ERROR' });
    }
    const oldMembers = department.members.map((m) => String(m.userId));
    const oldSla = JSON.stringify(department.sla || {});
    const oldBusinessHours = JSON.stringify(department.businessHours || {});
    const newMembers: string[] = memberEntries.map((m) => m.userId);
    const removedMembers = oldMembers.filter((id) => !newMembers.includes(id));
    const addedMembers = newMembers.filter((id) => !oldMembers.includes(id));
    department.name = name;
    department.description = description;
    department.color = color;
    department.icon = icon;
    const joinedAt = new Map(department.members.map((m) => [String(m.userId), m.addedAt]));
    department.members = memberEntries.map((m) => ({ ...m, addedAt: joinedAt.get(m.userId) || new Date() }));
    department.autoAssignRules = autoAssignRules;
    department.businessHours = businessHours;
    if (isActive !== undefined) department.isActive = isActive;
    await department.save();
    try {
      const newSla = JSON.stringify(department.sla || {});
      const newBusinessHours = JSON.stringify(department.businessHours || {});
      if (oldSla !== newSla || oldBusinessHours !== newBusinessHours) {
        events.emit('sla.updated', {
          organizationId: req.organization?._id || req.user.organizationId,
          userId: req.user ? req.user._id : null,
          entityId: department._id,
          metadata: { previous: JSON.parse(oldSla), current: JSON.parse(newSla), previousBusinessHours: JSON.parse(oldBusinessHours), currentBusinessHours: JSON.parse(newBusinessHours) },
          ip: req.ip,
          ua: req.get('user-agent')
        });
      }
    } catch (e) {
    }
    if (removedMembers.length > 0) {
      for (const memberId of removedMembers) {
        await Team.findOneAndUpdate(
          { _id: memberId, organizationId: orgId },
          {
            $pull: {
              departments: { departmentId: department._id }
            }
          }
        );
      }
    }
    if (addedMembers.length > 0) {
      for (const memberId of addedMembers) {
        const memberData = memberEntries.find((m) => m.userId === memberId);
        await Team.findOneAndUpdate(
          { _id: memberId, organizationId: orgId },
          {
            $addToSet: {
              departments: {
                departmentId: department._id,
                role: memberData?.role || 'agent'
              }
            }
          }
        );
      }
    }
    await department.populate('members.userId', 'name email avatar status');
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update department' });
  }
});
router.post('/:id/members', auth, checkPermission('manage_team'), async (req: Request, res: Response) => {
  try {
    const { userId, role } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const site = await Site.findById(department.siteId);
    if (!site || site.organizationId.toString() !== orgId.toString()) {
      return res.status(404).json({ error: 'Department not found' });
    }
    // Eklenen kişi bu şirketin ekibinden olmak zorunda; aksi halde başka bir
    // şirketin temsilcisinin kaydına yazılıyor ve bilgileri yanıtta dönüyordu.
    const [entry] = (await ownedMembers(orgId, [{ userId, role }])) || [];
    if (!entry) {
      return res.status(400).json({ error: 'Unknown team member', code: 'VALIDATION_ERROR' });
    }
    const existingMember = department.members.find(
      m => m.userId.toString() === entry.userId
    );
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member' });
    }
    department.members.push({
      userId: entry.userId,
      role: entry.role,
      addedAt: new Date()
    });
    await department.save();
    await Team.findOneAndUpdate(
      { _id: entry.userId, organizationId: orgId },
      {
        $addToSet: {
          departments: {
            departmentId: department._id,
            role: entry.role
          }
        }
      }
    );
    await department.populate('members.userId', 'name email avatar status');
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add member' });
  }
});
router.delete('/:id/members/:userId', auth, checkPermission('manage_team'), async (req: Request, res: Response) => {
  try {
    const { id, userId } = req.params;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const site = await Site.findById(department.siteId);
    if (!site || site.organizationId.toString() !== orgId.toString()) {
      return res.status(404).json({ error: 'Department not found' });
    }
    department.members = department.members.filter(
      m => m.userId.toString() !== userId
    );
    await department.save();
    await Team.findOneAndUpdate(
      { _id: userId, organizationId: orgId },
      {
        $pull: {
          departments: { departmentId: department._id }
        }
      }
    );
    await department.populate('members.userId', 'name email avatar status');
    res.json(department);
  } catch (error) {
    res.status(500).json({ error: 'Failed to remove member' });
  }
});
router.get('/:id/stats', auth, async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const site = await Site.findOne({
      _id: department.siteId,
      organizationId: orgId
    });
    if (!site) return res.status(404).json({ error: 'Department not found' });
    // A single grouped scan replaces the six separate counts.
    const counted = await departmentConversationStats(department._id);
    const stats = {
      totalConversations: counted.total,
      unassigned: counted.unassigned,
      assigned: counted.assigned,
      pending: counted.pending,
      resolved: counted.resolved,
      closed: counted.closed,
      activeMembers: department.members.length,
      avgResponseTime: department.stats?.averageResponseTime || 0
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});
router.delete('/:id', auth, checkPermission('manage_team'), async (req: Request, res: Response) => {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findById(department.siteId);
    if (!site || site.organizationId.toString() !== orgId.toString()) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const { active: activeConversations } = await departmentConversationStats(department._id);
    if (activeConversations > 0) {
      return res.status(400).json({
        error: 'Cannot delete department with active conversations',
        activeConversations
      });
    }
    await Team.updateMany(
      { 'departments.departmentId': department._id },
      {
        $pull: {
          departments: { departmentId: department._id }
        }
      }
    );
    await Department.findByIdAndDelete(req.params.id);
    res.json({ message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete department' });
  }
});
export default router;