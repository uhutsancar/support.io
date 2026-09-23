// FAQs: the canned answers the widget offers before a visitor starts a chat.
//
// Two audiences in one file, with deliberately different authentication:
//   /admin/*   the dashboard, behind a session and the caller's organization
//   /search    the widget, on a customer's page, behind a site key only

import express from 'express';
import FAQ from '../models/FAQ';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { verifySiteKey } from '../middleware/siteAuth';
import {
  asyncHandler,
  badRequest,
  loadOwnedSite,
  pick,
  requireOrganization,
  requireSiteOwnership
} from '../http';
import type { Request, Response } from 'express';
import type { Doc, Filter } from '../db/model';
import type { FAQDoc } from '../models/FAQ';

const router = express.Router();

/** The fields a client may set; `siteId` is fixed at creation and never moves. */
const WRITABLE_FIELDS = [
  'question',
  'answer',
  'category',
  'keywords',
  'pageSpecific',
  'order',
  'isActive'
] as const;

/**
 * An FAQ the caller's organization owns.
 *
 * An FAQ carries no organization of its own — it hangs from a site — so
 * ownership is the site's. The update and delete handlers each wrote this out
 * separately; the delete one re-read the row it had just loaded, and the update
 * one checked for a missing row twice, the second time after it could no longer
 * be missing.
 */
const loadOwnedFaq = async (req: Request, faqId: unknown): Promise<Doc<FAQDoc>> =>
  requireSiteOwnership(req, await FAQ.findById(faqId), 'FAQ');

// ------------------------------------------------------------------ dashboard

router.get(
  '/admin/:siteId',
  auth,
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const faqs = await FAQ.find({ siteId: site._id }).sort({ order: 1, createdAt: -1 });
    res.json({ faqs });
  })
);

router.post(
  '/admin',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.body?.siteId);
    const faq = new FAQ({ ...pick<FAQDoc>(req.body, WRITABLE_FIELDS), siteId: site._id });
    await faq.save();
    res.status(201).json({ faq });
  })
);

router.put(
  '/admin/:faqId',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const updates = pick<FAQDoc>(req.body, WRITABLE_FIELDS);
    if (Object.keys(updates).length === 0) throw badRequest('No valid updates supplied');

    const faq = await loadOwnedFaq(req, req.params.faqId);
    Object.assign(faq, updates);
    await faq.save();
    res.json({ faq });
  })
);

router.delete(
  '/admin/:faqId',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const faq = await loadOwnedFaq(req, req.params.faqId);
    await faq.deleteOne();
    res.json({ message: 'FAQ deleted successfully' });
  })
);

// --------------------------------------------------------------------- widget

/** Public: called from the customer's page, authenticated by site key alone. */
router.get(
  '/search',
  verifySiteKey,
  asyncHandler(async (req: Request, res: Response) => {
    const { query, page } = req.query;

    // A page-specific FAQ shows on its own page; '*' shows everywhere. Without a
    // page the widget only gets the site-wide ones.
    const filter: Filter = {
      siteId: req.site._id,
      isActive: true,
      ...(page ? { $or: [{ pageSpecific: page }, { pageSpecific: '*' }] } : { pageSpecific: '*' })
    };

    const search = typeof query === 'string' ? query.trim() : '';
    const faqs = search
      ? await FAQ.find({ ...filter, $text: { $search: search } }, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' } })
          .limit(5)
      : await FAQ.find(filter).sort({ order: 1 }).limit(5);

    res.json({ faqs });
  })
);

export default router;
