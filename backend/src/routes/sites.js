const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Site = require('../models/Site');
const { auth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');

router.get('/', auth, async (req, res) => {
  try {
    // Organization isolation: only return sites belonging to user's organization
    const orgId = req.organization?._id || req.user.organizationId;
    const query = orgId ? { organizationId: orgId } : { userId: req.user._id };
    const sites = await Site.find(query).sort({ createdAt: -1 });
    res.json({ sites });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const { name, domain } = req.body;

    const orgId = req.organization?._id || req.user.organizationId;
    const site = new Site({
      name,
      domain,
      siteKey: uuidv4(),
      userId: req.user._id,
      organizationId: orgId
    });

    await site.save();
    res.status(201).json({ site });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:siteId', auth, async (req, res) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    const site = await Site.findOne({
      _id: req.params.siteId,
      organizationId: orgId
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ site });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:siteId', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const updates = req.body;
    const allowedUpdates = ['name', 'domain', 'widgetSettings', 'aiSettings', 'isActive'];
    const updateKeys = Object.keys(updates);

    const isValidOperation = updateKeys.every(key => allowedUpdates.includes(key));
    if (!isValidOperation) {
      return res.status(400).json({ error: 'Invalid updates' });
    }

    const orgId = req.organization?._id || req.user.organizationId;
    const site = await Site.findOne({
      _id: req.params.siteId,
      organizationId: orgId
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

router.delete('/:siteId', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    const site = await Site.findOneAndDelete({
      _id: req.params.siteId,
      organizationId: orgId
    });

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ message: 'Site deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:siteId/regenerate-key', auth, checkPermission('manage_sites'), async (req, res) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    const site = await Site.findOne({
      _id: req.params.siteId,
      organizationId: orgId
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
