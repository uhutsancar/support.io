// The workspace's API keys, managed from the panel (plan v10 PRD-12).
//
//   GET    /api/api-keys          the keys: name, first characters, scopes, last use
//   POST   /api/api-keys          { name, scopes }  → the whole key, this once
//   DELETE /api/api-keys/:id      revokes it; the row stays for the record
//
// Owners and admins, on a plan with the API.

import express from 'express';
import events from '../events';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { requireFeature } from '../services/entitlements';
import { query } from '../db/pool';
import { API_SCOPES, createApiKey, presentKey } from '../services/apiKeys';
import type { ApiKeyRow, ApiScope } from '../services/apiKeys';
import {
  asyncHandler,
  badRequest,
  conflict,
  notFound,
  orgId,
  requireObjectId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';

const router = express.Router();
router.use(auth, requireOrganization, checkPermission('manage_integrations'));

const MAX_ACTIVE = 10;

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

router.get(
  '/',
  requireFeature('api'),
  asyncHandler(async (req: Request, res: Response) => {
    const { rows } = await query<ApiKeyRow>(
      `SELECT id, name, prefix, scopes, created_at, last_used_at, revoked_at FROM api_keys
        WHERE organization_id = $1 ORDER BY revoked_at IS NOT NULL, created_at DESC`,
      [orgId(req)]
    );
    res.json({ keys: rows.map(presentKey) });
  })
);

router.post(
  '/',
  requireFeature('api'),
  asyncHandler(async (req: Request, res: Response) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    if (!name || name.length > 60) throw badRequest('The name is 1-60 characters');
    const scopes: unknown = req.body?.scopes;
    if (
      !Array.isArray(scopes) ||
      !scopes.length ||
      scopes.some((s) => !(API_SCOPES as readonly unknown[]).includes(s))
    ) {
      throw badRequest(`scopes is a list of: ${API_SCOPES.join(', ')}`);
    }
    const { rows: active } = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM api_keys WHERE organization_id = $1 AND revoked_at IS NULL',
      [orgId(req)]
    );
    if (active[0].n >= MAX_ACTIVE) {
      throw conflict(`A workspace can have ${MAX_ACTIVE} active keys`, 'API_KEY_LIMIT');
    }
    const { key, row } = await createApiKey(
      orgId(req),
      name,
      [...new Set(scopes as ApiScope[])],
      String(req.userId)
    );
    audit(req, 'api_key.created', row.id, { name, scopes: row.scopes });
    res.status(201).json({ key: presentKey(row), secret: key });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    // Revoking is allowed on any plan: a downgraded workspace can still shut a key.
    const id = requireObjectId(req.params.id, 'key id');
    const { rows } = await query<{ name: string }>(
      `UPDATE api_keys SET revoked_at = coalesce(revoked_at, now())
        WHERE id = $1 AND organization_id = $2 RETURNING name`,
      [id, orgId(req)]
    );
    if (!rows[0]) throw notFound('API key');
    audit(req, 'api_key.revoked', id, { name: rows[0].name });
    res.status(204).end();
  })
);

export default router;
