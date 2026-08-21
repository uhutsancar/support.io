const Organization = require('../models/Organization');

// Yetki kataloğu. Bir izni yalnızca burada tanımlayın; rol listeleri buradan
// türetilir, böylece yeni bir izin eklendiğinde owner'a elle eklemeyi unutmak
// mümkün olmaz.
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
const rolePermissions = {
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

const planFeatures = {
  FREE: { multiUser: false, advancedAnalytics: false, export: false, apiAccess: false },
  PRO: { multiUser: true, advancedAnalytics: true, export: true, apiAccess: true },
  ENTERPRISE: { multiUser: true, advancedAnalytics: true, export: true, apiAccess: true }
};

function hasPermission(role, permission) {
  return (rolePermissions[role] || []).includes(permission);
}

const checkPermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userRole = req.user?.role;
      if (!userRole) {
        return res.status(403).json({
          error: 'No role assigned',
          code: 'FORBIDDEN'
        });
      }
      if (!hasPermission(userRole, permission)) {
        // Hangi iznin eksik olduğunu söylemek, panelde "neden olmadı"
        // sorusunu ayıklanabilir hale getirir.
        return res.status(403).json({
          error: `Insufficient role permissions: '${permission}' required, role '${userRole}' does not have it`,
          code: 'FORBIDDEN',
          requiredPermission: permission,
          role: userRole
        });
      }
      if (req.organization) {
        const org = await Organization.findById(req.organization._id);
        const plan = org?.planType || 'FREE';
        const features = planFeatures[plan] || planFeatures.FREE;
        if (permission === 'export' && !features.export) {
          return res.status(403).json({
            error: 'Feature not available on your plan',
            code: 'PLAN_UPGRADE_REQUIRED'
          });
        }
      }
      next();
    } catch (err) {
      res.status(500).json({ error: err.message, code: 'INTERNAL_ERROR' });
    }
  };
};

module.exports = { checkPermission, hasPermission, rolePermissions, planFeatures, ALL_PERMISSIONS };
