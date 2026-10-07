// Paddle billing (plan §9).
//
//   POST /api/billing/paddle/webhook   Paddle → us. Raw body, Paddle-Signature.
//   GET  /api/billing                  the billing page: plan, limits, usage,
//                                      subscription, and what checkout needs
//   POST /api/billing/checkout         { plan } → the values Paddle.js opens with
//   POST /api/billing/portal           a link to Paddle's customer portal
//
// Everything but the webhook is for the organization's owner
// (manage_billing). The webhook router is mounted BEFORE express.json in
// server.ts: the signature is computed over the exact bytes Paddle sent, and
// a parsed-and-reserialised body would not match it. Neither sanitizeInput
// nor the API rate limit runs on it.

import express from 'express';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { billingConfig } from '../config/billing';
import type { PaidPlan } from '../config/billing';
import { getUsage } from '../services/entitlements';
import {
  InvalidWebhookError,
  checkoutReference,
  handleEvent,
  subscriptionSummary,
  verifyWebhook
} from '../services/billing';
import {
  HttpError,
  asyncHandler,
  badRequest,
  orgId,
  requireOrganization,
  unavailable
} from '../http';
import { errorText } from '../http/errors';
import { logger } from '../config/logger';
import { increment } from '../config/metrics';
import { trialRunning } from '../services/trial';
import { overageSummary, reconcilePlanLimits } from '../services/planOverage';
import type { Request, Response } from 'express';

// ------------------------------------------------------------------ webhook

export const webhookRouter = express.Router();

webhookRouter.post(
  '/',
  express.raw({ type: 'application/json', limit: '1mb' }),
  async (req: Request, res: Response) => {
    const { webhookSecret } = billingConfig();
    if (!webhookSecret) {
      res.status(503).json({ error: 'Billing is not configured' });
      return;
    }
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
    let event;
    try {
      event = await verifyWebhook(
        rawBody,
        String(req.get('paddle-signature') || ''),
        webhookSecret
      );
    } catch (error) {
      if (error instanceof InvalidWebhookError || error instanceof SyntaxError) {
        // A wrong secret or a forged call: worth seeing, never the body.
        increment('supportio_billing_webhook_rejected_total');
        logger.warn(
          { reason: error instanceof SyntaxError ? 'malformed' : 'signature' },
          'paddle webhook rejected'
        );
        res.status(400).json({ error: 'Invalid webhook' });
        return;
      }
      throw error;
    }
    try {
      const outcome = await handleEvent(event, rawBody);
      // The event id and its outcome only; never the payload.
      logger.info({ event: event.event_type, eventId: event.event_id, outcome }, 'paddle webhook');
      res.status(200).json({ received: true });
    } catch (error) {
      // A 5xx makes Paddle retry, which is what a failed write needs.
      logger.error({ eventId: event.event_id, err: errorText(error) }, 'paddle webhook failed');
      res.status(500).json({ error: 'Could not process the event' });
    }
  }
);

// -------------------------------------------------------------- owner pages

const router = express.Router();
router.use(auth, requireOrganization, checkPermission('manage_billing'));

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const config = billingConfig();
    const organizationId = orgId(req);
    const [usage, subscription] = await Promise.all([
      getUsage(organizationId),
      subscriptionSummary(organizationId)
    ]);
    res.json({
      ...usage,
      subscription: subscription && {
        planType: subscription.planType,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        graceEndsAt: subscription.graceEndsAt,
        manageable: subscription.manageable && Boolean(config.apiKey)
      },
      billing: {
        enabled: config.enabled,
        // The Paddle client token is the only Paddle value meant for a browser.
        environment: config.environment,
        clientToken: config.enabled ? config.clientToken : null,
        // Which plan and billing period can be bought online right now.
        purchasable: {
          PRO: {
            monthly: config.enabled && Boolean(config.prices.PRO.monthly),
            yearly: config.enabled && Boolean(config.prices.PRO.yearly)
          },
          ENTERPRISE: {
            monthly: config.enabled && Boolean(config.prices.ENTERPRISE.monthly),
            yearly: config.enabled && Boolean(config.prices.ENTERPRISE.yearly)
          }
        }
      },
      emailVerified: Boolean(req.user.emailVerifiedAt),
      // The free Pro trial (PRD-15), while it runs and no plan was bought.
      trial:
        !subscription &&
        usage.plan === 'PRO' &&
        req.organization?.planType === 'FREE' &&
        trialRunning(req.organization?.trialEndsAt)
          ? { plan: 'PRO', endsAt: req.organization?.trialEndsAt }
          : null,
      billingExempt: Boolean(req.organization?.billingExempt)
    });
  })
);

// -------------------------------------------- over the plan's limits (BIL-04)

// The sites and members, and which of them are on hold after a downgrade.
router.get(
  '/overage',
  asyncHandler(async (req: Request, res: Response) => {
    res.json(await overageSummary(orgId(req)));
  })
);

const idList = (value: unknown): string[] | null =>
  Array.isArray(value) && value.length <= 500 && value.every((v) => typeof v === 'string')
    ? [...new Set(value as string[])]
    : null;

// The owner picks which sites and members stay active; the rest go on hold.
router.post(
  '/overage',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = orgId(req);
    const keepSiteIds = idList(req.body?.keepSiteIds ?? []);
    const keepMemberIds = idList(req.body?.keepMemberIds ?? []);
    if (!keepSiteIds || !keepMemberIds) throw badRequest('Lists of ids expected');
    const summary = await overageSummary(organizationId);
    const siteIds = new Set(summary.sites.map((s) => s.id));
    const memberIds = new Set(summary.members.filter((m) => !m.owner).map((m) => m.id));
    if (
      !keepSiteIds.every((id) => siteIds.has(id)) ||
      !keepMemberIds.every((id) => memberIds.has(id))
    ) {
      throw badRequest('Unknown site or member');
    }
    // The owner's seat is always kept and counts towards the limit.
    if (
      keepSiteIds.length > summary.limits.sites ||
      keepMemberIds.length > summary.limits.agents - 1
    ) {
      throw new HttpError(400, 'More than the plan allows', 'OVER_PLAN_LIMIT', {
        sites: summary.limits.sites,
        agents: summary.limits.agents
      });
    }
    // Chosen ones first; any room left goes to what is active now.
    const change = await reconcilePlanLimits(organizationId, { keepSiteIds, keepMemberIds });
    res.json({ change, ...(await overageSummary(organizationId)) });
  })
);

router.post(
  '/checkout',
  asyncHandler(async (req: Request, res: Response) => {
    const config = billingConfig();
    if (!config.enabled || !config.clientToken) throw unavailable('Online payment is not open yet');
    const plan = String(req.body?.plan || '').toUpperCase();
    const cycle = req.body?.cycle === 'yearly' ? 'yearly' : 'monthly';
    const priceId =
      plan === 'PRO' || plan === 'ENTERPRISE' ? config.prices[plan as PaidPlan][cycle] : null;
    if (!priceId) {
      throw new HttpError(400, 'This plan cannot be bought online', 'PLAN_NOT_PURCHASABLE');
    }
    if (!req.user.emailVerifiedAt) {
      throw new HttpError(403, 'Verify your e-mail address first', 'EMAIL_NOT_VERIFIED');
    }
    const organizationId = orgId(req);
    const existing = await subscriptionSummary(organizationId);
    if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
      throw new HttpError(
        409,
        'This organization already has a subscription; change it from the customer portal',
        'SUBSCRIPTION_EXISTS'
      );
    }
    res.json({
      environment: config.environment,
      clientToken: config.clientToken,
      priceId,
      customerEmail: req.user.email,
      // Paddle copies this onto the subscription; the webhook trusts the
      // organization id only together with the reference signed here.
      customData: { organizationId, ref: checkoutReference(organizationId) }
    });
  })
);

router.post(
  '/portal',
  asyncHandler(async (req: Request, res: Response) => {
    const config = billingConfig();
    const subscription = await subscriptionSummary(orgId(req));
    if (!subscription?.customerId)
      throw new HttpError(400, 'There is no subscription to manage', 'NO_SUBSCRIPTION');
    if (!config.apiKey) throw unavailable('Billing is not configured');
    const paddle = new Paddle(config.apiKey, {
      environment:
        config.environment === 'production' ? Environment.production : Environment.sandbox
    });
    try {
      const session = await paddle.customerPortalSessions.create(subscription.customerId, [
        subscription.subscriptionId
      ]);
      res.json({ url: session.urls.general.overview });
    } catch (error) {
      console.error('[billing] customer portal session failed:', errorText(error));
      throw unavailable('The customer portal could not be opened; try again shortly');
    }
  })
);

export default router;
