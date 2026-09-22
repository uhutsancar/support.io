import express from 'express';
import { sendError } from '../middleware/errors';
import Visitor from '../models/Visitor';
import Site from '../models/Site';
import { auth } from '../middleware/auth';
import { requirePlan } from '../middleware/planCheck';
import type { Request, Response } from 'express';
import type { Filter } from '../db/model';

const router = express.Router();
router.get('/site/:siteId', auth, requirePlan(['PRO', 'ENTERPRISE']), async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const { active } = req.query;
    const site = await Site.findById(siteId);
    if (!site || site.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ error: 'Bu siteye erişim yetkiniz yok' });
    }
    const filter: Filter = { siteId, organizationId: req.user.organizationId };
    if (active === 'true') {
       const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
       filter.isActive = true;
       filter.lastActiveAt = { $gte: fiveMinutesAgo };
    }
    const visitors = await Visitor.find(filter).sort({ lastActiveAt: -1 });
    res.json(visitors);
  } catch (error) {
    sendError(res, error);
  }
});
export default router;