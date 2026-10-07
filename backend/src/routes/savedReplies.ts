// Saved replies (plan v10 PRD-03): text an agent drops into the reply box by
// typing "/" and a shortcut. Agents read and use them; owners and admins
// (manage_sites) write them. A reply belongs to the organization, and either
// to one site or — site_id NULL — to all of them. Variables such as
// {{visitor.name}} are filled in by the panel when the reply is inserted.
//
//   GET    /api/saved-replies?siteId=   the ones usable on that site
//   POST   /api/saved-replies           { shortcut, title, body, siteId? }
//   PUT    /api/saved-replies/:id
//   DELETE /api/saved-replies/:id
//   POST   /api/saved-replies/:id/use   counts a use (for the ordering)

import express from 'express';
import events from '../events';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { query } from '../db/pool';
import { generateId, isValidObjectId } from '../db/objectId';
import { limitsFor } from '../services/entitlements';
import {
  asyncHandler,
  badRequest,
  HttpError,
  loadOwnedSite,
  notFound,
  orgId,
  requireObjectId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';

const router = express.Router();
router.use(auth, requireOrganization);

const SHORTCUT = /^[a-z0-9][a-z0-9_-]{0,31}$/;

interface SavedReplyRow {
  id: string;
  site_id: string | null;
  shortcut: string;
  title: string;
  body: string;
  usage_count: number;
  updated_at: Date;
}

const present = (r: SavedReplyRow) => ({
  _id: r.id,
  siteId: r.site_id,
  shortcut: r.shortcut,
  title: r.title,
  body: r.body,
  usageCount: r.usage_count,
  updatedAt: r.updated_at
});

function fields(body: Record<string, unknown>) {
  const shortcut = typeof body.shortcut === 'string' ? body.shortcut.trim().toLowerCase() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  const text = typeof body.body === 'string' ? body.body.trim() : '';
  if (!SHORTCUT.test(shortcut)) {
    throw badRequest('The shortcut is 1-32 lower-case letters, digits, - or _');
  }
  if (!title || title.length > 100) throw badRequest('The title is 1-100 characters');
  if (!text || text.length > 5000) throw badRequest('The text is 1-5000 characters');
  return { shortcut, title, body: text };
}

async function siteFor(req: Request, siteId: unknown): Promise<string | null> {
  if (siteId === undefined || siteId === null || siteId === '') return null;
  const site = await loadOwnedSite(req, siteId);
  return String(site._id);
}

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

const conflictOnShortcut = (error: unknown) => {
  if ((error as { code?: string })?.code === '23505') {
    throw new HttpError(409, 'This shortcut is already in use', 'SHORTCUT_TAKEN');
  }
  throw error;
};

router.get(
  '/',
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const siteId =
      typeof req.query.siteId === 'string' && isValidObjectId(req.query.siteId)
        ? await siteFor(req, req.query.siteId)
        : null;
    const { rows } = await query<SavedReplyRow>(
      `SELECT id, site_id, shortcut, title, body, usage_count, updated_at
         FROM saved_replies
        WHERE organization_id = $1 AND ($2::text IS NULL OR site_id IS NULL OR site_id = $2)
        ORDER BY usage_count DESC, shortcut
        LIMIT 1000`,
      [orgId(req), siteId]
    );
    res.json({ replies: rows.map(present) });
  })
);

router.post(
  '/',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const data = fields(req.body ?? {});
    const siteId = await siteFor(req, req.body?.siteId);
    const { limits } = await limitsFor(orgId(req));
    const { rows: counted } = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM saved_replies WHERE organization_id = $1',
      [orgId(req)]
    );
    if (counted[0].n >= limits.savedReplies) {
      throw new HttpError(
        403,
        `Your plan allows ${limits.savedReplies} saved replies`,
        'PLAN_LIMIT_REACHED',
        {
          resource: 'savedReplies',
          limit: limits.savedReplies,
          used: counted[0].n
        }
      );
    }
    const id = generateId();
    const { rows } = await query<SavedReplyRow>(
      `INSERT INTO saved_replies (id, organization_id, site_id, shortcut, title, body, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, site_id, shortcut, title, body, usage_count, updated_at`,
      [id, orgId(req), siteId, data.shortcut, data.title, data.body, String(req.user._id)]
    ).catch(conflictOnShortcut);
    audit(req, 'saved_reply.created', id, { shortcut: data.shortcut });
    res.status(201).json({ reply: present(rows[0]) });
  })
);

router.put(
  '/:id',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = requireObjectId(req.params.id, 'reply id');
    const data = fields(req.body ?? {});
    const siteId = await siteFor(req, req.body?.siteId);
    const { rows } = await query<SavedReplyRow>(
      `UPDATE saved_replies SET shortcut = $3, title = $4, body = $5, site_id = $6, updated_at = now()
        WHERE id = $1 AND organization_id = $2
        RETURNING id, site_id, shortcut, title, body, usage_count, updated_at`,
      [id, orgId(req), data.shortcut, data.title, data.body, siteId]
    ).catch(conflictOnShortcut);
    if (!rows[0]) throw notFound('Saved reply');
    audit(req, 'saved_reply.updated', id, { shortcut: data.shortcut });
    res.json({ reply: present(rows[0]) });
  })
);

router.delete(
  '/:id',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = requireObjectId(req.params.id, 'reply id');
    const { rowCount } = await query(
      'DELETE FROM saved_replies WHERE id = $1 AND organization_id = $2',
      [id, orgId(req)]
    );
    if (!rowCount) throw notFound('Saved reply');
    audit(req, 'saved_reply.deleted', id, {});
    res.json({ deleted: true });
  })
);

router.post(
  '/:id/use',
  checkPermission('respond'),
  asyncHandler(async (req: Request, res: Response) => {
    const id = requireObjectId(req.params.id, 'reply id');
    await query(
      `UPDATE saved_replies SET usage_count = usage_count + 1
        WHERE id = $1 AND organization_id = $2`,
      [id, orgId(req)]
    );
    res.status(204).end();
  })
);

export default router;
