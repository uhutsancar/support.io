// The panel's push subscriptions (plan v10 PRD-09).
//
//   GET    /api/push/config          { enabled, publicKey } — the VAPID key
//   POST   /api/push/subscriptions   { endpoint, keys: { p256dh, auth } }
//   DELETE /api/push/subscriptions   { endpoint }
//
// One row per browser that allowed notifications, owned by the signed-in
// account. Saving the same endpoint again moves it to whoever saved it last
// (a shared computer, another account signing in).

import express from 'express';
import { auth } from '../middleware/auth';
import { query } from '../db/pool';
import { generateId } from '../db/objectId';
import { pushConfig } from '../config/push';
import { isPushEndpoint } from '../services/push';
import { asyncHandler, badRequest, orgId, requireOrganization } from '../http';
import type { Request, Response } from 'express';

const router = express.Router();

/** base64url key material of the size the Push API hands out. */
const key = (value: unknown, size: number): string | null =>
  typeof value === 'string' &&
  /^[A-Za-z0-9_-]+=*$/.test(value) &&
  Buffer.from(value.replace(/=+$/, ''), 'base64url').length === size
    ? value.replace(/=+$/, '')
    : null;

/** Which table the signed-in account lives in. */
const accountType = (req: Request): 'user' | 'team' => (req.userType === 'team' ? 'team' : 'user');

router.get(
  '/config',
  auth,
  asyncHandler(async (_req: Request, res: Response) => {
    const config = pushConfig();
    res.json({ enabled: Boolean(config), publicKey: config?.publicKey ?? null });
  })
);

router.post(
  '/subscriptions',
  auth,
  requireOrganization,
  asyncHandler(async (req: Request, res: Response) => {
    if (!pushConfig()) throw badRequest('Push notifications are not set up on this server');
    const endpoint = req.body?.endpoint;
    if (!isPushEndpoint(endpoint)) throw badRequest('Not a browser push service address');
    const p256dh = key(req.body?.keys?.p256dh, 65);
    const authSecret = key(req.body?.keys?.auth, 16);
    if (!p256dh || !authSecret) throw badRequest('The subscription keys are not valid');

    await query(
      `INSERT INTO push_subscriptions
         (id, account_type, account_id, organization_id, endpoint, p256dh, auth, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (endpoint) DO UPDATE
         SET account_type = EXCLUDED.account_type, account_id = EXCLUDED.account_id,
             organization_id = EXCLUDED.organization_id, p256dh = EXCLUDED.p256dh,
             auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent`,
      [
        generateId(),
        accountType(req),
        String(req.userId),
        orgId(req),
        endpoint,
        p256dh,
        authSecret,
        String(req.get('user-agent') || '').slice(0, 200)
      ]
    );
    res.status(201).json({ subscribed: true });
  })
);

router.delete(
  '/subscriptions',
  auth,
  asyncHandler(async (req: Request, res: Response) => {
    const endpoint = req.body?.endpoint;
    if (typeof endpoint !== 'string') throw badRequest('endpoint is required');
    // Only the caller's own row: an endpoint is not proof of ownership.
    await query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1 AND account_type = $2 AND account_id = $3',
      [endpoint, accountType(req), String(req.userId)]
    );
    res.status(204).end();
  })
);

export default router;
