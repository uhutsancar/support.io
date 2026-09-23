// Yetki kataloğu. Bir izni yalnızca burada tanımlayın; rol listeleri buradan
// türetilir, böylece yeni bir izin eklendiğinde owner'a elle eklemeyi unutmak
// mümkün olmaz.
import Organization from '../models/Organization';
import { asyncMiddleware } from '../http/asyncHandler';
import { forbidden } from '../http/errors';
import { PLAN_TYPES } from '../domain';
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
    'respond',
    'update_status',
    'view_assigned'
  ],
  agent: ['view_assigned', 'respond', 'update_status', 'team_chat'],
  viewer: ['read_only', 'view_assigned']
};

/** What each plan unlocks. Roles say who may act; plans say what is available. */
const planFeatures: Record<PlanType, Record<string, boolean>> = {
  FREE: { multiUser: false, advancedAnalytics: false, export: false, apiAccess: false },
  PRO: { multiUser: true, advancedAnalytics: true, export: true, apiAccess: true },
  ENTERPRISE: { multiUser: true, advancedAnalytics: true, export: true, apiAccess: true }
};

/** Permissions that a plan can withhold even from a role that carries them. */
const PLAN_GATED_PERMISSIONS: Record<string, keyof (typeof planFeatures)['FREE']> = {
  export: 'export'
};

function hasPermission(role: string, permission: string): boolean {
  return (rolePermissions[role] || []).includes(permission);
}

/** The plan an organization is on, defaulting to FREE for anything unknown. */
function planOf(planType: unknown): PlanType {
  return (PLAN_TYPES as readonly string[]).includes(planType as string)
    ? (planType as PlanType)
    : 'FREE';
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

    const gatedFeature = PLAN_GATED_PERMISSIONS[permission];
    if (gatedFeature && req.organization) {
      const org = await Organization.findById(req.organization._id);
      if (!planFeatures[planOf(org?.planType)][gatedFeature]) {
        throw forbidden('Feature not available on your plan', 'PLAN_UPGRADE_REQUIRED');
      }
    }

    next();
  });

export { checkPermission, hasPermission, rolePermissions, planFeatures, ALL_PERMISSIONS };
