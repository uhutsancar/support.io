// Sites: the customer domains a tenant installs the widget on.
//
// Every handler here is scoped to the caller's organization. That is enforced
// by the router-level `requireOrganization` below plus `loadOwnedSite`, not by
// each handler remembering to filter — see src/http/guards.ts for why.

import express from 'express';
import events from '../events';
import { randomUUID } from 'crypto';
import Site from '../models/Site';
import { newSecret, seal } from '../config/secretBox';
import { checkOrderUrl, testOrderService } from '../services/orderLookup';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import {
  AI_ANSWER_LENGTHS,
  AI_MODES,
  AI_TONES,
  isAIAnswerLength,
  isAIMode,
  isAITone
} from '../domain';
import {
  asyncHandler,
  badRequest,
  loadOwnedSite,
  notFound,
  orgId,
  pickStrict,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { SiteDoc } from '../models/Site';
import type { SiteAiSettings } from '../domain';

const router = express.Router();

// Applied once instead of in each handler: a signed-in account with no
// organization has nothing to read or write here.
router.use(auth, requireOrganization);

/** The fields a client may set on a site; everything else is server-owned. */
const WRITABLE_FIELDS = ['name', 'domain', 'widgetSettings', 'aiSettings', 'isActive'] as const;

/** Nested settings are merged rather than replaced, so a partial update of one
 *  key does not blank out the rest of the object. */
const MERGED_FIELDS = new Set<string>(['widgetSettings', 'aiSettings']);

const AI_SETTING_KEYS = [
  'mode',
  'answerLength',
  'tone',
  'maxBotReplies',
  'blockedTerms',
  'botName',
  'handoffMessage'
] as const;

const MAX_BLOCKED_TERMS = 50;

/** A trimmed string of at most `max` characters, null for empty; anything else is a 400. */
function optionalText(value: unknown, max: number, label: string): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || value.length > max) {
    throw badRequest(`aiSettings.${label} must be a string of at most ${max} characters`);
  }
  return value.trim() || null;
}

/**
 * The AI settings a client sent, checked key by key.
 *
 * This used to be merged into the row as it arrived, so any key and any value
 * a client sent — including a model name — was stored and later read back by
 * the assistant. Only the declared keys, with values of the declared type and
 * range, get through; everything else is a 400 naming the problem.
 */
function validateAiSettings(input: unknown): Partial<SiteAiSettings> {
  const body = pickStrict<SiteAiSettings>(input, AI_SETTING_KEYS);
  const out: Partial<SiteAiSettings> = {};

  if (body.mode !== undefined) {
    if (!isAIMode(body.mode)) {
      throw badRequest(`aiSettings.mode must be one of: ${AI_MODES.join(', ')}`);
    }
    out.mode = body.mode;
  }
  if (body.answerLength !== undefined) {
    if (!isAIAnswerLength(body.answerLength)) {
      throw badRequest(`aiSettings.answerLength must be one of: ${AI_ANSWER_LENGTHS.join(', ')}`);
    }
    out.answerLength = body.answerLength;
  }
  if (body.tone !== undefined) {
    if (!isAITone(body.tone)) {
      throw badRequest(`aiSettings.tone must be one of: ${AI_TONES.join(', ')}`);
    }
    out.tone = body.tone;
  }
  if (body.maxBotReplies !== undefined) {
    const n = body.maxBotReplies;
    if (!Number.isInteger(n) || n < 1 || n > 20) {
      throw badRequest('aiSettings.maxBotReplies must be an integer between 1 and 20');
    }
    out.maxBotReplies = n;
  }
  if (body.blockedTerms !== undefined) {
    const terms: unknown = body.blockedTerms;
    if (
      !Array.isArray(terms) ||
      terms.length > MAX_BLOCKED_TERMS ||
      !terms.every((t) => typeof t === 'string' && t.length <= 60)
    ) {
      throw badRequest(
        `aiSettings.blockedTerms must be at most ${MAX_BLOCKED_TERMS} strings of up to 60 characters`
      );
    }
    out.blockedTerms = [...new Set(terms.map((t: string) => t.trim()).filter(Boolean))];
  }
  if (body.botName !== undefined) out.botName = optionalText(body.botName, 40, 'botName');
  if (body.handoffMessage !== undefined) {
    out.handoffMessage = optionalText(body.handoffMessage, 300, 'handoffMessage');
  }
  return out;
}

/** Who changed a site, for its audit row. */
function auditContext(req: Request, site: Doc<SiteDoc>) {
  return {
    organizationId: orgId(req),
    userId: req.userId,
    entityId: site._id,
    ip: req.ip ?? null,
    ua: req.get('user-agent') ?? null
  };
}

function auditIntegration(req: Request, site: Doc<SiteDoc>, change: string): void {
  events.emit('site.integration.updated', { ...auditContext(req, site), metadata: { change } });
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const sites = await Site.find({ organizationId: orgId(req) }).sort({ createdAt: -1 });
    res.json({ sites });
  })
);

router.post(
  '/',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const { name, domain } = req.body;
    const site = new Site({
      name,
      domain,
      siteKey: randomUUID(),
      userId: req.user._id,
      organizationId: orgId(req)
    });
    await site.save();
    res.status(201).json({ site });
  })
);

router.get(
  '/:siteId',
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    res.json({ site });
  })
);

router.put(
  '/:siteId',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    // `pickStrict` rejects an unknown key rather than dropping it, which is what
    // this endpoint did before — a caller sending a field this route does not own
    // gets told so instead of watching it vanish.
    const updates = pickStrict<SiteDoc>(req.body, WRITABLE_FIELDS);
    if (updates.aiSettings !== undefined) {
      updates.aiSettings = validateAiSettings(updates.aiSettings) as SiteAiSettings;
    }

    const site = await loadOwnedSite(req, req.params.siteId);
    const writable = site as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(updates)) {
      writable[key] = MERGED_FIELDS.has(key)
        ? { ...(writable[key] as object), ...(value as object) }
        : value;
    }
    await site.save();

    if (updates.aiSettings) {
      events.emit('site.ai.updated', {
        ...auditContext(req, site),
        metadata: { changed: Object.keys(updates.aiSettings), mode: site.aiSettings.mode }
      });
    }
    res.json({ site });
  })
);

router.delete(
  '/:siteId',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await Site.findOneAndDelete({
      _id: req.params.siteId,
      organizationId: orgId(req)
    });
    if (!site) throw notFound('Site');
    res.json({ message: 'Site deleted successfully' });
  })
);

// A new identity-verification key. It is shown this once and stored sealed;
// generating another invalidates every userHash signed with the previous one.
router.post(
  '/:siteId/integrations/identity-secret',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const secret = newSecret();
    site.integrations = { ...site.integrations, identitySecret: seal(secret) };
    await site.save();
    auditIntegration(req, site, 'identity_key_generated');
    res.json({ site, secret });
  })
);

// The shop's order service: where it is and whether the assistant may ask it.
// The URL is checked when it is saved (https, public addresses only) and again
// on every call, since DNS can change in between.
router.put(
  '/:siteId/integrations/order-lookup',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const { enabled, url } = pickStrict<{ enabled: boolean; url: string | null }>(req.body, [
      'enabled',
      'url'
    ]);
    const site = await loadOwnedSite(req, req.params.siteId);
    const current = site.integrations.orderLookup;
    const next = { ...current };

    if (url !== undefined) {
      if (url === null || url === '') {
        next.url = null;
      } else {
        const checked = await checkOrderUrl(url);
        if (!checked) {
          throw badRequest('The order service URL must be https and resolve to a public address');
        }
        next.url = checked.toString();
      }
    }
    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') throw badRequest('enabled must be a boolean');
      next.enabled = enabled;
    }
    if (next.enabled && (!next.url || !next.signingSecret)) {
      throw badRequest('Set the URL and generate a signing key before switching the lookup on');
    }

    site.integrations = { ...site.integrations, orderLookup: next };
    await site.save();
    auditIntegration(req, site, next.enabled ? 'order_lookup_on' : 'order_lookup_off');
    res.json({ site });
  })
);

// A new signing key for requests to the order service; shown this once.
router.post(
  '/:siteId/integrations/order-lookup/signing-secret',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const secret = newSecret();
    site.integrations = {
      ...site.integrations,
      orderLookup: { ...site.integrations.orderLookup, signingSecret: seal(secret) }
    };
    await site.save();
    auditIntegration(req, site, 'order_signing_key_generated');
    res.json({ site, secret });
  })
);

router.post(
  '/:siteId/integrations/order-lookup/test',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const result = await testOrderService(site);
    res.json(result.ok ? { ok: true, orders: result.orders.length } : result);
  })
);

router.post(
  '/:siteId/regenerate-key',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    site.siteKey = randomUUID();
    await site.save();
    res.json({ site });
  })
);

export default router;
