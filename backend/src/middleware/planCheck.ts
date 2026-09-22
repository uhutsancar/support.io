import type { Request, Response, NextFunction } from 'express';

const requirePlan = (allowedPlans: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.organization) {
      return res.status(403).json({ error: 'Organizasyon bulunamadı. Lütfen giriş yapın.' });
    }
    const currentPlan = req.organization.planType || 'FREE';
    if (!allowedPlans.includes(currentPlan)) {
      return res.status(403).json({ 
        error: `Bu özelliği kullanmak için paket kodunuzu yükseltmeniz gerekmektedir. (Gereken: ${allowedPlans.join(' veya ')})`,
        code: 'PLAN_UPGRADE_REQUIRED'
      });
    }
    next();
  };
};
export { requirePlan };