import { hashPassword, verifyPassword } from '../config/passwords';
import { defineModel } from '../db/model';
import type { Ref } from '../db/model';
import type { OrganizationDoc } from './Organization';
import type { DepartmentDoc } from './Department';
import type { SiteDoc } from './Site';
import { PRESENCE_STATUSES, USER_ROLES } from '../domain';
import type {
  AgentStats,
  PresenceStatus,
  UserPermissions,
  UserPreferences,
  UserRole
} from '../domain';

export type { PresenceStatus, UserRole };

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
  /** When the address was proven by a link; null until then. */
  emailVerifiedAt: Date | null;
  /** Signed into every session; raising it ends them all (migration 0002). */
  sessionVersion: number;
  /** Two-step sign-in (migration 0009): the sealed TOTP secret, set while enrolling. */
  totpSecretEnc: string | null;
  /** When two-step sign-in was switched on; null while off. */
  totpEnabledAt: Date | null;
  /** Over the plan's seats after a downgrade: reads, cannot write (0015, BIL-04). */
  seatSuspendedAt: Date | null;
  /** The last 30-second step a code was accepted for; replays are refused. */
  totpLastStep: number | null;
  /** The connected Google account's subject id, and its address for display (0021). */
  googleSub: string | null;
  googleEmail: string | null;
  /** Keyed hashes of the unused recovery codes. */
  recoveryCodes: string[];
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
    role: { column: 'role', type: 'string', enum: USER_ROLES, default: 'agent' },
    avatar: { column: 'avatar', type: 'string', default: null },
    isActive: { column: 'is_active', type: 'boolean', default: true },
    isOnboarded: { column: 'is_onboarded', type: 'boolean', default: false },
    emailVerifiedAt: { column: 'email_verified_at', type: 'date', default: null },
    sessionVersion: { column: 'session_version', type: 'number', default: 0 },
    totpSecretEnc: { column: 'totp_secret_enc', type: 'string', default: null },
    totpEnabledAt: { column: 'totp_enabled_at', type: 'date', default: null },
    seatSuspendedAt: { column: 'seat_suspended_at', type: 'date', default: null },
    totpLastStep: { column: 'totp_last_step', type: 'number', default: null },
    recoveryCodes: { column: 'recovery_codes', type: 'json', default: () => [] },
    googleSub: { column: 'google_sub', type: 'string', default: null },
    googleEmail: { column: 'google_email', type: 'string', default: null },
    organizationId: { column: 'organization_id', type: 'id', ref: 'Organization', default: null },
    status: { column: 'status', type: 'string', enum: PRESENCE_STATUSES, default: 'offline' },
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
      default: () => ({
        autoAcceptAssignments: true,
        maxActiveConversations: 10,
        notificationSound: true
      })
    },
    stats: {
      column: 'stats',
      type: 'json',
      default: () => ({
        totalConversations: 0,
        activeConversations: 0,
        resolvedConversations: 0,
        averageResponseTime: 0
      })
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
    },
    // The Team model has always done this; User did not, so any handler that
    // returned a user document whole — rather than picking fields by hand —
    // serialised the bcrypt hash into the response body. Both account tables
    // now behave the same way, so the safe behaviour no longer depends on
    // every call site remembering to project the column away.
    toJSON() {
      const obj = this.toObject();
      delete obj.password;
      delete obj.totpSecretEnc;
      delete obj.totpLastStep;
      delete obj.recoveryCodes;
      delete obj.googleSub;
      return obj;
    }
  }
});
