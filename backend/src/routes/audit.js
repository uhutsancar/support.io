const express = require('express');
const router = express.Router();
const AuditLog = require('../models/AuditLog');
const { auth } = require('../middleware/auth');

// GET /api/audit?organizationId=&action=&start=&end=&page=&limit=
router.get('/', auth, async (req, res) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    if (!orgId) return res.status(400).json({ error: 'organization context required' });

    const { action, start, end, page = 1, limit = 25 } = req.query;
    const q = { organizationId: orgId };

    if (action) q.action = action;
    if (start || end) q.createdAt = {};
    if (start) q.createdAt.$gte = new Date(start);
    if (end) q.createdAt.$lte = new Date(end);

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, parseInt(limit, 10) || 25);

    const total = await AuditLog.countDocuments(q);
    const docs = await AuditLog.find(q)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean();

    res.json({ total, page: pageNum, limit: pageSize, docs });
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

module.exports = router;
