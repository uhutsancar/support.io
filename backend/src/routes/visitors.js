const express = require('express');
const router = express.Router();
const Visitor = require('../models/Visitor');
const Site = require('../models/Site');
const { auth } = require('../middleware/auth');
const { requirePlan } = require('../middleware/planCheck');
router.get('/site/:siteId', auth, requirePlan(['PRO', 'ENTERPRISE']), async (req, res) => {
  try {
    const { siteId } = req.params;
    const { active } = req.query;
    const site = await Site.findById(siteId);
    if (!site || site.organizationId.toString() !== req.user.organizationId.toString()) {
      return res.status(403).json({ error: 'Bu siteye erişim yetkiniz yok' });
    }
    let filter = { siteId, organizationId: req.user.organizationId };
    if (active === 'true') {
       const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
       filter.isActive = true;
       filter.lastActiveAt = { $gte: fiveMinutesAgo };
    }
    const visitors = await Visitor.find(filter).sort({ lastActiveAt: -1 });
    res.json(visitors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
