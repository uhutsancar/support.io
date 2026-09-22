import express from 'express';
import AuditLog from '../models/AuditLog';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { requirePlan } from '../middleware/planCheck';
import type { Request, Response } from 'express';
import type { Filter } from '../db/model';

const router = express.Router();
// Denetim kaydı giriş IP'lerini, tarayıcı bilgilerini, rol ve plan
// değişikliklerini içerir. Panel bu sayfayı yalnızca ENTERPRISE planındaki
// owner/admin'e gösteriyordu ama sunucuda hiçbir kontrol yoktu: menüden
// gizlemek koruma değildir, herhangi bir temsilci bu ucu doğrudan
// çağırabiliyordu. Kural artık sunucuda, panelle aynı.
router.get('/', auth, checkPermission('manage_operations'), requirePlan(['ENTERPRISE']), async (req: Request, res: Response) => {
  try {
    const orgId = req.organization?._id || req.user.organizationId;
    if (!orgId) return res.status(400).json({ error: 'organization context required' });
    const { action, start, end, page = 1, limit = 25 } = req.query;
    const q: Filter = { organizationId: orgId };
    if (action) q.action = action;
    if (start || end) q.createdAt = {};
    if (start) q.createdAt.$gte = new Date(String(start));
    if (end) q.createdAt.$lte = new Date(String(end));
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const pageSize = Math.min(100, parseInt(String(limit), 10) || 25);
    const total = await AuditLog.countDocuments(q);
    const docs = await AuditLog.find(q)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * pageSize)
      .limit(pageSize)
      .lean();
    res.json({ total, page: pageNum, limit: pageSize, docs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});
export default router;