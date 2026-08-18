const bcrypt = require('bcryptjs');
const { defineModel } = require('../db/model');

module.exports = defineModel({
  name: 'Team',
  table: 'teams',
  fields: {
    email: { column: 'email', type: 'string', required: true, lowercase: true, trim: true },
    password: { column: 'password', type: 'string', required: true },
    name: { column: 'name', type: 'string', required: true, trim: true },
    role: { column: 'role', type: 'string', enum: ['admin', 'manager', 'agent'], default: 'agent' },
    avatar: { column: 'avatar', type: 'string', default: null },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', default: null },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    status: { column: 'status', type: 'string', enum: ['online', 'offline', 'away', 'busy'], default: 'offline' },
    skills: { column: 'skills', type: 'stringArray', lowercase: true, trim: true, default: () => [] },
    maxCapacity: { column: 'max_capacity', type: 'number', default: 10, min: 1 },
    currentLoad: { column: 'current_load', type: 'number', default: 0, min: 0 },
    permissions: {
      column: 'permissions',
      type: 'json',
      default: () => ({
        canManageConversations: true,
        canManageDepartments: false,
        canManageTeam: false,
        canManageSites: false,
        canViewAnalytics: true,
        canManageFAQs: false
      })
    },
    stats: {
      column: 'stats',
      type: 'json',
      default: () => ({
        totalConversations: 0,
        activeConversations: 0,
        resolvedConversations: 0,
        averageResponseTime: 0,
        satisfactionRate: 0
      })
    },
    lastActive: { column: 'last_active', type: 'date', default: () => new Date() },
    phone: { column: 'phone', type: 'string', default: null },
    bio: { column: 'bio', type: 'string', default: null }
  },
  children: {
    assignedSites: {
      table: 'team_assigned_sites',
      parentKey: 'team_id',
      valueColumn: 'site_id',
      scalar: true,
      ref: 'Site'
    },
    departments: {
      table: 'team_departments',
      parentKey: 'team_id',
      fields: {
        departmentId: { column: 'department_id', type: 'id', ref: 'Department' },
        role: { column: 'role', type: 'string', default: 'agent' }
      }
    }
  },
  hooks: {
    async preSave() {
      if (!this.isModified('password')) return;
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }
  },
  methods: {
    async comparePassword(candidatePassword) {
      return bcrypt.compare(candidatePassword, this.password);
    },
    toJSON() {
      const obj = this.toObject();
      delete obj.password;
      return obj;
    }
  }
});
