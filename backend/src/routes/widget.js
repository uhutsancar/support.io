const express = require('express');
const router = express.Router();
const Site = require('../models/Site');
const WidgetConfig = require('../models/WidgetConfig');

router.get('/settings', async (req, res) => {
  try {
    const { siteKey } = req.query;

    if (!siteKey) {
      return res.status(400).json({ error: 'siteKey is required' });
    }

    const site = await Site.findOne({ siteKey, isActive: true })
      .select('name widgetSettings isActive');

    if (!site) {
      return res.status(404).json({ error: 'Site not found or inactive' });
    }

    // Get widget config
    const widgetConfig = await WidgetConfig.findOne({ 
      siteId: site._id, 
      isActive: true 
    });

    res.json({ 
      site: {
        name: site.name,
        isActive: site.isActive,
        widgetSettings: site.widgetSettings
      },
      config: widgetConfig ? widgetConfig.toObject() : null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
