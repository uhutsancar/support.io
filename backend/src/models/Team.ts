import { hashPassword, verifyPassword } from '../config/passwords';
import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';
import type { DepartmentDoc } from './Department';
import type { SiteDoc } from './Site';
import type { AgentStats, TeamPermissions } from '../types/domain';

export type TeamRole = 'admin' | 'manager' | 'agent';
export type TeamStatus = 'online' | 'offline' | 'away' | 'busy';

export interface TeamDepartmentMembership {
  departmentId: Ref<DepartmentDoc>;
  role: string;
}

export interface TeamDoc {
  email: string;
  password: string;
  name: string;
  role: TeamRole;
  avatar: string | null;
  organizationId: Ref<OrganizationDoc> | null;
  isActive: boolean;
  status: TeamStatus;
  skills: string[];
  maxCapacity: number;
  currentLoad: number;
  permissions: TeamPermissions;
  stats: AgentStats;
  lastActive: Date;
  phone: string | null;
  bio: string | null;
  assignedSites: Array<Ref<SiteDoc>>;
  departments: TeamDepartmentMembership[];
  /** Added by the model's own methods. */
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export default defineModel<TeamDoc>({
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
      this.password = await hashPassword(this.password);
    }
  },
  methods: {
    async comparePassword(candidatePassword: string) {
      return verifyPassword(candidatePassword, this.password);
    },
    toJSON() {
      const obj = this.toObject();
      delete obj.password;
      return obj;
    }
  }
});
