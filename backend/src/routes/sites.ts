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
import { normalizeOriginList, originsFromDomain } from '../config/siteOrigins';
import { withTransaction } from '../db/pool';
import { assertCanCreateSite, lockOrganization } from '../services/entitlements';
import { assistantAvailable } from '../services/assistant';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
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

const router = express.Router();

// Applied once instead of in each handler: a signed-in account with no
// organization has nothing to read or write here.
router.use(auth, requireOrganization);

/** The fields a client may set on a site; everything else is server-owned. */
const WRITABLE_FIELDS = [
  'name',
  'domain',
  'allowedOrigins',
  'widgetSettings',
  'assistantEnabled',
  'faqAutoReply',
  'isActive'
] as const;

/** A site's name and domain, as a client sent them; anything else is a 400. */
function siteText(value: unknown, label: string, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw badRequest(`${label} is required and must be at most ${max} characters`);
  }
  return value.trim();
}

/**
 * The origins the widget may run on, as a client sent them. Each must be
 * exactly `scheme://host[:port]`; the 400 names every entry that is not, so
 * the panel can point at it.
 */
function validateAllowedOrigins(input: unknown): string[] {
  const { origins, invalid } = normalizeOriginList(input);
  if (invalid.length) {
    throw badRequest(
      `allowedOrigins must be origins such as https://shop.example.com (no path, no *): ${invalid.join(', ')}`,
      { invalid }
    );
  }
  return origins;
}

/** Nested settings are merged rather than replaced, so a partial update of one
 *  key does not blank out the rest of the object. */
const MERGED_FIELDS = new Set<string>(['widgetSettings']);

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
    const name = siteText(req.body?.name, 'name', 100);
    const domain = siteText(req.body?.domain, 'domain', 253);
    // Explicit origins win; otherwise the domain and its www. twin, which is
    // what a site on that domain almost always needs.
    const allowedOrigins =
      req.body?.allowedOrigins !== undefined
        ? validateAllowedOrigins(req.body.allowedOrigins)
        : originsFromDomain(domain);
    const organizationId = orgId(req);
    const site = new Site({
      name,
      domain,
      allowedOrigins,
      siteKey: randomUUID(),
      userId: req.user._id,
      organizationId
    });
    // Counted and inserted under the organization's lock: two creations at
    // once cannot both take the plan's last site.
    await withTransaction(async (client) => {
      await lockOrganization(client, organizationId);
      await assertCanCreateSite(organizationId, client);
      await site.save({ client });
    });
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
    if (updates.name !== undefined) updates.name = siteText(updates.name, 'name', 100);
    if (updates.domain !== undefined) updates.domain = siteText(updates.domain, 'domain', 253);
    if (updates.allowedOrigins !== undefined) {
      updates.allowedOrigins = validateAllowedOrigins(updates.allowedOrigins);
    }
    if (updates.isActive !== undefined && typeof updates.isActive !== 'boolean') {
      throw badRequest('isActive must be a boolean');
    }
    for (const flag of ['assistantEnabled', 'faqAutoReply'] as const) {
      if (updates[flag] !== undefined && typeof updates[flag] !== 'boolean') {
        throw badRequest(`${flag} must be a boolean`);
      }
    }
    // The assistant needs a Gemini key on this server; switching it on
    // without one would promise visitors answers that never come.
    if (updates.assistantEnabled === true && !assistantAvailable()) {
      throw badRequest('The assistant is not available on this server (GEMINI_API_KEY is not set)');
    }

    const site = await loadOwnedSite(req, req.params.siteId);
    const assistantBefore = site.assistantEnabled;
    const writable = site as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(updates)) {
      writable[key] = MERGED_FIELDS.has(key)
        ? { ...(writable[key] as object), ...(value as object) }
        : value;
    }
    await site.save();

    if (updates.assistantEnabled !== undefined && updates.assistantEnabled !== assistantBefore) {
      events.emit('site.assistant.updated', {
        ...auditContext(req, site),
        metadata: { enabled: site.assistantEnabled }
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

// A new site key. The widget sessions issued under the old key carry its
// fingerprint and are refused from this moment (config/tokens.ts), so every
// page still embedding the old key stops working at once — by design.
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
