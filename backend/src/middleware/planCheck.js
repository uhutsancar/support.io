const requirePlan = (allowedPlans) => {
  return (req, res, next) => {
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
module.exports = { requirePlan };
