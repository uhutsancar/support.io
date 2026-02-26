const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Site = require('../models/Site');
const crypto = require('crypto');
const WidgetConfig = require('../models/WidgetConfig');
router.post('/', auth, async (req, res) => {
  try {
    const { purpose, websiteUrl, phone, country, welcomeMessage, title, color } = req.body;
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Only account owners can complete onboarding.' });
    }
    if (req.user.isOnboarded) {
      return res.status(400).json({ error: 'Already onboarded.' });
    }
    const organizationId = req.user.organizationId;
    let domain = 'unknown';
    if (websiteUrl) {
      try {
         const urlStr = websiteUrl.startsWith('http') ? websiteUrl : 'https://' + websiteUrl;
         const parsed = new URL(urlStr);
         domain = parsed.hostname;
      } catch (e) {
         domain = websiteUrl;
      }
    }
    const site = new Site({
      name: websiteUrl || 'My Website',
      domain: domain,
      siteKey: crypto.randomBytes(16).toString('hex'),
      userId: req.user._id,
      organizationId: organizationId,
      widgetSettings: {
        welcomeMessage: welcomeMessage || 'Merhaba! Size nasıl yardımcı olabiliriz? 👋',
        primaryColor: color || '#4F46E5',
        position: 'bottom-right'
      }
    });
    await site.save();
    const widgetConfig = new WidgetConfig({
      siteId: site._id,
      organizationId: organizationId,
      theme: {
        primaryColor: color || '#4F46E5',
        position: 'bottom-right',
        headerText: title || 'Destek Ekibi'
      },
      content: {
        welcomeMessage: welcomeMessage || 'Merhaba! Size nasıl yardımcı olabiliriz? 👋',
        placeholderText: 'Mesajınızı buraya yazın...'
      }
    });
    await widgetConfig.save();
    req.user.isOnboarded = true;
    await req.user.save();
    res.status(200).json({ message: 'Onboarding completed successfully', site });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
