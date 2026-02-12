const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Department = require('../models/Department');
const Team = require('../models/Team');
const Conversation = require('../models/Conversation');
const { auth } = require('../middleware/auth');

// Get all departments for a site
router.get('/site/:siteId', auth, async (req, res) => {
  try {
    const { siteId } = req.params;
    
    console.log('📥 Fetching departments for site:', siteId);
    
    const departments = await Department.find({ 
      siteId: siteId,
      isActive: true 
    })
      .populate('members.userId', 'name email avatar status')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found', departments.length, 'departments');
    departments.forEach(dept => {
      console.log(`  📁 ${dept.name}: ${dept.members.length} members`);
    });
    
    res.json(departments);
  } catch (error) {
    console.error('❌ Error fetching departments:', error);
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
    
    console.log('📥 Creating new department:', { 
      name, 
      siteId, 
      membersCount: members?.length || 0,
      members: members 
    });
    
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
    console.log('✅ Department saved with ID:', department._id);
    
    // Update team member departments
    if (members && members.length > 0) {
      console.log('🔄 Updating team members departments...');
      for (const member of members) {
        console.log('  📝 Updating member:', member.userId);
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
      console.log('✅ All team members updated');
    }
    
    await department.populate('members.userId', 'name email avatar status');
    console.log('✅ Department populated and ready to send');
    
    res.status(201).json(department);
  } catch (error) {
    console.error('❌ Error creating department:', error);
    res.status(500).json({ error: 'Failed to create department' });
  }
});

// Update department
router.put('/:id', auth, async (req, res) => {
  try {
    console.log('📥 UPDATE REQUEST RECEIVED');
    console.log('  🆔 Department ID:', req.params.id);
    console.log('  📦 req.body:', JSON.stringify(req.body, null, 2));
    console.log('  👥 req.body.members:', req.body.members);
    console.log('  📊 Members type:', typeof req.body.members);
    console.log('  📏 Members length:', req.body.members?.length);
    
    const { name, description, color, icon, members, autoAssignRules, businessHours, isActive } = req.body;
    
    console.log('  ✅ Destructured members:', members);
    console.log('  👥 Members count:', members?.length || 0);
    
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      console.log('❌ Department not found');
      return res.status(404).json({ error: 'Department not found' });
    }
    
    console.log('  📁 Current department:', department.name);
    console.log('  👥 Current members:', department.members);
    
    // Get old members to update Team collection
    const oldMembers = department.members.map(m => m.userId.toString());
    const newMembers = members?.map(m => m.userId) || [];
    
    console.log('  🔄 Old members:', oldMembers);
    console.log('  🔄 New members:', newMembers);
    
    // Find removed members
    const removedMembers = oldMembers.filter(id => !newMembers.includes(id));
    console.log('  ➖ Removed members:', removedMembers);
    
    // Find added members
    const addedMembers = newMembers.filter(id => !oldMembers.includes(id));
    console.log('  ➕ Added members:', addedMembers);
    
    // Update department
    console.log('  📝 Updating department fields...');
    department.name = name;
    department.description = description;
    department.color = color;
    department.icon = icon;
    department.members = members || [];
    department.autoAssignRules = autoAssignRules;
    department.businessHours = businessHours;
    if (isActive !== undefined) department.isActive = isActive;
    
    console.log('  💾 Before save - members:', department.members);
    console.log('  💾 Members count before save:', department.members.length);
    
    await department.save();
    console.log('✅ Department saved to database');
    
    // Verify it was saved
    const savedDept = await Department.findById(req.params.id);
    console.log('  🔍 Verification - members in DB:', savedDept.members);
    console.log('  🔍 Members count in DB:', savedDept.members.length);
    
    // Remove department from removed members
    if (removedMembers.length > 0) {
      console.log('🔄 Removing department from team members...');
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
      console.log('✅ Removed from team members');
    }
    
    // Add department to new members
    if (addedMembers.length > 0) {
      console.log('🔄 Adding department to new team members...');
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
      console.log('✅ Added to team members');
    }
    
    await department.populate('members.userId', 'name email avatar status');
    console.log('✅ Department populated');
    console.log('  📤 Final members being sent:', department.members);
    console.log('  📤 Final members count:', department.members.length);
    
    res.json(department);
    console.log('✅ Response sent to client');
  } catch (error) {
    console.error('❌ Error updating department:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to update department' });
  }
});

// Add member to department
router.post('/:id/members', auth, async (req, res) => {
  try {
    const { userId, role } = req.body;
    
    console.log('📥 Adding member to department:', { 
      departmentId: req.params.id, 
      userId, 
      role 
    });
    
    const department = await Department.findById(req.params.id);
    
    if (!department) {
      console.log('❌ Department not found');
      return res.status(404).json({ error: 'Department not found' });
    }
    
    // Check if user is already a member
    const existingMember = department.members.find(
      m => m.userId.toString() === userId
    );
    
    if (existingMember) {
      console.log('⚠️ User is already a member');
      return res.status(400).json({ error: 'User is already a member' });
    }
    
    console.log('✅ Adding member to department.members array');
    department.members.push({
      userId,
      role: role || 'agent',
      addedAt: new Date()
    });
    
    await department.save();
    console.log('✅ Department saved');
    
    // Update team member's departments
    console.log('🔄 Updating team member departments');
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
    console.log('✅ Team member updated');
    
    await department.populate('members.userId', 'name email avatar status');
    console.log('✅ Populated department members');
    
    res.json(department);
  } catch (error) {
    console.error('❌ Error adding member:', error);
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
    
    // Update team member's departments
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
    
    // Remove department from all team members
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
