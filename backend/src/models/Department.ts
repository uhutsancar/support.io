/** Membership can reference a Team agent or a User account. */
import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { SiteDoc } from './Site';
import type { TeamDoc } from './Team';
import type { UserDoc } from './User';
import type { AutoAssignRules, BusinessHours, DepartmentSla, DepartmentStats } from '../domain';

export interface DepartmentMember {
  userId: Ref<TeamDoc | UserDoc>;
  role: string;
  addedAt: Date;
}

export interface DepartmentDoc {
  name: string;
  description: string;
  requiredSkills: string[];
  siteId: Ref<SiteDoc>;
  color: string;
  icon: string;
  autoAssignRules: AutoAssignRules;
  businessHours: BusinessHours;
  sla: DepartmentSla;
  isActive: boolean;
  stats: DepartmentStats;
  members: DepartmentMember[];
}

export default defineModel<DepartmentDoc>({
  name: 'Department',
  table: 'departments',
  fields: {
    name: { column: 'name', type: 'string', required: true, trim: true },
    description: { column: 'description', type: 'string', default: '' },
    requiredSkills: {
      column: 'required_skills',
      type: 'stringArray',
      lowercase: true,
      trim: true,
      default: () => []
    },
    siteId: { column: 'site_id', type: 'id', ref: 'Site', required: true },
    color: { column: 'color', type: 'string', default: '#3B82F6' },
    icon: { column: 'icon', type: 'string', default: '💬' },
    autoAssignRules: {
      column: 'auto_assign_rules',
      type: 'json',
      default: () => ({ enabled: false, strategy: 'round-robin' })
    },
    businessHours: {
      column: 'business_hours',
      type: 'json',
      default: () => ({
        enabled: false,
        timezone: 'Europe/Istanbul',
        schedule: {
          monday: { start: '09:00', end: '18:00', enabled: true },
          tuesday: { start: '09:00', end: '18:00', enabled: true },
          wednesday: { start: '09:00', end: '18:00', enabled: true },
          thursday: { start: '09:00', end: '18:00', enabled: true },
          friday: { start: '09:00', end: '18:00', enabled: true },
          saturday: { start: '09:00', end: '18:00', enabled: false },
          sunday: { start: '09:00', end: '18:00', enabled: false }
        }
      })
    },
    sla: {
      column: 'sla',
      type: 'json',
      default: () => ({
        enabled: true,
        firstResponse: { urgent: 5, high: 15, normal: 30, low: 60 },
        resolution: { urgent: 120, high: 240, normal: 480, low: 1440 },
        onlyBusinessHours: false
      })
    },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    stats: {
      column: 'stats',
      type: 'json',
      default: () => ({
        totalConversations: 0,
        activeConversations: 0,
        averageResponseTime: 0,
        slaMetrics: {
          firstResponseMet: 0,
          firstResponseBreached: 0,
          resolutionMet: 0,
          resolutionBreached: 0,
          averageFirstResponseTime: 0,
          averageResolutionTime: 0
        }
      })
    }
  },
  children: {
    members: {
      table: 'department_members',
      parentKey: 'department_id',
      orderBy: 'added_at ASC',
      fields: {
        // Membership can reference a Team agent or a User account.
        userId: { column: 'user_id', type: 'id', refAny: ['Team', 'User'] },
        role: { column: 'role', type: 'string', default: 'agent' },
        addedAt: { column: 'added_at', type: 'date', default: () => new Date() }
      }
    }
  }
});
