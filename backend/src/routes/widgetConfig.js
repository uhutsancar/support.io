const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const WidgetConfig = require('../models/WidgetConfig');
const Site = require('../models/Site');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
// S3 yükleyiciyi buradan çağırıyoruz
const { uploadLogo } = require('../middleware/s3Upload');

// Siteye özel config getirme
router.get('/site/:siteId', auth, async (req, res) => {
  try {
    const { siteId } = req.params;
    const orgId = req.organization?._id || req.user.organizationId;
    if (!mongoose.Types.ObjectId.isValid(siteId)) {
      return res.status(400).json({ error: 'Invalid site id' });
    }
    const site = await Site.findOne({
      _id: siteId,
      ...(orgId ? { organizationId: orgId } : {})
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
    res.status(500).json({ error: error.message });
  }
});

// Widget için public config
router.get('/public/:siteKey', async (req, res) => {
  try {
    const { siteKey } = req.params;
    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    let config = await WidgetConfig.findOne({ siteId: site._id, isActive: true });
    if (!config) {
      // Varsayılan config değerleri
      config = {
        colors: { primary: '#4F46E5', header: '#4F46E5', background: '#FFFFFF' },
        branding: { brandName: site.name || 'Support', showBrandName: true, logo: null },
        messages: { welcomeMessage: 'Hi! How can we help you today?' }
      };
    }
    res.json({ config: config.toObject ? config.toObject() : config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Config Güncelleme
router.put('/site/:siteId', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const { siteId } = req.params;
    const updates = req.body;
    
    let config = await WidgetConfig.findOne({ siteId });
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    // Dinamik güncellemeleri yapıyoruz
    Object.keys(updates).forEach(key => {
      if (typeof updates[key] === 'object' && config[key]) {
        config[key] = { ...config[key], ...updates[key] };
      } else {
        config[key] = updates[key];
      }
    });

    await config.save();
    res.json({ config });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// LOGO YÜKLEME (S3 ENTEGRASYONU)
router.post('/site/:siteId/logo', auth, checkPermission('manage_sites'), uploadLogo.single('logo'), async (req, res) => {
  try {
    const { siteId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi' });
    }

    let config = await WidgetConfig.findOne({ siteId });
    if (!config) {
      const site = await Site.findById(siteId);
      config = new WidgetConfig({
        siteId,
        organizationId: site.organizationId
      });
    }

    // S3'ten gelen tam URL'yi veritabanına yazıyoruz
    config.branding.logo = req.file.location; 
    await config.save();

    res.json({ 
      success: true,
      config, 
      logoUrl: req.file.location 
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// LOGO SİLME
router.delete('/site/:siteId/logo', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const { siteId } = req.params;
    const config = await WidgetConfig.findOne({ siteId });
    
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }

    // S3 linkini siliyoruz (S3 üzerindeki dosyayı silmek istersen ilerde ayrı bir fonksiyon ekleyebiliriz)
    config.branding.logo = null;
    await config.save();
    
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;