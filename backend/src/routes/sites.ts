import express from 'express';
import { requireOrgId } from '../middleware/siteAuth';
import { sendError } from '../middleware/errors';
import { randomUUID } from 'crypto';
import Site from '../models/Site';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import type { Request, Response } from 'express';

const router = express.Router();
router.get('/', auth, async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const sites = await Site.find({ organizationId: orgId }).sort({ createdAt: -1 });
    res.json({ sites });
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const { name, domain } = req.body;
    // Organizasyonu olmayan bir çağırana burada sessizce şirket açılıyordu;
    // kiracılık kayıt ve girişte kurulur, site oluşturmanın yan etkisi değil.
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = new Site({
      name,
      domain,
      siteKey: randomUUID(),
      userId: req.user._id,
      organizationId: orgId
    });
    await site.save();
    res.status(201).json({ site });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.get('/:siteId', auth, async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({
      _id: req.params.siteId,
      organizationId: orgId
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json({ site });
  } catch (error) {
    sendError(res, error);
  }
});
router.put('/:siteId', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const updates = req.body;
    const allowedUpdates = ['name', 'domain', 'widgetSettings', 'aiSettings', 'isActive'];
    const updateKeys = Object.keys(updates);
    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates' });
    }
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({
      _id: req.params.siteId,
      organizationId: orgId
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    // The allow-list above decides which keys reach the row, so the write goes
    // through an index rather than a fixed property.
    const writable = site as Record<string, any>;
    updateKeys.forEach((key: string) => {
      if (key === 'widgetSettings' || key === 'aiSettings') {
        writable[key] = { ...writable[key], ...updates[key] };
      } else {
        writable[key] = updates[key];
      }
    });
    await site.save();
    res.json({ site });
  } catch (error) {
    sendError(res, error, 400);
  }
});
router.delete('/:siteId', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOneAndDelete({
      _id: req.params.siteId,
      organizationId: orgId
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    sendError(res, error);
  }
});
router.post('/:siteId/regenerate-key', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    const site = await Site.findOne({
      _id: req.params.siteId,
      organizationId: orgId
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    site.siteKey = randomUUID();
    await site.save();
    res.json({ site });
  } catch (error) {
    sendError(res, error);
  }
});
export default router;