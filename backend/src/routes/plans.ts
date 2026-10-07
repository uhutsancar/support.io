// GET /api/plans — what each plan includes, for the pricing page.
//
// Public and read-only: the same table the server enforces
// (domain/plans.ts), so the numbers on the pricing page are the numbers the
// product applies. Prices are Paddle's once billing is on, so the pricing
// page shows what checkout charges (services/paddlePrices.ts, BIL-03).
// Nothing about any organization is in it.

import express from 'express';
import { PLAN_LIMITS } from '../domain/plans';
import { PLAN_TYPES } from '../domain';
import { displayPrice } from '../services/paddlePrices';
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
      savedReplies: PLAN_LIMITS[type].savedReplies,
      retention: PLAN_LIMITS[type].retention,
      assistant: {
        monthlyReplies: PLAN_LIMITS[type].assistant.monthlyReplies,
        repliesPerConversation: PLAN_LIMITS[type].assistant.repliesPerConversation
      },
      features: PLAN_LIMITS[type].features,
      price: displayPrice(type)
    }))
  });
});

export default router;
