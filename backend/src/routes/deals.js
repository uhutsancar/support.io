const express = require('express');
const router = express.Router();
const Deal = require('../models/Deal');
const { auth } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planCheck');
router.get('/', auth, requirePlan(['PRO', 'ENTERPRISE']), async (req, res) => {
  try {
    const deals = await Deal.find({ organizationId: req.user.organizationId })
      .sort({ order: 1, createdAt: -1 })
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email');
    res.json(deals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/', auth, requirePlan(['PRO', 'ENTERPRISE']), async (req, res) => {
  try {
    const { title, value, currency, contactName, contactEmail, contactPhone, stage, notes } = req.body;
    const highestOrderDeal = await Deal.findOne({ organizationId: req.user.organizationId, stage: stage || 'new' })
      .sort('-order')
      .exec();
    const newOrder = highestOrderDeal ? highestOrderDeal.order + 1024 : 1024;
    const deal = new Deal({
      title,
      value,
      currency,
      contactName,
      contactEmail,
      contactPhone,
      stage: stage || 'new',
      notes,
      order: newOrder,
      organizationId: req.user.organizationId,
      createdBy: req.user._id,
      assignedTo: req.user._id
    });
    await deal.save();
    const populatedDeal = await Deal.findById(deal._id)
      .populate('assignedTo', 'name email avatar')
      .populate('createdBy', 'name email');
    res.status(201).json(populatedDeal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.put('/:id/stage', auth, requirePlan(['PRO', 'ENTERPRISE']), async (req, res) => {
  try {
    const { stage, order } = req.body;
    const deal = await Deal.findOne({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!deal) {
      return res.status(404).json({ error: 'Fırsat bulunamadı' });
    }
    if (stage) deal.stage = stage;
    if (order !== undefined) deal.order = order;
    await deal.save();
    res.json(deal);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.delete('/:id', auth, requirePlan(['PRO', 'ENTERPRISE']), async (req, res) => {
  try {
    const deal = await Deal.findOneAndDelete({ _id: req.params.id, organizationId: req.user.organizationId });
    if (!deal) {
      return res.status(404).json({ error: 'Fırsat bulunamadı' });
    }
    res.json({ message: 'Fırsat silindi' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
