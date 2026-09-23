import express from 'express';
import { auth } from '../middleware/auth';
import { rolePermissions } from '../middleware/rbac';
import { analyticsOverview, RANGES } from '../db/analyticsQueries';
import {
  asyncHandler,
  badRequest,
  forbidden,
  loadOwnedSite,
  orgId,
  requireOrganization
} from '../http';
import type { Request, Response, NextFunction } from 'express';

const router = express.Router();

// Organization-wide reporting is not the same permission for every role in
// rolePermissions: an owner carries `view_analytics` while admins and managers
// carry `view_reports`. checkPermission only tests one name, so it would reject
// whichever half it was not given. Accepting either name keeps the middleware's
// role table as the single source of truth without renaming permissions that
// other routes already depend on.
const REPORTING_PERMISSIONS = ['view_analytics', 'view_reports'];

const canViewReports = (req: Request, _res: Response, next: NextFunction) => {
  const granted = rolePermissions[req.user?.role] || [];
  if (!REPORTING_PERMISSIONS.some((p) => granted.includes(p))) {
    throw forbidden('Insufficient role permissions');
  }
  next();
};

// Whole analytics dashboard in one request. The aggregation is always scoped to
// the caller's organization, so a permitted user still only sees their tenant.
router.get(
  '/overview',
  auth,
  requireOrganization,
  canViewReports,
  asyncHandler(async (req: Request, res: Response) => {
    const range = String(req.query.range || '7days');
    if (!RANGES[range]) {
      throw badRequest(`range must be one of: ${Object.keys(RANGES).join(', ')}`);
    }

    // An explicit site filter has to be a site this organization owns.
    const siteId = req.query.siteId ? (await loadOwnedSite(req, req.query.siteId))._id : null;

    res.json(await analyticsOverview(orgId(req), { siteId, range }));
  })
);

export default router;
