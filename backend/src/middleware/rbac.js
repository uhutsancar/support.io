const Organization = require('../models/Organization');
const rolePermissions = {
  owner: ['manage_billing','manage_plan','manage_users','manage_sla','manage_integrations','view_analytics','configure_system','manage_sites'],
  admin: ['manage_operations','view_all_tickets','assign_tickets','manage_team','manage_users','view_reports','manage_sites'],
  manager: ['manage_team','view_reports','assign_tickets'],
  agent: ['view_assigned','respond','update_status','team_chat'],
  viewer: ['read_only']
};
const planFeatures = {
  FREE: {
    multiUser: false,
    advancedAnalytics: false,
    export: false,
    apiAccess: false
  },
  PRO: {
    multiUser: true,
    advancedAnalytics: true,
    export: true,
    apiAccess: true
  },
  ENTERPRISE: {
    multiUser: true,
    advancedAnalytics: true,
    export: true,
    apiAccess: true
  }
};
const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) return res.status(403).json({ error: 'No role assigned' });
      const permissions = rolePermissions[userRole] || [];
      if (!permissions.includes(permission)) {
        return res.status(403).json({ error: 'Insufficient role permissions' });
      }
      if (req.organization) {
        const org = await Organization.findById(req.organization._id);
        const plan = org?.planType || 'FREE';
        const features = planFeatures[plan] || planFeatures.FREE;
        if (permission === 'export' && !features.export) {
          return res.status(403).json({ error: 'Feature not available on your plan' });
        }
      }
      next();
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
};
module.exports = { checkPermission, rolePermissions, planFeatures };
