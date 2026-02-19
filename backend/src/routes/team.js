const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const Department = require('../models/Department');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

router.get('/', auth, async (req, res) => {
  try {
    const { siteId } = req.query;
    
    const orgId = req.organization?._id || req.user.organizationId;
    let query = { isActive: true };

    if (orgId) query.organizationId = orgId;
    if (siteId) {
      query.assignedSites = siteId;
    }
    
    const members = await Team.find(query)
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .sort({ createdAt: -1 });
    
    const membersWithStats = await Promise.all(
      members.map(async (member) => {
        const activeConversations = await Conversation.countDocuments({
          assignedAgent: member._id,
          status: { $in: ['open', 'assigned', 'pending'] }
        });
        
        const resolvedConversations = await Conversation.countDocuments({
          assignedAgent: member._id,
          status: { $in: ['resolved', 'closed'] }
        });
        
        return {
          ...member.toObject(),
          stats: {
            ...member.stats,
            activeConversations,
            resolvedConversations
          }
        };
      })
    );
    
    res.json(membersWithStats);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    const member = await Team.findById(req.params.id)
      .select('-password')
      .populate('departments.departmentId', 'name color icon')
      .populate('assignedSites', 'name domain');
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    if (orgId && member.organizationId && member.organizationId.toString() !== orgId.toString()) {
      return res.status(404).json({ error: 'Team member not found in your organization' });
    }
    
    res.json(member);
  } catch (error) {
    console.error('Error fetching team member:', error);
    res.status(500).json({ error: 'Failed to fetch team member' });
  }
});

router.post('/', auth, checkPermission('manage_users'), async (req, res) => {
  try {
    const { email, password, name, role, assignedSites, departments, permissions } = req.body;
    
    const existingTeamMember = await Team.findOne({ email, isActive: true });
    if (existingTeamMember) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor' });
    }
    
    const orgId = req.organization?._id || req.user.organizationId;

    const teamMember = new Team({
      email,
      password,
      name,
      role: role || 'agent',
      assignedSites: assignedSites || [],
      departments: departments || [],
      permissions: permissions || {},
      organizationId: orgId,
      isActive: true,
      status: 'offline'
    });
    
    await teamMember.save();
    
    if (departments && departments.length > 0) {
      for (const dept of departments) {
        await Department.findByIdAndUpdate(
          dept.departmentId,
          {
            $addToSet: {
              members: {
                userId: teamMember._id,
                role: dept.role || 'agent'
              }
            }
          }
        );
      }
    }
    
    const memberData = await Team.findById(teamMember._id)
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .populate('assignedSites', 'name domain');
    
    const io = req.app.get('io');
    if (io) {
      // Notify the created user directly
      io.of('/admin').to(`user:${memberData._id}`).emit('team-member-added', memberData);
      // Notify admins of assigned sites (if any)
      if (memberData.assignedSites && memberData.assignedSites.length > 0) {
        memberData.assignedSites.forEach(s => {
          const siteId = s._id ? s._id.toString() : s.toString();
          io.of('/admin').to(`site:${siteId}`).emit('team-member-added', memberData);
        });
      }
    }
    
    res.status(201).json(memberData);
  } catch (error) {
    console.error('❌ Error creating team member:', error);
    res.status(500).json({ error: 'Failed to create team member' });
  }
});

router.put('/:id', auth, checkPermission('manage_users'), async (req, res) => {
  try {
    const { name, role, assignedSites, status, permissions, preferences, isActive } = req.body;
    
    const updateData = {
      name,
      role,
      assignedSites,
      status,
      permissions,
      preferences,
      isActive
    };
    
    const orgId = req.organization?._id || req.user.organizationId;
    const member = await Team.findOneAndUpdate(
      { _id: req.params.id, ...(orgId ? { organizationId: orgId } : {}) },
      updateData,
      { new: true }
    )
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .populate('assignedSites', 'name domain');
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    res.json(member);
  } catch (error) {
    console.error('Error updating team member:', error);
    res.status(500).json({ error: 'Failed to update team member' });
  }
});

router.patch('/:id/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!['online', 'offline', 'busy', 'away'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const member = await Team.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    const io = req.app.get('io');
    if (io) {
      // Notify admins for sites this member is assigned to
      if (member.assignedSites && member.assignedSites.length > 0) {
        member.assignedSites.forEach(s => {
          const siteId = s._id ? s._id.toString() : s.toString();
          io.of('/admin').to(`site:${siteId}`).emit('agent-status-changed', {
            userId: req.params.id,
            status
          });
        });
      }
      // Notify the user's personal room
      io.of('/admin').to(`user:${req.params.id}`).emit('agent-status-changed', {
        userId: req.params.id,
        status
      });
    }
    
    res.json(member);
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

router.get('/:id/stats', auth, async (req, res) => {
  try {
    const member = await Team.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    const stats = {
      total: await Conversation.countDocuments({ assignedAgent: member._id }),
      assigned: await Conversation.countDocuments({ assignedAgent: member._id, status: 'assigned' }),
      pending: await Conversation.countDocuments({ assignedAgent: member._id, status: 'pending' }),
      resolved: await Conversation.countDocuments({ assignedAgent: member._id, status: 'resolved' }),
      closed: await Conversation.countDocuments({ assignedAgent: member._id, status: 'closed' }),
      avgResponseTime: member.stats.averageResponseTime || 0,
      currentLoad: member.stats.activeConversations || 0,
      maxLoad: member.permissions?.maxActiveConversations || 10
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.delete('/:id', auth, checkPermission('manage_users'), async (req, res) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    const member = await Team.findOne({ _id: req.params.id, ...(orgId ? { organizationId: orgId } : {}) });
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
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
    
    await Team.findByIdAndDelete(req.params.id);
    
    const io = req.app.get('io');
    if (io) {
      // Notify admins of sites the member belonged to
      if (member.assignedSites && member.assignedSites.length > 0) {
        member.assignedSites.forEach(s => {
          const siteId = s._id ? s._id.toString() : s.toString();
          io.of('/admin').to(`site:${siteId}`).emit('team-member-deleted', { userId: req.params.id });
        });
      }
      // Notify the user's personal room
      io.of('/admin').to(`user:${req.params.id}`).emit('team-member-deleted', { userId: req.params.id });
    }
    
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

module.exports = router;
