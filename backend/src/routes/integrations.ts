// The workspace's integrations (plan v10 PRD-11): Slack, Telegram, webhooks.
//
//   GET    /api/integrations                 the list, addresses masked
//   POST   /api/integrations                 { kind, name, events, siteId?, url? | botToken+chatId, language? }
//   PUT    /api/integrations/:id             { name?, events?, siteId?, isActive?, language? }
//   DELETE /api/integrations/:id
//   POST   /api/integrations/:id/test        sends a test message now
//   POST   /api/integrations/:id/secret      a new webhook signing secret
//   GET    /api/integrations/:id/deliveries  the last 50 tries
//
// Owners and admins (manage_integrations), on a plan that includes them.
// A webhook's signing secret is shown once, when it is made.

import express from 'express';
import events from '../events';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { requireFeature } from '../services/entitlements';
import { query } from '../db/pool';
import { generateId } from '../db/objectId';
import { safeOutboundUrl, UnsafeUrlError } from '../services/outboundUrl';
import {
  INTEGRATION_EVENTS,
  SLACK_URL,
  TELEGRAM_CHAT,
  TELEGRAM_TOKEN,
  hintFor,
  newSigningSecret,
  openConfig,
  sealConfig,
  sendTest
} from '../services/integrations';
import type { IntegrationConfig, IntegrationKind } from '../services/integrations';
import {
  asyncHandler,
  badRequest,
  conflict,
  HttpError,
  loadOwnedSite,
  notFound,
  orgId,
  requireObjectId,
  requireOrganization
} from '../http';
import type { Request, Response } from 'express';

const router = express.Router();
router.use(auth, requireOrganization, checkPermission('manage_integrations'));

const KINDS: IntegrationKind[] = ['webhook', 'slack', 'telegram'];
const MAX_PER_WORKSPACE = 20;

interface Row {
  id: string;
  site_id: string | null;
  kind: IntegrationKind;
  name: string;
  events: string[];
  hint: string | null;
  is_active: boolean;
  last_status: string | null;
  last_delivery_at: Date | null;
  created_at: Date;
}

const present = (row: Row) => ({
  _id: row.id,
  siteId: row.site_id,
  kind: row.kind,
  name: row.name,
  events: row.events,
  hint: row.hint,
  isActive: row.is_active,
  lastStatus: row.last_status,
  lastDeliveryAt: row.last_delivery_at,
  createdAt: row.created_at
});

function eventsOf(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length) {
    throw badRequest(`events is a list of: ${INTEGRATION_EVENTS.join(', ')}`);
  }
  const list = [...new Set(value.map(String))];
  if (list.some((e) => !(INTEGRATION_EVENTS as readonly string[]).includes(e))) {
    throw badRequest(`events is a list of: ${INTEGRATION_EVENTS.join(', ')}`);
  }
  return list;
}

function nameOf(value: unknown): string {
  const name = typeof value === 'string' ? value.trim() : '';
  if (!name || name.length > 60) throw badRequest('The name is 1-60 characters');
  return name;
}

const languageOf = (value: unknown): 'tr' | 'en' => (value === 'en' ? 'en' : 'tr');

async function siteOf(req: Request, value: unknown): Promise<string | null> {
  if (value === undefined || value === null || value === '') return null;
  return String((await loadOwnedSite(req, value))._id);
}

/** Checks what the integration will call, before it is saved. */
async function configFor(
  kind: IntegrationKind,
  body: Record<string, unknown>
): Promise<IntegrationConfig> {
  const language = languageOf(body.language);
  if (kind === 'slack') {
    const url = typeof body.url === 'string' ? body.url.trim() : '';
    if (!SLACK_URL.test(url)) {
      throw badRequest('A Slack incoming-webhook address: https://hooks.slack.com/services/…');
    }
    return { url, language };
  }
  if (kind === 'telegram') {
    const botToken = typeof body.botToken === 'string' ? body.botToken.trim() : '';
    const chatId = typeof body.chatId === 'string' ? body.chatId.trim() : String(body.chatId ?? '');
    if (!TELEGRAM_TOKEN.test(botToken)) throw badRequest('Not a Telegram bot token');
    if (!TELEGRAM_CHAT.test(chatId)) throw badRequest('Not a Telegram chat id');
    return { botToken, chatId, language };
  }
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (url.length > 500) throw badRequest('The address is too long');
  try {
    const target = await safeOutboundUrl(url);
    if (target.url.protocol !== 'https:')
      throw new UnsafeUrlError('Only https addresses are allowed');
  } catch (error) {
    if (error instanceof UnsafeUrlError) throw new HttpError(400, error.message, 'UNSAFE_URL');
    throw error;
  }
  return { url, secret: newSigningSecret(), language };
}

async function load(req: Request, id: unknown): Promise<Row & { config: string }> {
  const integrationId = requireObjectId(id, 'integration id');
  const { rows } = await query<Row & { config: string }>(
    'SELECT * FROM integrations WHERE id = $1 AND organization_id = $2',
    [integrationId, orgId(req)]
  );
  if (!rows[0]) throw notFound('Integration');
  return rows[0];
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

router.get(
  '/',
  requireFeature('integrations'),
  asyncHandler(async (req: Request, res: Response) => {
    const { rows } = await query<Row>(
      `SELECT id, site_id, kind, name, events, hint, is_active, last_status, last_delivery_at, created_at
         FROM integrations WHERE organization_id = $1 ORDER BY created_at`,
      [orgId(req)]
    );
    res.json({ integrations: rows.map(present), events: INTEGRATION_EVENTS });
  })
);

router.post(
  '/',
  requireFeature('integrations'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const kind = body.kind as IntegrationKind;
    if (!KINDS.includes(kind)) throw badRequest(`kind is one of: ${KINDS.join(', ')}`);
    const name = nameOf(body.name);
    const list = eventsOf(body.events);
    const siteId = await siteOf(req, body.siteId);
    const { rows: count } = await query<{ n: number }>(
      'SELECT count(*)::int AS n FROM integrations WHERE organization_id = $1',
      [orgId(req)]
    );
    if (count[0].n >= MAX_PER_WORKSPACE) {
      throw conflict(`A workspace can have ${MAX_PER_WORKSPACE} integrations`, 'INTEGRATION_LIMIT');
    }
    const config = await configFor(kind, body);
    const id = generateId();
    const { rows } = await query<Row>(
      `INSERT INTO integrations (id, organization_id, site_id, kind, name, events, config, hint, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, site_id, kind, name, events, hint, is_active, last_status, last_delivery_at, created_at`,
      [
        id,
        orgId(req),
        siteId,
        kind,
        name,
        list,
        sealConfig(config),
        hintFor(kind, config),
        String(req.userId)
      ]
    );
    audit(req, 'integration.created', id, { kind, events: list });
    res.status(201).json({
      integration: present(rows[0]),
      // Shown this once: the receiver checks the signature with it.
      ...(kind === 'webhook' ? { signingSecret: config.secret } : {})
    });
  })
);

router.put(
  '/:id',
  requireFeature('integrations'),
  asyncHandler(async (req: Request, res: Response) => {
    const current = await load(req, req.params.id);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = body.name === undefined ? current.name : nameOf(body.name);
    const list = body.events === undefined ? current.events : eventsOf(body.events);
    const siteId = body.siteId === undefined ? current.site_id : await siteOf(req, body.siteId);
    const isActive = typeof body.isActive === 'boolean' ? body.isActive : current.is_active;
    let config = current.config;
    if (body.language === 'tr' || body.language === 'en') {
      const opened = openConfig(current.config);
      if (opened) config = sealConfig({ ...opened, language: body.language });
    }
    const { rows } = await query<Row>(
      `UPDATE integrations
          SET name = $2, events = $3, site_id = $4, is_active = $5, config = $6, updated_at = now()
        WHERE id = $1
        RETURNING id, site_id, kind, name, events, hint, is_active, last_status, last_delivery_at, created_at`,
      [current.id, name, list, siteId, isActive, config]
    );
    audit(req, 'integration.updated', current.id, {
      fields: Object.keys(body).filter((k) =>
        ['name', 'events', 'siteId', 'isActive', 'language'].includes(k)
      )
    });
    res.json({ integration: present(rows[0]) });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    // Removing one is allowed on any plan: a downgraded workspace can tidy up.
    const current = await load(req, req.params.id);
    await query('DELETE FROM integrations WHERE id = $1', [current.id]);
    audit(req, 'integration.deleted', current.id, { kind: current.kind });
    res.status(204).end();
  })
);

router.post(
  '/:id/test',
  requireFeature('integrations'),
  asyncHandler(async (req: Request, res: Response) => {
    const current = await load(req, req.params.id);
    res.json(await sendTest(current.id, orgId(req)));
  })
);

router.post(
  '/:id/secret',
  requireFeature('integrations'),
  asyncHandler(async (req: Request, res: Response) => {
    const current = await load(req, req.params.id);
    if (current.kind !== 'webhook') throw badRequest('Only a webhook has a signing secret');
    const opened = openConfig(current.config);
    if (!opened) throw conflict('The integration cannot be read; remove it and add it again');
    const secret = newSigningSecret();
    await query('UPDATE integrations SET config = $2, updated_at = now() WHERE id = $1', [
      current.id,
      sealConfig({ ...opened, secret })
    ]);
    audit(req, 'integration.updated', current.id, { fields: ['secret'] });
    res.json({ signingSecret: secret });
  })
);

router.get(
  '/:id/deliveries',
  asyncHandler(async (req: Request, res: Response) => {
    const current = await load(req, req.params.id);
    const { rows } = await query(
      `SELECT id, event, status, attempts, last_status_code, last_error, created_at, finished_at, next_attempt_at
         FROM integration_deliveries WHERE integration_id = $1
        ORDER BY created_at DESC LIMIT 50`,
      [current.id]
    );
    res.json({
      deliveries: rows.map((r) => ({
        _id: r.id,
        event: r.event,
        status: r.status,
        attempts: r.attempts,
        statusCode: r.last_status_code,
        error: r.last_error,
        createdAt: r.created_at,
        finishedAt: r.finished_at,
        nextAttemptAt: r.status === 'pending' ? r.next_attempt_at : null
      }))
    });
  })
);

export default router;
