const bcrypt = require('bcryptjs');
const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'User',
  table: 'users',
  fields: {
    email: { column: 'email', type: 'string', required: true, lowercase: true, trim: true },
    password: { column: 'password', type: 'string', required: true },
    name: { column: 'name', type: 'string', required: true, trim: true },
    role: { column: 'role', type: 'string', enum: ['owner', 'admin', 'manager', 'agent', 'viewer'], default: 'agent' },
    avatar: { column: 'avatar', type: 'string', default: null },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    isOnboarded: { column: 'is_onboarded', type: 'boolean', default: false },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', default: null },
    status: { column: 'status', type: 'string', enum: ['online', 'offline', 'busy', 'away'], default: 'offline' },
    permissions: {
      column: 'permissions',
      type: 'json',
      default: () => ({
        canManageTeam: false,
        canManageDepartments: false,
        canViewAllConversations: false,
        canAssignConversations: true,
        canDeleteConversations: false
      })
    },
    preferences: {
      column: 'preferences',
      type: 'json',
      default: () => ({ autoAcceptAssignments: true, maxActiveConversations: 10, notificationSound: true })
    },
    stats: {
      column: 'stats',
      type: 'json',
      default: () => ({ totalConversations: 0, activeConversations: 0, resolvedConversations: 0, averageResponseTime: 0 })
    }
  },
  children: {
    assignedSites: {
      table: 'user_assigned_sites',
      parentKey: 'user_id',
      valueColumn: 'site_id',
      scalar: true,
      ref: 'Site'
    },
    departments: {
      table: 'user_departments',
      parentKey: 'user_id',
      fields: {
        departmentId: { column: 'department_id', type: 'id', ref: 'Department' },
        role: { column: 'role', type: 'string', default: 'agent' }
      }
    }
  },
  hooks: {
    async preSave() {
      if (!this.isModified('password')) return;
      this.password = await bcrypt.hash(this.password, 10);
    }
  },
  methods: {
    async comparePassword(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    }
  }
});
