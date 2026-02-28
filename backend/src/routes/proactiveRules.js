const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const ProactiveRule = require('../models/ProactiveRule');
const Site = require('../models/Site');

// Get all proactive rules for a site
router.get('/:siteId', auth, async (req, res) => {
  try {
    const rules = await ProactiveRule.find({ siteId: req.params.siteId }).sort({ createdAt: -1 });
    res.json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new proactive rule
router.post('/', auth, async (req, res) => {
  try {
    const { siteId, name, triggerCondition, audienceContext, action, frequencyControl } = req.body;
    
    // Verify site belongs to user/organization
    const site = await Site.findById(siteId);
    if (!site) return res.status(404).json({ message: 'Site not found' });
    
    const rule = new ProactiveRule({
      siteId,
      name,
      triggerCondition,
      audienceContext,
      action,
      frequencyControl
    });

    await rule.save();
    res.status(201).json(rule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a rule
router.put('/:id', auth, async (req, res) => {
  try {
    const rule = await ProactiveRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a rule
router.delete('/:id', auth, async (req, res) => {
  try {
    const rule = await ProactiveRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ message: 'Rule deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
