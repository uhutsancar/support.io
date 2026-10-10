// The help center (plan v10 PRD-10).
//
//   GET /help/:slug              the public page (no session; ?q= searches)
//   GET /api/sites/:id/help-center    the owner's settings, with a suggested address
//   PUT /api/sites/:id/help-center    { enabled, slug, noindex, title, language }
//
// The page is public and cheap to ask for, so it is counted per IP like the
// rest of the public surface, and an unknown or switched-off address is a
// plain 404 that says nothing about which sites exist.

import express from 'express';
import events from '../events';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { createLimiter } from '../middleware/rateLimit';
import { query } from '../db/pool';
import {
  HELP_SLUG,
  helpCenterSettings,
  renderHelpCenter,
  siteForHelpSlug,
  suggestSlug
} from '../services/helpCenter';
import {
  asyncHandler,
  badRequest,
  conflict,
  loadAccessibleSite,
  loadOwnedSite,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';

/** The base the page's own links and canonical address use. */
const baseOf = (req: Request) =>
  String(process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

const pageLimiter = createLimiter({
  name: 'help-center',
  code: 'TOO_MANY_REQUESTS',
  message: 'Too many requests, please try again later.',
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 120 : 100000
});

export const helpPages = express.Router();

helpPages.get(
  '/help/:slug',
  pageLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const site = await siteForHelpSlug(String(req.params.slug || ''));
    if (!site) {
      res.status(404).type('text/plain').send('Not found');
      return;
    }
    const search = typeof req.query.q === 'string' ? req.query.q : '';
    const html = await renderHelpCenter(site, { search, base: baseOf(req) });
    res
      .set('Cache-Control', search ? 'no-store' : 'public, max-age=60')
      .type('html')
      .send(html);
  })
);

// ------------------------------------------------------- owner's settings

export const helpSettings = express.Router();
helpSettings.use(auth, requireOrganization);

helpSettings.get(
  '/:siteId/help-center',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadAccessibleSite(req, req.params.siteId);
    res.json({
      settings: helpCenterSettings(site.helpCenter),
      slug: site.helpSlug,
      suggestedSlug: site.helpSlug ?? suggestSlug(site.name)
    });
  })
);

helpSettings.put(
  '/:siteId/help-center',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const current = helpCenterSettings(site.helpCenter);
    const settings = helpCenterSettings({
      enabled: typeof body.enabled === 'boolean' ? body.enabled : current.enabled,
      noindex: typeof body.noindex === 'boolean' ? body.noindex : current.noindex,
      title: typeof body.title === 'string' ? body.title : current.title,
      language: body.language === 'en' || body.language === 'tr' ? body.language : current.language
    });

    let slug = site.helpSlug;
    if (typeof body.slug === 'string' && body.slug.trim().toLowerCase() !== (slug ?? '')) {
      const wanted = body.slug.trim().toLowerCase();
      if (!HELP_SLUG.test(wanted)) {
        throw badRequest('The address is 3-40 lower-case letters, digits and hyphens');
      }
      const taken = await query('SELECT 1 FROM sites WHERE lower(help_slug) = $1 AND id <> $2', [
        wanted,
        site._id
      ]);
      if (taken.rowCount) throw conflict('This address is taken', 'HELP_SLUG_TAKEN');
      slug = wanted;
    }
    if (settings.enabled && !slug) throw badRequest('Choose an address first');

    site.helpSlug = slug;
    site.helpCenter = settings as unknown as Record<string, unknown>;
    try {
      await site.save();
    } catch (error) {
      // Two owners picking one address at the same moment: the index decides.
      if ((error as { code?: string }).code === '23505') {
        throw conflict('This address is taken', 'HELP_SLUG_TAKEN');
      }
      throw error;
    }
    events.emit('site.updated', {
      organizationId: String(site.organizationId),
      userId: req.user._id,
      entityId: site._id,
      metadata: { fields: ['helpCenter'] },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    res.json({ settings, slug, suggestedSlug: slug ?? suggestSlug(site.name) });
  })
);
