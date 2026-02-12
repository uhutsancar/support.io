const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const Department = require('../models/Department');
const { auth } = require('../middleware/auth');

// Get all team members
router.get('/', auth, async (req, res) => {
  try {
    const { siteId } = req.query;
    
    let query = { isActive: true };
    
    if (siteId) {
      query.assignedSites = siteId;
    }
    
    const members = await Team.find(query)
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .sort({ createdAt: -1 });
    
    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get single team member
router.get('/:id', auth, async (req, res) => {
  try {
    const member = await Team.findById(req.params.id)
      .select('-password')
      .populate('departments.departmentId', 'name color icon')
      .populate('assignedSites', 'name domain');
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    res.json(member);
  } catch (error) {
    console.error('Error fetching team member:', error);
    res.status(500).json({ error: 'Failed to fetch team member' });
  }
});

// Create new team member
router.post('/', auth, async (req, res) => {
  try {
    const { email, password, name, role, assignedSites, departments, permissions } = req.body;
    
    // Check if team member already exists (only active members)
    const existingTeamMember = await Team.findOne({ email, isActive: true });
    if (existingTeamMember) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor' });
    }
    
    const teamMember = new Team({
      email,
      password,
      name,
      role: role || 'agent',
      assignedSites: assignedSites || [],
      departments: departments || [],
      permissions: permissions || {},
      isActive: true,
      status: 'offline'
    });
    
    await teamMember.save();
    
    // Add team member to departments
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
    
    // Socket.io ile broadcast
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').emit('team-member-added', memberData);
    }
    
    res.status(201).json(memberData);
  } catch (error) {
    console.error('❌ Error creating team member:', error);
    res.status(500).json({ error: 'Failed to create team member' });
  }
});

// Update team member
router.put('/:id', auth, async (req, res) => {
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
    
    const member = await Team.findByIdAndUpdate(
      req.params.id,
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

// Update team member status (online/offline/busy/away)
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
    
    // Socket.io ile broadcast - status değişikliği
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').emit('agent-status-changed', {
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

// Get team member statistics
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

// Delete team member
router.delete('/:id', auth, async (req, res) => {
  try {
    const member = await Team.findById(req.params.id);
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    
    // Check if member has active conversations
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
    
    // Remove member from all departments
    await Department.updateMany(
      { 'members.userId': member._id },
      {
        $pull: {
          members: { userId: member._id }
        }
      }
    );
    
    await Team.findByIdAndDelete(req.params.id);
    
    // Socket.io ile broadcast - member silindi
    const io = req.app.get('io');
    if (io) {
      io.of('/admin').emit('team-member-deleted', { userId: req.params.id });
    }
    
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

module.exports = router;
