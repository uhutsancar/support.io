// GET /api/plans — what each plan includes, for the pricing page.
//
// Public and read-only: the same table the server enforces
// (domain/plans.ts), so the numbers on the pricing page are the numbers the
// product applies. Nothing about any organization is in it.

import express from 'express';
import { PLAN_LIMITS } from '../domain/plans';
import { PLAN_TYPES } from '../domain';
import type { Request, Response } from 'express';

const router = express.Router();

router.get('/', (_req: Request, res: Response) => {
  // Plans change with a deploy, not per request.
  res.set('Cache-Control', 'public, max-age=300');
  res.json({
    plans: PLAN_TYPES.map((type) => ({
      type,
      sites: PLAN_LIMITS[type].sites,
      agents: PLAN_LIMITS[type].agents,
      monthlyConversations: PLAN_LIMITS[type].monthlyConversations,
      branding: PLAN_LIMITS[type].branding,
      features: PLAN_LIMITS[type].features,
      price: PLAN_LIMITS[type].price
    }))
  });
});

export default router;
