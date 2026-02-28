const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const WidgetConfig = require('../models/WidgetConfig');
const Site = require('../models/Site');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/logos');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `logo-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});
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
router.get('/public/:siteKey', async (req, res) => {
  try {
    const { siteKey } = req.params;
    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    let config = await WidgetConfig.findOne({ siteId: site._id, isActive: true });
    if (!config) {
      config = {
        colors: {
          primary: '#4F46E5',
          header: '#4F46E5',
          background: '#FFFFFF',
          text: '#1F2937',
          textSecondary: '#6B7280',
          border: '#E5E7EB',
          visitorMessageBg: '#4F46E5',
          agentMessageBg: '#F3F4F6'
        },
        branding: {
          brandName: site.name || 'Support',
          showBrandName: true
        },
        button: {
          position: 'bottom-right',
          size: 'medium'
        },
        messages: {
          welcomeMessage: '',
          placeholderText: 'Type your message...'
        },
        behavior: {
          autoOpen: false,
          autoOpenDelay: 5000
        }
      };
    }
    res.json({ config: config.toObject ? config.toObject() : config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.put('/site/:siteId', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const { siteId } = req.params;
    const orgId = req.organization?._id || req.user.organizationId;
    const updates = req.body;
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
        organizationId: orgId || site.organizationId,
        ...updates
      });
    } else {
      if (updates.colors && typeof updates.colors === 'object') {
        config.colors = { ...config.colors, ...updates.colors };
      }
      if (updates.branding && typeof updates.branding === 'object') {
        config.branding = { ...config.branding, ...updates.branding };
      }
      if (updates.button && typeof updates.button === 'object') {
        config.button = { ...config.button, ...updates.button };
      }
      if (updates.window && typeof updates.window === 'object') {
        config.window = { ...config.window, ...updates.window };
      }
      if (updates.messages && typeof updates.messages === 'object') {
        config.messages = { ...config.messages, ...updates.messages };
      }
      if (updates.behavior && typeof updates.behavior === 'object') {
        config.behavior = { ...config.behavior, ...updates.behavior };
      }
      if (updates.typography && typeof updates.typography === 'object') {
        config.typography = { ...config.typography, ...updates.typography };
      }
      if (updates.advanced && typeof updates.advanced === 'object') {
        config.advanced = { ...config.advanced, ...updates.advanced };
      }
      if (updates.isActive !== undefined) {
        config.isActive = updates.isActive;
      }
    }
    await config.save();
    res.json({ config });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.post('/site/:siteId/logo', auth, checkPermission('manage_sites'), upload.single('logo'), async (req, res) => {
  try {
    const { siteId } = req.params;
    const orgId = req.organization?._id || req.user.organizationId;
    const site = await Site.findOne({
      _id: siteId,
      ...(orgId ? { organizationId: orgId } : {})
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    let config = await WidgetConfig.findOne({ siteId });
    if (!config) {
      config = new WidgetConfig({
        siteId,
        organizationId: orgId || site.organizationId
      });
    }
    if (config.branding.logo && config.branding.logo.startsWith('/uploads/logos/')) {
      const oldLogoPath = path.join(__dirname, '../../', config.branding.logo);
      if (fs.existsSync(oldLogoPath)) {
        fs.unlinkSync(oldLogoPath);
      }
    }
    config.branding.logo = `/uploads/logos/${req.file.filename}`;
    await config.save();
    res.json({ 
      config,
      logoUrl: `/api/widget-config/logo/${req.file.filename}`
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.get('/logo/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../../uploads/logos', filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Logo not found' });
    }
    res.sendFile(filePath);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.delete('/site/:siteId/logo', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const { siteId } = req.params;
    const orgId = req.organization?._id || req.user.organizationId;
    const site = await Site.findOne({
      _id: siteId,
      ...(orgId ? { organizationId: orgId } : {})
    });
    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }
    const config = await WidgetConfig.findOne({ siteId });
    if (!config) {
      return res.status(404).json({ error: 'Config not found' });
    }
    if (config.branding.logo && config.branding.logo.startsWith('/uploads/logos/')) {
      const logoPath = path.join(__dirname, '../../', config.branding.logo);
      if (fs.existsSync(logoPath)) {
        fs.unlinkSync(logoPath);
      }
    }
    config.branding.logo = null;
    await config.save();
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
