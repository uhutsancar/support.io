// Live visitors on a site, for the dashboard's presence list.

import express from 'express';
import Visitor from '../models/Visitor';
import { auth } from '../middleware/auth';
import { requirePlan } from '../middleware/planCheck';
import { asyncHandler, loadOwnedSite, orgId, requireOrganization } from '../http';
import type { Request, Response } from 'express';
import type { Filter } from '../db/model';

const router = express.Router();

/** How recently a visitor must have been seen to count as "here now". */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

router.get(
  '/site/:siteId',
  auth,
  requireOrganization,
  requirePlan(['PRO', 'ENTERPRISE']),
  asyncHandler(async (req: Request, res: Response) => {
    // This handler used to read `req.user.organizationId` directly and compare
    // it with `.toString()`. For an account with no organization that threw on
    // null and came back as a 500; `requireOrganization` answers 403 before the
    // handler runs, and `loadOwnedSite` does the ownership check.
    const site = await loadOwnedSite(req, req.params.siteId);

    const filter: Filter = { siteId: site._id, organizationId: orgId(req) };
    if (req.query.active === 'true') {
      filter.isActive = true;
      filter.lastActiveAt = { $gte: new Date(Date.now() - ACTIVE_WINDOW_MS) };
    }

    const visitors = await Visitor.find(filter).sort({ lastActiveAt: -1 });
    res.json(visitors);
  })
);

export default router;
