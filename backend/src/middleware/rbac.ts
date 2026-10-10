// Yetki kataloğu. Bir izni yalnızca burada tanımlayın; rol listeleri buradan
// türetilir, böylece yeni bir izin eklendiğinde owner'a elle eklemeyi unutmak
// mümkün olmaz.
import { asyncMiddleware } from '../http/asyncHandler';
import { forbidden } from '../http/errors';
import { PLAN_LIMITS } from '../domain/plans';
import { hasFeature } from '../services/entitlements';
import type { Feature } from '../domain/plans';
import type { PlanType } from '../domain';
import type { NextFunction, Request, Response } from 'express';

const ALL_PERMISSIONS = [
  'manage_billing',
  'manage_plan',
  'manage_users',
  'manage_team',
  'manage_sla',
  'manage_integrations',
  'manage_sites',
  'manage_operations',
  'view_analytics',
  'view_reports',
  'view_all_tickets',
  'assign_tickets',
  'configure_system',
  'export',
  'view_assigned',
  'respond',
  'update_status',
  'team_chat',
  'crm_read',
  'crm_write',
  'crm_delete',
  'read_only'
];

// owner = organizasyon sahibi. Panelde görünen her şeyi yapabilmeli.
//
// Eski tabloda owner'da 'manage_team' YOKTU; bu yüzden sahip hesabı departman
// oluşturmaya çalıştığında "Insufficient role permissions" hatası alıyordu
// (POST /api/departments -> checkPermission('manage_team')). Aynı boşluk
// 'assign_tickets' ve 'view_all_tickets' için de vardı. Owner artık tüm izinlere
// sahip; kısıtlama plan seviyesinde yapılır, rol seviyesinde değil.
const rolePermissions: Record<string, string[]> = {
  owner: [...ALL_PERMISSIONS],
  admin: [
    'manage_operations',
    'view_all_tickets',
    'assign_tickets',
    'manage_team',
    'manage_users',
    'manage_sites',
    'manage_integrations',
    'view_reports',
    'view_analytics',
    'export',
    'team_chat',
    'crm_read',
    'crm_write',
    'crm_delete',
    'respond',
    'update_status',
    'view_assigned'
  ],
  manager: [
    'manage_team',
    'view_reports',
    'view_analytics',
    'assign_tickets',
    'view_all_tickets',
    'team_chat',
    'crm_read',
    'crm_write',
    'crm_delete',
    'respond',
    'update_status',
    'view_assigned'
  ],
  agent: ['view_assigned', 'respond', 'update_status', 'team_chat', 'crm_read', 'crm_write'],
  viewer: ['read_only', 'view_assigned', 'crm_read']
};

/**
 * What each plan unlocks, derived from domain/plans.ts. Kept as an export for
 * callers that read it; the source of truth is PLAN_LIMITS.
 */
const planFeatures: Record<PlanType, Record<string, boolean>> = {
  FREE: {
    multiUser: PLAN_LIMITS.FREE.agents > 1,
    export: PLAN_LIMITS.FREE.features.includes('export')
  },
  PRO: {
    multiUser: PLAN_LIMITS.PRO.agents > 1,
    export: PLAN_LIMITS.PRO.features.includes('export')
  },
  ENTERPRISE: {
    multiUser: PLAN_LIMITS.ENTERPRISE.agents > 1,
    export: PLAN_LIMITS.ENTERPRISE.features.includes('export')
  }
};

/** Permissions that a plan can withhold even from a role that carries them. */
const PLAN_GATED_PERMISSIONS: Record<string, Feature> = {
  export: 'export'
};

function hasPermission(role: string, permission: string): boolean {
  return (rolePermissions[role] || []).includes(permission);
}

/**
 * What a seat over the plan's limit keeps after a downgrade (BIL-04): it can
 * sign in and read, but not reply or change anything, until the owner picks
 * it or upgrades (services/planOverage.ts).
 */
const SEAT_SUSPENDED_PERMISSIONS = [
  'view_assigned',
  'view_all_tickets',
  'view_analytics',
  'view_reports',
  'read_only'
];

const SEAT_SUSPENDED = 'SEAT_SUSPENDED';

/** hasPermission for an account that may be over the plan's seats. */
function seatPermits(seatSuspended: boolean, permission: string): boolean {
  return !seatSuspended || SEAT_SUSPENDED_PERMISSIONS.includes(permission);
}

/**
 * Requires a named permission, and the plan that backs it where one applies.
 *
 * Naming the missing permission in the message is deliberate: it turns "why
 * didn't that work?" in the panel into something answerable without reading
 * the server log.
 */
const checkPermission = (permission: string) =>
  asyncMiddleware(async (req: Request, _res: Response, next: NextFunction) => {
    const userRole = req.user?.role;
    if (!userRole) throw forbidden('No role assigned');

    if (!hasPermission(userRole, permission)) {
      throw forbidden(
        `Insufficient role permissions: '${permission}' required, role '${userRole}' does not have it`
      );
    }

    if (!seatPermits(Boolean(req.user?.seatSuspendedAt), permission)) {
      throw forbidden(
        'Your seat is over the plan limit; you can read but not make changes',
        SEAT_SUSPENDED
      );
    }

    const gatedFeature = PLAN_GATED_PERMISSIONS[permission];
    if (gatedFeature && req.organization) {
      // The plan table in domain/plans.ts decides, through the entitlement
      // service, like every other plan gate.
      if (!(await hasFeature(String(req.organization._id), gatedFeature))) {
        throw forbidden('Feature not available on your plan', 'PLAN_UPGRADE_REQUIRED');
      }
    }

    next();
  });

export {
  checkPermission,
  hasPermission,
  seatPermits,
  rolePermissions,
  planFeatures,
  ALL_PERMISSIONS,
  SEAT_SUSPENDED
};
