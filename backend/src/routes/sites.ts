// Sites: the customer domains a tenant installs the widget on.
//
// Every handler here is scoped to the caller's organization. That is enforced
// by the router-level `requireOrganization` below plus `loadOwnedSite`, not by
// each handler remembering to filter — see src/http/guards.ts for why.

import express from 'express';
import { randomUUID } from 'crypto';
import Site from '../models/Site';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import {
  asyncHandler,
  loadOwnedSite,
  notFound,
  orgId,
  pickStrict,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';
import type { SiteDoc } from '../models/Site';

const router = express.Router();

// Applied once instead of in each handler: a signed-in account with no
// organization has nothing to read or write here.
router.use(auth, requireOrganization);

/** The fields a client may set on a site; everything else is server-owned. */
const WRITABLE_FIELDS = ['name', 'domain', 'widgetSettings', 'aiSettings', 'isActive'] as const;

/** Nested settings are merged rather than replaced, so a partial update of one
 *  key does not blank out the rest of the object. */
const MERGED_FIELDS = new Set<string>(['widgetSettings', 'aiSettings']);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const sites = await Site.find({ organizationId: orgId(req) }).sort({ createdAt: -1 });
    res.json({ sites });
  })
);

router.post(
  '/',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, domain } = req.body;
    const site = new Site({
      name,
      domain,
      siteKey: randomUUID(),
      userId: req.user._id,
      organizationId: orgId(req)
    });
    await site.save();
    res.status(201).json({ site });
  })
);

router.get(
  '/:siteId',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    res.json({ site });
  })
);

router.put(
  '/:siteId',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    // `pickStrict` rejects an unknown key rather than dropping it, which is what
    // this endpoint did before — a caller sending a field this route does not own
    // gets told so instead of watching it vanish.
    const updates = pickStrict<SiteDoc>(req.body, WRITABLE_FIELDS);

    const site = await loadOwnedSite(req, req.params.siteId);
    const writable = site as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(updates)) {
      writable[key] = MERGED_FIELDS.has(key)
        ? { ...(writable[key] as object), ...(value as object) }
        : value;
    }
    await site.save();
    res.json({ site });
  })
);

router.delete(
  '/:siteId',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await Site.findOneAndDelete({
      _id: req.params.siteId,
      organizationId: orgId(req)
    });
    if (!site) throw notFound('Site');
    res.json({ message: 'Site deleted successfully' });
  })
);

router.post(
  '/:siteId/regenerate-key',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    site.siteKey = randomUUID();
    await site.save();
    res.json({ site });
  })
);

export default router;
