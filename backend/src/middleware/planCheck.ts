// Plan gating.
//
// Roles answer "may this person do it"; plans answer "is it part of what this
// organization bought". Both have to pass, and they are separate middlewares so
// a route states each one explicitly.

import { forbidden } from '../http/errors';
import type { PlanType } from '../domain';
import type { NextFunction, Request, Response } from 'express';

const requirePlan =
  (allowedPlans: readonly PlanType[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.organization) {
      throw forbidden('Organizasyon bulunamadı. Lütfen giriş yapın.', 'NO_ORGANIZATION');
    }

    const currentPlan = (req.organization.planType || 'FREE') as PlanType;
    if (!allowedPlans.includes(currentPlan)) {
      throw forbidden(
        `Bu özelliği kullanmak için paketinizi yükseltmeniz gerekiyor. (Gereken: ${allowedPlans.join(' veya ')})`,
        'PLAN_UPGRADE_REQUIRED'
      );
    }

    next();
  };

export { requirePlan };
