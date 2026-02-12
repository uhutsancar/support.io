const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Department = require('../models/Department');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const { auth } = require('../middleware/auth');

// Get all departments for a site
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

// Get single department
router.get('/:id', auth, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('members.userId', 'name email avatar status stats');
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.json(department);
  } catch (error) {
    console.error('Error fetching department:', error);
    res.status(500).json({ error: 'Failed to fetch department' });
  }
});

// Create new department
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, siteId, color, icon, members, autoAssignRules, businessHours } = req.body;
    
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
    
    // Update user departments
    if (members && members.length > 0) {
      for (const member of members) {
        await User.findByIdAndUpdate(
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
    console.error('❌ Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update department
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, description, color, icon, autoAssignRules, businessHours, isActive } = req.body;
    
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      {
        name,
        description,
        color,
        icon,
        autoAssignRules,
        businessHours,
        isActive
      },
      { new: true }
    ).populate('members.userId', 'name email avatar status');
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    res.json(department);
  } catch (error) {
    console.error('Error updating department:', error);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Add member to department
router.post('/:id/members', auth, async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Check if user is already a member
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
    
    // Update user's departments
    await User.findByIdAndUpdate(
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

// Remove member from department
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    const department = await Department.findById(id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    department.members = department.members.filter(
      m => m.userId.toString() !== userId
    );
    
    await department.save();
    
    // Update user's departments
    await User.findByIdAndUpdate(
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

// Get department statistics
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    const stats = {
      totalConversations: await Conversation.countDocuments({ department: department._id }),
      unassigned: await Conversation.countDocuments({ department: department._id, status: 'unassigned' }),
      assigned: await Conversation.countDocuments({ department: department._id, status: 'assigned' }),
      pending: await Conversation.countDocuments({ department: department._id, status: 'pending' }),
      resolved: await Conversation.countDocuments({ department: department._id, status: 'resolved' }),
      closed: await Conversation.countDocuments({ department: department._id, status: 'closed' }),
      activeMembers: department.members.length,
      avgResponseTime: department.stats.averageResponseTime || 0
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Delete department
router.delete('/:id', auth, async (req, res) => {
  try {
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Check if department has active conversations
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
    
    // Remove department from all users
    await User.updateMany(
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
