const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Site = require('../models/Site');
const { auth, isAdmin } = require('../middleware/auth');

// Get all sites for current user
router.get('/', auth, async (req, res) => {
  try {
    const sites = await Site.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ sites });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new site
router.post('/', auth, async (req, res) => {
  try {
    const { name, domain } = req.body;

    const site = new Site({
      name,
      domain,
      siteKey: uuidv4(),
      userId: req.user._id
    });

    await site.save();
    res.status(201).json({ site });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Get single site
router.get('/:siteId', auth, async (req, res) => {
  try {
    const site = await Site.findOne({
      _id: req.params.siteId,
      userId: req.user._id
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ site });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update site settings
router.put('/:siteId', auth, async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = ['name', 'domain', 'widgetSettings', 'aiSettings', 'isActive'];
    const updateKeys = Object.keys(updates);

    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates' });
    }

    const site = await Site.findOne({
      _id: req.params.siteId,
      userId: req.user._id
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    updateKeys.forEach(key => {
      if (key === 'widgetSettings' || key === 'aiSettings') {
        site[key] = { ...site[key].toObject(), ...updates[key] };
      } else {
        site[key] = updates[key];
      }
    });

    await site.save();
    res.json({ site });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Delete site
router.delete('/:siteId', auth, async (req, res) => {
  try {
    const site = await Site.findOneAndDelete({
      _id: req.params.siteId,
      userId: req.user._id
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Regenerate site key
router.post('/:siteId/regenerate-key', auth, async (req, res) => {
  try {
    const site = await Site.findOne({
      _id: req.params.siteId,
      userId: req.user._id
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    site.siteKey = uuidv4();
    await site.save();

    res.json({ site });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
