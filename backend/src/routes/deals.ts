// The CRM pipeline: opportunities an organization tracks alongside its chats.

import express from 'express';
import Deal from '../models/Deal';
import { auth } from '../middleware/auth';
import { requirePlan } from '../middleware/planCheck';
import { DEAL_STAGES, isDealStage } from '../domain';
import { asyncHandler, badRequest, notFound, orgId, pick, requireOrganization } from '../http';
import type { Request, Response } from 'express';
import type { DealDoc } from '../models/Deal';

const router = express.Router();

// Every handler needed the tenant and the plan; both are stated once here
// instead of on each route. The handlers below used to read
// `req.user.organizationId` straight from the request without checking it,
// which for an account with no organization produced a filter the model
// rejects — a 500 where a 403 was meant.
router.use(auth, requireOrganization, requirePlan(['PRO', 'ENTERPRISE']));

const WRITABLE_FIELDS = [
  'title',
  'value',
  'currency',
  'contactName',
  'contactEmail',
  'contactPhone',
  'stage',
  'notes'
] as const;

const AGENT_FIELDS = 'name email avatar';

/** Gap left between ranks so a card can be dropped between two others without
 *  renumbering the column. */
const ORDER_STEP = 1024;

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const deals = await Deal.find({ organizationId: orgId(req) })
      .sort({ order: 1, createdAt: -1 })
      .populate('assignedTo', AGENT_FIELDS)
      .populate('createdBy', 'name email');
    res.json(deals);
  })
);

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const fields = pick<DealDoc>(req.body, WRITABLE_FIELDS);
    const stage = fields.stage ?? 'new';
    if (!isDealStage(stage)) {
      throw badRequest(`stage must be one of: ${DEAL_STAGES.join(', ')}`);
    }

    const last = await Deal.findOne({ organizationId, stage }).sort('-order');
    const deal = new Deal({
      ...fields,
      stage,
      order: last ? last.order + ORDER_STEP : ORDER_STEP,
      organizationId,
      createdBy: req.user._id,
      assignedTo: req.user._id
    });
    await deal.save();

    const populated = await Deal.findById(deal._id)
      .populate('assignedTo', AGENT_FIELDS)
      .populate('createdBy', 'name email');
    res.status(201).json(populated);
  })
);

router.put(
  '/:id/stage',
  asyncHandler(async (req: Request, res: Response) => {
    const { stage, order } = req.body;
    if (stage !== undefined && !isDealStage(stage)) {
      throw badRequest(`stage must be one of: ${DEAL_STAGES.join(', ')}`);
    }

    const deal = await Deal.findOne({ _id: req.params.id, organizationId: orgId(req) });
    if (!deal) throw notFound('Deal');

    if (stage !== undefined) deal.stage = stage;
    if (order !== undefined) deal.order = Number(order);
    await deal.save();
    res.json(deal);
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const deal = await Deal.findOneAndDelete({ _id: req.params.id, organizationId: orgId(req) });
    if (!deal) throw notFound('Deal');
    res.json({ message: 'Deal deleted' });
  })
);

export default router;
