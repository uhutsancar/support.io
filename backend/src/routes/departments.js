const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Department = require('../models/Department');
const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const Site = require('../models/Site');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const events = require('../events');

router.get('/site/:siteId', auth, async (req, res) => {
  try {
    const { siteId } = req.params;
    
    const departments = await Department.find({ 
      siteId: siteId,
      isActive: true 
    })
      .populate('members.userId', 'name email avatar status')
      .sort({ createdAt: -1 });
    
    res.json(departments);
  } catch (error) {
    console.error('Error fetching departments:', error);
    res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    const department = await Department.findById(req.params.id)
      .populate('members.userId', 'name email avatar status stats');
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    // Organization isolation: ensure department's site belongs to user's org
    if (orgId) {
      const site = await Site.findById(department.siteId);
      if (!site || site.organizationId.toString() !== orgId.toString()) {
        return res.status(404).json({ error: 'Department not found' });
      }
    }
    
    res.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

router.post('/', auth, checkPermission('manage_team'), async (req, res) => {
  try {
    const { name, description, siteId, color, icon, members, autoAssignRules, businessHours } = req.body;
    const orgId = req.organization?._id || req.user.organizationId;
    // ensure site belongs to organization
    const site = await Site.findOne({ _id: siteId, ...(orgId ? { organizationId: orgId } : {}) });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    
    const department = new Department({
      name,
      description,
      siteId: siteId,
      color,
      icon,
      members: members || [],
      autoAssignRules: autoAssignRules || { enabled: false, strategy: 'round-robin' },
      businessHours: businessHours || { enabled: false }
    });
    
    await department.save();
    if (members && members.length > 0) {
      for (const member of members) {
        await Team.findByIdAndUpdate(
          member.userId,
          {
            $addToSet: {
              departments: {
                departmentId: department._id,
                role: member.role || 'agent'
              }
            }
          }
        );
      }
    }
    
    await department.populate('members.userId', 'name email avatar status');
    
    res.status(201).json(department);
  } catch (error) {
    console.error('Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

router.put('/:id', auth, checkPermission('manage_team'), async (req, res) => {
  try {
    const { name, description, color, icon, members, autoAssignRules, businessHours, isActive } = req.body;
    const orgId = req.organization?._id || req.user.organizationId;
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    if (orgId) {
      const site = await Site.findById(department.siteId);
      if (!site || site.organizationId.toString() !== orgId.toString()) {
        return res.status(404).json({ error: 'Department not found' });
      }
    }
    
    const oldMembers = department.members.map(m => m.userId.toString());
    const oldSla = JSON.stringify(department.sla || {});
    const oldBusinessHours = JSON.stringify(department.businessHours || {});
    const newMembers = members?.map(m => m.userId) || [];
    
    const removedMembers = oldMembers.filter(id => !newMembers.includes(id));
    const addedMembers = newMembers.filter(id => !oldMembers.includes(id));
    
    department.name = name;
    department.description = description;
    department.color = color;
    department.icon = icon;
    department.members = members || [];
    department.autoAssignRules = autoAssignRules;
    department.businessHours = businessHours;
    if (isActive !== undefined) department.isActive = isActive;
    
    await department.save();

    // Emit SLA update audit event when SLA or business hours changed
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
      console.warn('emit sla.updated failed', e.message);
    }
    
    if (removedMembers.length > 0) {
      for (const memberId of removedMembers) {
        await Team.findByIdAndUpdate(
          memberId,
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
        const memberData = members.find(m => m.userId === memberId);
        await Team.findByIdAndUpdate(
          memberId,
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
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

router.post('/:id/members', auth, checkPermission('manage_team'), async (req, res) => {
  try {
    const { userId, role } = req.body;
    const orgId = req.organization?._id || req.user.organizationId;
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    if (orgId) {
      const site = await Site.findById(department.siteId);
      if (!site || site.organizationId.toString() !== orgId.toString()) {
        return res.status(404).json({ error: 'Department not found' });
      }
    }
    
    const existingMember = department.members.find(
      m => m.userId.toString() === userId
    );
    
    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member' });
    }
    
    department.members.push({
      userId,
      role: role || 'agent',
      addedAt: new Date()
    });
    
    await department.save();
    
    await Team.findByIdAndUpdate(
      userId,
      {
        $addToSet: {
          departments: {
            departmentId: department._id,
            role: role || 'agent'
          }
        }
      }
    );
    
    await department.populate('members.userId', 'name email avatar status');
    
    res.json(department);
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ error: 'Failed to add member' });
  }
});

router.delete('/:id/members/:userId', auth, checkPermission('manage_team'), async (req, res) => {
  try {
    const { id, userId } = req.params;
    const orgId = req.organization?._id || req.user.organizationId;
    const department = await Department.findById(id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    if (orgId) {
      const site = await Site.findById(department.siteId);
      if (!site || site.organizationId.toString() !== orgId.toString()) {
        return res.status(404).json({ error: 'Department not found' });
      }
    }
    
    department.members = department.members.filter(
      m => m.userId.toString() !== userId
    );
    
    await department.save();
    
    await Team.findByIdAndUpdate(
      userId,
      {
        $pull: {
          departments: { departmentId: department._id }
        }
      }
    );
    
    await department.populate('members.userId', 'name email avatar status');
    
    res.json(department);
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

router.get('/:id/stats', auth, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    const totalConversations = await Conversation.countDocuments({ department: department._id });
    
    const unassigned = await Conversation.countDocuments({ 
      department: department._id, 
      status: 'open',
      assignedAgent: null
    });
    
    const stats = {
      totalConversations,
      unassigned,
      assigned: await Conversation.countDocuments({ 
        department: department._id, 
        status: 'assigned',
        assignedAgent: { $ne: null }
      }),
      pending: await Conversation.countDocuments({ department: department._id, status: 'pending' }),
      resolved: await Conversation.countDocuments({ department: department._id, status: 'resolved' }),
      closed: await Conversation.countDocuments({ department: department._id, status: 'closed' }),
      activeMembers: department.members.length,
      avgResponseTime: department.stats?.averageResponseTime || 0
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.delete('/:id', auth, checkPermission('manage_team'), async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    const orgId = req.organization?._id || req.user.organizationId;
    if (orgId) {
      const site = await Site.findById(department.siteId);
      if (!site || site.organizationId.toString() !== orgId.toString()) {
        return res.status(404).json({ error: 'Department not found' });
      }
    }
    
    const activeConversations = await Conversation.countDocuments({
      department: department._id,
      status: { $in: ['unassigned', 'assigned', 'pending'] }
    });
    
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
    console.error('Error deleting department:', error);
    res.status(500).json({ error: 'Failed to delete department' });
  }
});

module.exports = router;
