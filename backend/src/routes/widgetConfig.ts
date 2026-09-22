import express from 'express';
import { sendError } from '../middleware/errors';
import { requireOrgId, callerOrgId } from '../middleware/siteAuth';
import WidgetConfig from '../models/WidgetConfig';
import Site from '../models/Site';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { uploadLogo } from '../middleware/s3Upload';
import { isValidObjectId } from '../db/objectId';
import { publicConfig } from './widget';
import type { Doc } from '../db/model';
import type { WidgetConfigDoc } from '../models/WidgetConfig';
import type { Request, Response } from 'express';

const router = express.Router();
// S3 yükleyiciyi buradan çağırıyoruz

// Siteyi ÇAĞIRANIN organizasyonu içinde çözer.
//
// PUT /site/:siteId ve logo uçları eskiden yalnızca `WidgetConfig.findOne({ siteId })`
// yapıyordu: rol izni olan herhangi bir kullanıcı, başka bir organizasyonun
// site id'sini göndererek onun widget'ını değiştirebiliyordu (IDOR). Artık her
// yazma işlemi önce siteyi kiracı sınırı içinde bulmak zorunda.
async function resolveOwnedSite(req: Request, siteId: unknown) {
  if (!isValidObjectId(siteId)) return { error: { status: 400, body: { error: 'Invalid site id', code: 'VALIDATION_ERROR' } } };
  // Organizasyonu olmayan çağıran için kiracı sınırı çizilemez, dolayısıyla
  // okuyabileceği hiçbir şey yok. Filtreyi düşürmek bütün kiracıları açardı.
  const orgId = callerOrgId(req);
  if (!orgId) return { error: { status: 403, body: { error: 'No organization for this account', code: 'NO_ORGANIZATION' } } };
  const site = await Site.findOne({ _id: siteId, organizationId: orgId });
  if (!site) return { error: { status: 404, body: { error: 'Site not found', code: 'NOT_FOUND' } } };
  return { site, orgId };
}

// Siteye özel config getirme
router.get('/site/:siteId', auth, async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const orgId = requireOrgId(req, res);
    if (!orgId) return;
    if (!isValidObjectId(siteId)) {
      return res.status(400).json({ error: 'Invalid site id' });
    }
    const site = await Site.findOne({
      _id: siteId,
      organizationId: orgId
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    let config = await WidgetConfig.findOne({ siteId });
    if (!config) {
      config = new WidgetConfig({
        siteId,
        organizationId: orgId || site.organizationId
      });
      await config.save();
    }
    res.json({ config });
  } catch (error) {
    sendError(res, error);
  }
});

// Widget için public config
router.get('/public/:siteKey', async (req: Request, res: Response) => {
  try {
    const { siteKey } = req.params;
    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    // Either the stored row or, when the site has never saved one, a partial
    // stand-in that publicConfig fills the rest of from its own defaults.
    let config: Doc<WidgetConfigDoc> | Record<string, any> | null =
      await WidgetConfig.findOne({ siteId: site._id, isActive: true });
    if (!config) {
      // Varsayılan config değerleri
      config = {
        colors: { primary: '#4F46E5', header: '#4F46E5', background: '#FFFFFF' },
        branding: { brandName: site.name || 'Support', showBrandName: true, logo: null },
        messages: { welcomeMessage: 'Hi! How can we help you today?' }
      };
    }
    res.set('Cache-Control', 'public, max-age=30');
    const plain = typeof config.toObject === 'function' ? config.toObject() : config;
    res.json({ config: publicConfig(site, plain) });
  } catch (error) {
    sendError(res, error);
  }
});

// Config Güncelleme
router.put('/site/:siteId', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;
    const allowedSections = new Set([
      'colors', 'branding', 'button', 'window', 'messages',
      'behavior', 'typography', 'advanced', 'isActive'
    ]);
    const updates = Object.fromEntries(
      Object.entries(req.body || {}).filter(([key]) => allowedSections.has(key))
    );
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid updates supplied', code: 'VALIDATION_ERROR' });
    }

    const owned = await resolveOwnedSite(req, siteId);
    if (owned.error) return res.status(owned.error.status).json(owned.error.body);

    let config = await WidgetConfig.findOne({ siteId });
    if (!config) {
      // Config henüz üretilmemişse 404 atmak yerine varsayılanlarla oluşturmak
      // doğru davranış: site var, sadece hiç kaydedilmemiş.
      config = new WidgetConfig({ siteId, organizationId: owned.orgId });
    }

    // Dinamik güncellemeleri yapıyoruz
    // Keys come from the request body, so the write goes through an index; the
    // nested merge filters prototype-polluting names before it spreads.
    const writable = config as Record<string, any>;
    Object.keys(updates).forEach((key: string) => {
      if (updates[key] && typeof updates[key] === 'object' && !Array.isArray(updates[key]) && writable[key]) {
        const safeEntries = Object.entries(updates[key]).filter(
          ([nestedKey]) => !['__proto__', 'prototype', 'constructor'].includes(nestedKey)
        );
        writable[key] = { ...writable[key], ...Object.fromEntries(safeEntries) };
      } else {
        writable[key] = updates[key];
      }
    });

    await config.save();
    res.json({ config });
  } catch (error) {
    sendError(res, error, 400);
  }
});

// LOGO YÜKLEME (S3 ENTEGRASYONU)
router.post('/site/:siteId/logo', auth, checkPermission('manage_sites'), uploadLogo.single('logo'), async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    const owned = await resolveOwnedSite(req, siteId);
    if (owned.error) return res.status(owned.error.status).json(owned.error.body);

    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi', code: 'VALIDATION_ERROR' });
    }

    let config = await WidgetConfig.findOne({ siteId });
    if (!config) {
      config = new WidgetConfig({ siteId, organizationId: owned.orgId });
    }

    // S3'ten gelen tam URL'yi veritabanına yazıyoruz
    config.branding.logo = req.file.location ?? null;
    await config.save();

    res.json({ 
      success: true,
      config, 
      logoUrl: req.file.location 
    });
  } catch (error) {
    sendError(res, error, 400);
  }
});

// LOGO SİLME
router.delete('/site/:siteId/logo', auth, checkPermission('manage_sites'), async (req: Request, res: Response) => {
  try {
    const { siteId } = req.params;

    const owned = await resolveOwnedSite(req, siteId);
    if (owned.error) return res.status(owned.error.status).json(owned.error.body);

    const config = await WidgetConfig.findOne({ siteId });
    if (!config) {
      return res.status(404).json({ error: 'Config not found', code: 'NOT_FOUND' });
    }

    // S3 linkini siliyoruz (S3 üzerindeki dosyayı silmek istersen ilerde ayrı bir fonksiyon ekleyebiliriz)
    config.branding.logo = null;
    await config.save();
    
    res.json({ config });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;