import { hashPassword, verifyPassword } from '../config/passwords';
import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';
import type { DepartmentDoc } from './Department';
import type { SiteDoc } from './Site';
import type { AgentStats, UserPermissions, UserPreferences } from '../types/domain';

export type UserRole = 'owner' | 'admin' | 'manager' | 'agent' | 'viewer';
export type PresenceStatus = 'online' | 'offline' | 'busy' | 'away';

/** A department a user belongs to, with the role held there. */
export interface UserDepartmentMembership {
  departmentId: Ref<DepartmentDoc>;
  role: string;
}

export interface UserDoc {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
  isOnboarded: boolean;
  organizationId: Ref<OrganizationDoc> | null;
  status: PresenceStatus;
  permissions: UserPermissions;
  preferences: UserPreferences;
  stats: Omit<AgentStats, 'satisfactionRate'>;
  assignedSites: Array<Ref<SiteDoc>>;
  departments: UserDepartmentMembership[];
  /** Added by the model's own methods. */
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export default defineModel<UserDoc>({
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
      this.password = await hashPassword(this.password);
    }
  },
  methods: {
    async comparePassword(candidatePassword: string) {
      return verifyPassword(candidatePassword, this.password);
    }
  }
});
