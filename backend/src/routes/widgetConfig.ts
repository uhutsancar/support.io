// The widget's appearance and behaviour, per site.
//
// Two audiences again: the dashboard edits the stored row, and the widget on a
// customer's page reads a reduced, whitelisted view of it (`publicConfig` in
// ./widget.ts) that carries no internal fields.

import express from 'express';
import WidgetConfig from '../models/WidgetConfig';
import Site from '../models/Site';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { describeUpload, uploadLogo } from '../middleware/upload';
import { publicConfig } from './widget';
import {
  asyncHandler,
  badRequest,
  loadOwnedSite,
  notFound,
  orgId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { SiteDoc } from '../models/Site';
import type { WidgetConfigDoc } from '../models/WidgetConfig';

const router = express.Router();

/** The sections a client may edit. Everything else on the row is server-owned. */
const EDITABLE_SECTIONS = new Set([
  'colors',
  'branding',
  'button',
  'window',
  'messages',
  'behavior',
  'typography',
  'advanced',
  'isActive'
]);

/** Names that must never be merged into an object; see middleware/sanitize.ts. */
const POLLUTING_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

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
    const site = await loadOwnedSite(req, req.params.siteId);
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
    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => EDITABLE_SECTIONS.has(key))
    );
    if (Object.keys(updates).length === 0) throw badRequest('No valid updates supplied');

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
            ...Object.fromEntries(
              Object.entries(value as object).filter(([key]) => !POLLUTING_KEYS.has(key))
            )
          }
        : value;
    }

    await config.save();
    res.json({ config });
  })
);

router.post(
  '/site/:siteId/logo',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  uploadLogo.single('logo'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    if (!req.file) throw badRequest('Dosya yüklenemedi');

    const stored = describeUpload(req, req.file);
    if (!stored) throw badRequest('Logo yüklenemedi');

    const config = await configForSite(site, orgId(req));
    config.branding.logo = stored.url;
    await config.save();

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

    // Only the reference is dropped; the object itself stays in the bucket.
    config.branding.logo = null;
    await config.save();
    res.json({ config });
  })
);

// --------------------------------------------------------------------- widget

/** Public: read by the widget on a customer's page, keyed by the site key alone. */
router.get(
  '/public/:siteKey',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await Site.findOne({ siteKey: req.params.siteKey, isActive: true });
    if (!site) throw notFound('Site');

    // A site that has never saved a config still gets a usable widget:
    // `publicConfig` fills every section from its own defaults.
    const saved = await WidgetConfig.findOne({ siteId: site._id, isActive: true });

    res.set('Cache-Control', 'public, max-age=30');
    res.json({ config: publicConfig(site, saved ? saved.toObject() : null) });
  })
);

export default router;
