// Live visitors on a site, for the dashboard's presence list; and the
// visitors the team has blocked (plan v10 SEC-09).

import express from 'express';
import Visitor from '../models/Visitor';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { requireFeature } from '../services/entitlements';
import { blockVisitor, listBlocks, unblockVisitor } from '../services/visitorBlocks';
import { eraseVisitor } from '../services/dataRetention';
import events from '../events';
import { conversationRoom, ioFrom, siteRoom } from '../realtime';
import {
  asyncHandler,
  badRequest,
  loadAccessibleConversation,
  loadAccessibleSite,
  loadOwnedSite,
  notFound,
  orgId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';
import type { Filter } from '../db/model';

const router = express.Router();

/** How recently a visitor must have been seen to count as "here now". */
const ACTIVE_WINDOW_MS = 5 * 60 * 1000;

router.get(
  '/site/:siteId',
  auth,
  requireOrganization,
  requireFeature('visitors'),
  asyncHandler(async (req: Request, res: Response) => {
    // This handler used to read `req.user.organizationId` directly and compare
    // it with `.toString()`. For an account with no organization that threw on
    // null and came back as a 500; `requireOrganization` answers 403 before the
    // handler runs, and `loadAccessibleSite` does the ownership and site-assignment check.
    const site = await loadAccessibleSite(req, req.params.siteId);

    const filter: Filter = { siteId: site._id, organizationId: orgId(req) };
    if (req.query.active === 'true') {
      filter.isActive = true;
      filter.lastActiveAt = { $gte: new Date(Date.now() - ACTIVE_WINDOW_MS) };
    }

    const visitors = await Visitor.find(filter).sort({ lastActiveAt: -1 });
    res.json(visitors);
  })
);

function audit(req: Request, event: string, entityId: string, metadata: Record<string, unknown>) {
  events.emit(event, {
    organizationId: orgId(req),
    userId: req.user._id,
    entityId,
    metadata,
    ip: req.ip,
    ua: req.get('user-agent')
  });
}

// POST /api/visitors/block   { conversationId, reason?, days? }
//
// Blocks the visitor of a conversation the agent can see, on that site, for
// 30 days unless said otherwise: by their visitor id and by a keyed hash of
// the address they were last seen from. Their open widget is told at once.
router.post(
  '/block',
  auth,
  requireOrganization,
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await loadAccessibleConversation(req, req.body?.conversationId);
    const days = req.body?.days === undefined ? 30 : Number(req.body.days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      throw badRequest('days must be a whole number from 1 to 365');
    }
    const reason =
      typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 200) || null : null;

    const visitor = await Visitor.findOne({
      visitorId: conversation.visitorId,
      siteId: conversation.siteId
    });
    const id = await blockVisitor({
      organizationId: orgId(req),
      siteId: String(conversation.siteId),
      visitorId: conversation.visitorId,
      ip: visitor?.ip ?? null,
      reason,
      days,
      blockedBy: String(req.user._id)
    });

    const widget = ioFrom(req)?.of('/widget');
    if (widget) {
      const room = widget.in(conversationRoom(conversation._id));
      room.emit('visitor-blocked', {});
      room.disconnectSockets(true);
    }

    audit(req, 'visitor.blocked', id, {
      siteId: String(conversation.siteId),
      conversationId: String(conversation._id),
      days,
      byAddress: Boolean(visitor?.ip)
    });
    res.status(201).json({ id, days });
  })
);

// GET /api/visitors/blocks/:siteId   — the blocks still in force on a site
router.get(
  '/blocks/:siteId',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    res.json({ blocks: await listBlocks(orgId(req), String(site._id)) });
  })
);

// DELETE /api/visitors/blocks/:id
router.delete(
  '/blocks/:id',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!(await unblockVisitor(orgId(req), id))) throw notFound('Block');
    audit(req, 'visitor.unblocked', id, {});
    res.json({ ok: true });
  })
);

// POST /api/visitors/erase   { conversationId }
//
// A visitor asked the business to delete their data (KVKK article 11): every
// conversation they had on that site, with messages and attachments, their
// visitor record and page events. Owner and admins only; audited with the
// counts, not the content. Cannot be undone.
router.post(
  '/erase',
  auth,
  requireOrganization,
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await loadAccessibleConversation(req, req.body?.conversationId);
    const siteId = String(conversation.siteId);
    const removed = await eraseVisitor({
      organizationId: orgId(req),
      siteId,
      visitorId: conversation.visitorId
    });
    const admin = ioFrom(req)?.of('/admin');
    admin?.to(siteRoom(siteId)).emit('stats-update', {
      type: 'conversation-deleted',
      siteId,
      conversationId: String(conversation._id)
    });
    audit(req, 'visitor.data_deleted', String(conversation._id), { siteId, ...removed });
    res.json(removed);
  })
);

export default router;
