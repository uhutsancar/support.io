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
import { HttpError, asyncHandler, orgId, requireOrganization, unavailable } from '../http';
import { errorText } from '../http/errors';
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
        res.status(400).json({ error: 'Invalid webhook' });
        return;
      }
      throw error;
    }
    try {
      const outcome = await handleEvent(event, rawBody);
      // The event id and its outcome only; never the payload.
      console.log(`[billing] ${event.event_type} ${event.event_id}: ${outcome}`);
      res.status(200).json({ received: true });
    } catch (error) {
      // A 5xx makes Paddle retry, which is what a failed write needs.
      console.error(`[billing] ${event.event_id} could not be applied:`, errorText(error));
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
      emailVerified: Boolean(req.user.emailVerifiedAt)
    });
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
