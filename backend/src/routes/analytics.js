const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const { rolePermissions } = require('../middleware/rbac');
const { findOwnedSite } = require('../middleware/siteAuth');
const { analyticsOverview, RANGES } = require('../db/analyticsQueries');

// Organization-wide reporting is not the same permission for every role in
// rolePermissions: an owner carries `view_analytics` while admins and managers
// carry `view_reports`. checkPermission only tests one name, so it would reject
// whichever half it was not given. Accepting either name keeps the middleware's
// role table as the single source of truth without renaming permissions that
// other routes already depend on.
const REPORTING_PERMISSIONS = ['view_analytics', 'view_reports'];

const canViewReports = (req, res, next) => {
  const granted = rolePermissions[req.user?.role] || [];
  if (!REPORTING_PERMISSIONS.some((p) => granted.includes(p))) {
    return res.status(403).json({ error: 'Insufficient role permissions' });
  }
  next();
};

// Whole analytics dashboard in one request. The aggregation is always scoped to
// the caller's organization, so a permitted user still only sees their tenant.
router.get('/overview', auth, canViewReports, async (req, res) => {
  try {
    const organizationId = req.organization?._id || req.user.organizationId;
    if (!organizationId) {
      return res.status(400).json({ error: 'No organization context' });
    }

    const range = String(req.query.range || '7days');
    if (!RANGES[range]) {
      return res.status(400).json({
        error: `range must be one of: ${Object.keys(RANGES).join(', ')}`
      });
    }

    // An explicit site filter has to be a site this organization owns.
    let siteId = null;
    if (req.query.siteId) {
      const site = await findOwnedSite(req, req.query.siteId);
      if (!site) return res.status(404).json({ error: 'Site not found' });
      siteId = site._id;
    }

    const data = await analyticsOverview(organizationId, { siteId, range });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
