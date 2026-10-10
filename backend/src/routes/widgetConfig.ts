// The widget's appearance and behaviour, per site.
//
// Two audiences again: the dashboard edits the stored row, and the widget on a
// customer's page reads a reduced, whitelisted view of it (`publicConfig` in
// ./widget.ts) that carries no internal fields.

import { forgetSiteBundle } from '../services/widgetBundle';
import express from 'express';
import events from '../events';
import WidgetConfig from '../models/WidgetConfig';
import { auth } from '../middleware/auth';
import { requireWidgetSession } from '../middleware/widgetSession';
import { checkPermission } from '../middleware/rbac';
import {
  deleteStoredFiles,
  reserveUploadIngress,
  storedKeyFromUrl,
  storeUpload,
  uploadLogo
} from '../middleware/upload';
import { publicConfig } from './widget';
import {
  asyncHandler,
  asyncMiddleware,
  badRequest,
  loadAccessibleSite,
  loadOwnedSite,
  notFound,
  orgId,
  requireOrganization
} from '../http';
import type { NextFunction, Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { SiteDoc } from '../models/Site';
import type { WidgetConfigDoc } from '../models/WidgetConfig';
import { widgetConfigUpdates } from '../security/widgetConfigSchema';

const router = express.Router();

const logoSite = asyncMiddleware(async (req: Request, _res: Response, next: NextFunction) => {
  req.site = await loadOwnedSite(req, req.params.siteId);
  next();
});

/**
 * The site's configuration row, created with defaults the first time it is asked for.
 *
 * A site always has a config conceptually — the widget renders from defaults
 * until one is saved — so a missing row is created rather than reported as 404.
 * Callers must have resolved `site` through `loadOwnedSite` first: this function
 * performs no ownership check of its own.
 */
async function configForSite(
  site: Doc<SiteDoc>,
  organizationId: string
): Promise<Doc<WidgetConfigDoc>> {
  const existing = await WidgetConfig.findOne({ siteId: site._id });
  if (existing) return existing;
  return new WidgetConfig({ siteId: site._id, organizationId });
}

// ------------------------------------------------------------------ dashboard

router.get(
  '/site/:siteId',
  auth,
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadAccessibleSite(req, req.params.siteId);
    const config = await configForSite(site, orgId(req));
    if (config.$isNew) await config.save();
    res.json({ config });
  })
);

router.put(
  '/site/:siteId',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const updates = widgetConfigUpdates(req.body);

    // The ownership check comes first. Earlier versions looked the config up by
    // `siteId` alone, so anyone with `manage_sites` in any organization could
    // rewrite another tenant's widget by sending its site id.
    const site = await loadOwnedSite(req, req.params.siteId);
    const config = await configForSite(site, orgId(req));

    // A section is merged rather than replaced, so editing one colour does not
    // blank the rest of the palette.
    const writable = config as unknown as Record<string, unknown>;
    for (const [section, value] of Object.entries(updates)) {
      const isMergeable =
        value && typeof value === 'object' && !Array.isArray(value) && writable[section];
      writable[section] = isMergeable
        ? {
            ...(writable[section] as object),
            ...(value as object)
          }
        : value;
    }

    await config.save();
    await forgetSiteBundle(site._id);
    // Which sections changed, not their contents.
    events.emit('site.widget.updated', {
      organizationId: orgId(req),
      userId: req.user?._id ?? null,
      entityId: site._id,
      metadata: { sections: Object.keys(updates) },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    res.json({ config });
  })
);

router.post(
  '/site/:siteId/logo',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  logoSite,
  reserveUploadIngress,
  uploadLogo.single('logo'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = req.site;
    if (!req.file) throw badRequest('No file was uploaded', 'UPLOAD_FAILED');

    // Checked and re-encoded like every image (middleware/upload.ts); a
    // logo is public by nature and is stored as such.
    const stored = await storeUpload(req, req.file, { kind: 'logo' });

    const config = await configForSite(site, orgId(req));
    const previousLogo = storedKeyFromUrl(config.branding.logo);
    config.branding.logo = stored.url;
    await config.save();
    await forgetSiteBundle(site._id);
    if (previousLogo) await deleteStoredFiles([previousLogo]);

    res.json({ success: true, config, logoUrl: stored.url });
  })
);

router.delete(
  '/site/:siteId/logo',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);

    const config = await WidgetConfig.findOne({ siteId: site._id });
    if (!config) throw notFound('Config');

    const previousLogo = storedKeyFromUrl(config.branding.logo);
    config.branding.logo = null;
    await config.save();
    await forgetSiteBundle(site._id);
    if (previousLogo) await deleteStoredFiles([previousLogo]);
    res.json({ config });
  })
);

// --------------------------------------------------------------------- widget

/**
 * The widget's public look, for a page holding a widget session. The widget
 * itself receives this inside POST /api/widget/session; this is for
 * integrations that re-read it later.
 */
router.get(
  '/public',
  requireWidgetSession,
  asyncHandler(async (req: Request, res: Response) => {
    const site = req.site;

    // A site that has never saved a config still gets a usable widget:
    // `publicConfig` fills every section from its own defaults.
    const saved = await WidgetConfig.findOne({ siteId: site._id, isActive: true });

    res.json({ config: publicConfig(site, saved ? saved.toObject() : null) });
  })
);

export default router;
