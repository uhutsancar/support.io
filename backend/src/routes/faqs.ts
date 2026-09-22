import express from 'express';
import { sendError } from '../middleware/errors';
import FAQ from '../models/FAQ';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import Site from '../models/Site';
import { verifySiteKey } from '../middleware/siteAuth';
import { requireOrgId } from '../middleware/siteAuth';
import type { Request, Response } from 'express';
import type { Filter } from '../db/model';

const router = express.Router();
router.get('/admin/:siteId', auth, async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({
      _id: req.params.siteId,
      organizationId: orgId
    });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const faqs = await FAQ.find({ siteId: req.params.siteId }).sort({ order: 1, createdAt: -1 });
    res.json({ faqs });
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/admin', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const { siteId, question, answer, category, keywords, pageSpecific, order } = req.body;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({ _id: siteId, organizationId: orgId });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    const faq = new FAQ({
      siteId,
      question,
      answer,
      category,
      keywords,
      pageSpecific,
      order
    });
    await faq.save();
    res.status(201).json({ faq });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.put('/admin/:faqId', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const allowedUpdates = ['question', 'answer', 'category', 'keywords', 'pageSpecific', 'order', 'isActive'];
    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => allowedUpdates.includes(key))
    );
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates supplied' });
    }
    const faq = await FAQ.findById(req.params.faqId);
    if (!faq) return res.status(404).json({ error: 'FAQ not found' });
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({ _id: faq.siteId, organizationId: orgId });
    if (!site) return res.status(404).json({ error: 'FAQ not found' });
    Object.assign(faq, updates);
    await faq.save();
    if (!faq) {
      return res.status(404).json({ error: 'FAQ not found' });
    }
    res.json({ faq });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.delete('/admin/:faqId', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const faq = await FAQ.findById(req.params.faqId);
    if (!faq) return res.status(404).json({ error: 'FAQ not found' });
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({ _id: faq.siteId, organizationId: orgId });
    if (!site) return res.status(404).json({ error: 'FAQ not found' });
    await FAQ.findByIdAndDelete(req.params.faqId);
    res.json({ message: 'FAQ deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
});
router.get('/search', verifySiteKey, async (req: Request, res: Response) => {
  try {
    const { query, page } = req.query;
    const filter: Filter = {
      siteId: req.site._id,
      isActive: true
    };
    if (page) {
      filter.$or = [
        { pageSpecific: page },
        { pageSpecific: '*' }
      ];
    } else {
      filter.pageSpecific = '*';
    }
    let faqs;
    if (query && String(query).trim()) {
      faqs = await FAQ.find({
        ...filter,
        $text: { $search: query }
      }, {
        score: { $meta: 'textScore' }
      }).sort({ score: { $meta: 'textScore' } }).limit(5);
    } else {
      faqs = await FAQ.find(filter).sort({ order: 1 }).limit(5);
    }
    res.json({ faqs });
  } catch (error) {
    sendError(res, error);
  }
});
export default router;