const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const AutomationRule = require('../models/AutomationRule');
const Site = require('../models/Site');

// Get all automation rules for a site
router.get('/:siteId', auth, async (req, res) => {
  try {
    const rules = await AutomationRule.find({ siteId: req.params.siteId }).sort({ priority: -1, createdAt: -1 });
    res.json(rules);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new automation rule
router.post('/', auth, async (req, res) => {
  try {
    const { siteId, name, triggerType, conditions, conditionOperator, actions, priority, isActive } = req.body;
    
    // Verify site belongs to user/organization
    const site = await Site.findById(siteId);
    if (!site) return res.status(404).json({ message: 'Site not found' });
    
    const rule = new AutomationRule({
      siteId,
      name,
      triggerType,
      conditions,
      conditionOperator,
      actions,
      priority,
      isActive
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
    const rule = await AutomationRule.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
    const rule = await AutomationRule.findByIdAndDelete(req.params.id);
    if (!rule) return res.status(404).json({ message: 'Rule not found' });
    res.json({ message: 'Rule deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
