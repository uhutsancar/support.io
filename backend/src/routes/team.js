const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Department = require('../models/Department');
const { auth } = require('../middleware/auth');

// Get all team members
router.get('/', auth, async (req, res) => {
  try {
    const { siteId } = req.query;
    
    console.log('🔍 Fetching team members for siteId:', siteId);
    console.log('🔍 siteId type:', typeof siteId);
    
    let query = { isActive: true };
    
    if (siteId) {
      // MongoDB automatically searches in arrays with single value
      query.assignedSites = siteId;
      console.log('📝 Query:', JSON.stringify(query));
    }
    
    const members = await User.find(query)
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found', members.length, 'team members');
    if (members.length > 0) {
      console.log('👥 Members details:', members.map(m => ({
        id: m._id,
        name: m.name,
        email: m.email,
        assignedSites: m.assignedSites,
        assignedSitesType: Array.isArray(m.assignedSites) ? 'array' : typeof m.assignedSites
      })));
    }
    
    res.json(members);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get single team member
router.get('/:id', auth, async (req, res) => {
  try {
    const member = await User.findById(req.params.id)
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
    
    console.log('👥 Creating new team member:', { email, name, role });
    
    // Check if user already exists (only active users)
    const existingUser = await User.findOne({ email, isActive: true });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanılıyor' });
    }
    
    const user = new User({
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
    
    console.log('📝 User object before save:', {
      email: user.email,
      name: user.name,
      assignedSites: user.assignedSites,
      role: user.role
    });
    
    await user.save();
    console.log('💾 User saved to database:', user._id);
    console.log('🔍 Saved assignedSites:', user.assignedSites);
    
    // Add user to departments
    if (departments && departments.length > 0) {
      for (const dept of departments) {
        await Department.findByIdAndUpdate(
          dept.departmentId,
          {
            $addToSet: {
              members: {
                userId: user._id,
                role: dept.role || 'agent'
              }
            }
          }
        );
      }
    }
    
    const memberData = await User.findById(user._id)
      .select('-password')
      .populate('departments.departmentId', 'name color')
      .populate('assignedSites', 'name domain');
    
    console.log('✅ Team member created successfully:', memberData._id);
    console.log('🔍 Response assignedSites:', memberData.assignedSites);
    console.log('📦 Full response:', JSON.stringify({
      _id: memberData._id,
      name: memberData.name,
      email: memberData.email,
      assignedSites: memberData.assignedSites
    }, null, 2));
    
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
    
    const member = await User.findByIdAndUpdate(
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
    
    const member = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).select('-password');
    
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
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
    const member = await User.findById(req.params.id);
    
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
      maxLoad: member.preferences.maxActiveConversations || 10
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
    console.log('🗑️ Deleting team member:', req.params.id);
    
    const member = await User.findById(req.params.id);
    
    if (!member) {
      console.log('❌ Team member not found:', req.params.id);
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
    
    await User.findByIdAndDelete(req.params.id);
    
    console.log('✅ Team member deleted successfully:', req.params.id);
    res.json({ message: 'Team member deleted successfully' });
  } catch (error) {
    console.error('Error deleting team member:', error);
    res.status(500).json({ error: 'Failed to delete team member' });
  }
});

module.exports = router;
