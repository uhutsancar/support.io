// Plan gating.
//
// Roles answer "may this person do it"; plans answer "is it part of what this
// organization bought". Both have to pass, and they are separate middlewares so
// a route states each one explicitly.
//
// Prefer `requireFeature` (services/entitlements.ts), which names the
// capability rather than the plans that happen to include it today; this
// remains for a route that genuinely means a plan.

import { forbidden } from '../http/errors';
import { asyncMiddleware } from '../http/asyncHandler';
import { getPlan } from '../services/entitlements';
import type { PlanType } from '../domain';
import type { NextFunction, Request, Response } from 'express';

const requirePlan = (allowedPlans: readonly PlanType[]) =>
  asyncMiddleware(async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.organization) {
      throw forbidden('Organizasyon bulunamadı. Lütfen giriş yapın.', 'NO_ORGANIZATION');
    }

    const currentPlan = await getPlan(String(req.organization._id));
    if (!allowedPlans.includes(currentPlan)) {
      throw forbidden(
        `Bu özelliği kullanmak için paketinizi yükseltmeniz gerekiyor. (Gereken: ${allowedPlans.join(' veya ')})`,
        'PLAN_UPGRADE_REQUIRED'
      );
    }

    next();
  });

export { requirePlan };
