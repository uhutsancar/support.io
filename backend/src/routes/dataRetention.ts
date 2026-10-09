// How long the workspace keeps conversations (plan v10 SEC-17).
//
//   GET /api/data-retention   owner/admin: the days in force and the plan's window
//   PUT /api/data-retention   owner/admin: { days } within the window, or null
//                             for the plan's default
//
// The nightly purge (services/dataRetention.ts) reads the same value.

import express from 'express';
import Organization from '../models/Organization';
import events from '../events';
import { auth } from '../middleware/auth';
import { asyncHandler, forbidden, HttpError, orgId, requireOrganization } from '../http';
import { retentionFor, retentionOf } from '../services/dataRetention';
import type { Request, Response } from 'express';

const router = express.Router();

function ownerOrAdmin(req: Request): void {
  if (!['owner', 'admin'].includes(String(req.user.role))) {
    throw forbidden('Only the owner or an admin can change this', 'FORBIDDEN');
  }
}

router.get(
  '/',
  auth,
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    ownerOrAdmin(req);
    res.json(await retentionOf(orgId(req)));
  })
);

router.put(
  '/',
  auth,
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    ownerOrAdmin(req);
    const current = await retentionOf(orgId(req));
    const raw = req.body?.days;
    const days = raw === null ? null : Number(raw);
    if (days !== null && !Number.isInteger(days)) {
      throw new HttpError(400, 'days must be a whole number or null', 'VALIDATION_ERROR');
    }
    if (days !== null && (days < current.minDays || days > current.maxDays)) {
      throw new HttpError(
        400,
        current.fixed
          ? `Your plan keeps conversations for ${current.minDays} days`
          : `Choose between ${current.minDays} and ${current.maxDays} days`,
        'RETENTION_OUT_OF_RANGE',
        { minDays: current.minDays, maxDays: current.maxDays }
      );
    }
    const organization = await Organization.findById(orgId(req));
    if (!organization) throw forbidden('Organization not found', 'ORGANIZATION_INACTIVE');
    organization.retentionDays = days;
    await organization.save();

    const next = { plan: current.plan, ...retentionFor(current.plan, days) };
    events.emit('organization.retention.updated', {
      organizationId: orgId(req),
      userId: req.user._id,
      entityId: orgId(req),
      metadata: { from: current.days, to: next.days },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    res.json(next);
  })
);

export default router;
