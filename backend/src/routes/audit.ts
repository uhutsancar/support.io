// The audit trail: sign-in IPs, user agents, role and plan changes.
//
// The panel only showed this page to an ENTERPRISE owner or admin, but the
// server checked nothing at all — hiding a menu item is not access control, and
// any agent could call the endpoint directly. The rule now lives here, where it
// is actually enforced, and the panel merely reflects it.

import express from 'express';
import AuditLog from '../models/AuditLog';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { requirePlan } from '../middleware/planCheck';
import { asyncHandler, orgId, requireOrganization } from '../http';
import type { Request, Response } from 'express';
import type { Filter } from '../db/model';

const router = express.Router();

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/** A positive integer from the query string, clamped to a sane range. */
function boundedInt(value: unknown, fallback: number, max: number): number {
  const parsed = parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

router.get(
  '/',
  auth,
  requireOrganization,
  checkPermission('manage_operations'),
  requirePlan(['ENTERPRISE']),
  asyncHandler(async (req: Request, res: Response) => {
    const { action, start, end } = req.query;

    const filter: Filter = { organizationId: orgId(req) };
    if (action) filter.action = action;
    if (start || end) {
      filter.createdAt = {
        ...(start ? { $gte: new Date(String(start)) } : {}),
        ...(end ? { $lte: new Date(String(end)) } : {})
      };
    }

    const page = boundedInt(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = boundedInt(req.query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const [total, docs] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
    ]);

    res.json({ total, page, limit, docs });
  })
);

export default router;
