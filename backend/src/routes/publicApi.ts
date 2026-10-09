// The public REST API, version 1 (plan v10 PRD-12).
//
//   Authorization: Bearer sk_live_…     a workspace key (Settings → API keys)
//
//   GET    /api/v1/openapi.json                     the description (no key)
//   GET    /api/v1/sites
//   GET    /api/v1/conversations?siteId&status&updatedSince&limit&cursor
//   GET    /api/v1/conversations/:id
//   PATCH  /api/v1/conversations/:id                { status?, tags? }       write
//   GET    /api/v1/conversations/:id/messages?after&limit
//   POST   /api/v1/conversations/:id/messages       { content, senderName? } write
//   GET    /api/v1/visitors?siteId&limit
//   GET    /api/v1/faqs?siteId
//   POST   /api/v1/faqs                             { siteId, question, answer, … } write
//   PATCH  /api/v1/faqs/:id                                                  write
//   DELETE /api/v1/faqs/:id                                                  write
//
// GET needs the read scope, everything else write. Each key has its own
// rate limit. Answers carry only what the API promises: no IP addresses, no
// internal notes, no other workspace's ids — the tenant filter is in every
// query, as in the panel.

import express from 'express';
import events from '../events';
import Conversation from '../models/Conversation';
import Message from '../models/Message';
import { query } from '../db/pool';
import { generateId, isValidObjectId } from '../db/objectId';
import { asyncHandler, asyncMiddleware, badRequest, forbidden, HttpError, notFound } from '../http';
import { callerForKey } from '../services/apiKeys';
import type { ApiCaller } from '../services/apiKeys';
import { hasFeature } from '../services/entitlements';
import { createLimiter } from '../middleware/rateLimit';
import { setConversationStatus } from '../services/conversationStatus';
import { siteHold } from '../services/planOverage';
import { takeOver } from '../services/assistant';
import { refreshSla } from '../services/conversationSla';
import { notifyIntegrations } from '../services/integrations';
import { forgetSiteBundle } from '../services/widgetBundle';
import { AdminNotifier, WidgetNotifier, ioFrom } from '../realtime';
import { messagesPage } from '../db/queries';
import { openApiDocument } from '../publicApi/openapi';
import type { NextFunction, Request, Response } from 'express';
import type { Doc } from '../db/model';
import type { ConversationDoc } from '../models/Conversation';

const router = express.Router();

const caller = (res: Response) => res.locals.apiCaller as ApiCaller;

router.get('/openapi.json', (req: Request, res: Response) => {
  const base = String(process.env.APP_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(
    /\/+$/,
    ''
  );
  res.set('Cache-Control', 'public, max-age=300').json(openApiDocument(base));
});

// ------------------------------------------------------------- the key

router.use(
  asyncMiddleware(async (req: Request, res: Response, next: NextFunction) => {
    const header = req.get('authorization') || '';
    const key = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const found = key ? await callerForKey(key) : null;
    if (!found) throw new HttpError(401, 'A valid API key is required', 'INVALID_API_KEY');
    if (!(await hasFeature(found.organizationId, 'api'))) {
      throw forbidden('The API is part of the Enterprise plan', 'PLAN_UPGRADE_REQUIRED');
    }
    const scope = req.method === 'GET' || req.method === 'HEAD' ? 'read' : 'write';
    if (!found.scopes.includes(scope)) {
      throw forbidden(`This key has no ${scope} scope`, 'INSUFFICIENT_SCOPE');
    }
    res.locals.apiCaller = found;
    next();
  })
);

router.use(
  createLimiter({
    name: 'public-api',
    code: 'RATE_LIMITED',
    message: 'Too many requests for this key, please slow down.',
    windowMs: 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 300 : 100000,
    keyGenerator: (req: Request) => `key:${(req.res?.locals.apiCaller as ApiCaller).keyId}`
  })
);

// ------------------------------------------------------------- helpers

const LIMIT_MAX = 100;
const limitOf = (value: unknown, fallback = 50) =>
  Math.min(Math.max(Number(value) || fallback, 1), LIMIT_MAX);

const idOf = (value: unknown, what: string): string => {
  if (!isValidObjectId(value)) throw notFound(what);
  return String(value);
};

async function ownSite(organizationId: string, siteId: unknown): Promise<string> {
  const id = idOf(siteId, 'Site');
  const { rowCount } = await query('SELECT 1 FROM sites WHERE id = $1 AND organization_id = $2', [
    id,
    organizationId
  ]);
  if (!rowCount) throw notFound('Site');
  return id;
}

async function ownConversation(organizationId: string, id: unknown): Promise<Doc<ConversationDoc>> {
  const conversation = await Conversation.findOne({
    _id: idOf(id, 'Conversation'),
    organizationId
  });
  if (!conversation) throw notFound('Conversation');
  return conversation;
}

const iso = (value: unknown) => (value ? new Date(value as string).toISOString() : null);

// A row from SQL or a document from the model: the two shapes are read alike.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function conversationOut(c: Record<string, any>) {
  return {
    id: String(c.id ?? c._id),
    siteId: String(c.site_id ?? c.siteId),
    ticketId: c.ticket_id ?? c.ticketId ?? null,
    status: c.status,
    priority: c.priority,
    visitor: {
      id: c.visitor_id ?? c.visitorId,
      name: c.visitor_name ?? c.visitorName ?? null,
      email: c.visitor_email ?? c.visitorEmail ?? null,
      phone: c.visitor_phone ?? c.visitorPhone ?? null
    },
    assignedAgentId: (c.assigned_agent_id ?? c.assignedAgent?._id ?? c.assignedAgent) || null,
    tags: c.tags ?? [],
    rating: c.rating?.score ? { score: c.rating.score, comment: c.rating.feedback ?? null } : null,
    createdAt: iso(c.created_at ?? c.createdAt),
    lastMessageAt: iso(c.last_message_at ?? c.lastMessageAt),
    closedAt: iso(c.closed_at ?? c.closedAt)
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function messageOut(m: Record<string, any>) {
  return {
    id: String(m._id ?? m.id),
    senderType: m.senderType ?? m.sender_type,
    senderName: m.senderName ?? m.sender_name ?? null,
    content: m.content,
    type: m.messageType ?? m.message_type ?? 'text',
    file: m.fileData?.url
      ? {
          url: m.fileData.url,
          name: m.fileData.originalName ?? null,
          size: m.fileData.size ?? null
        }
      : null,
    createdAt: iso(m.createdAt ?? m.created_at)
  };
}

const encodeCursor = (at: Date, id: string) =>
  Buffer.from(`${new Date(at).toISOString()}|${id}`).toString('base64url');
function decodeCursor(cursor: unknown): { at: string; id: string } | null {
  if (typeof cursor !== 'string' || !cursor) return null;
  const [at, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  return at && id && !Number.isNaN(Date.parse(at)) ? { at, id } : null;
}

const STATUSES = ['open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned'];

// ---------------------------------------------------------------- sites

router.get(
  '/sites',
  asyncHandler(async (_req: Request, res: Response) => {
    const { rows } = await query(
      `SELECT id, name, domain, is_active, created_at FROM sites
        WHERE organization_id = $1 ORDER BY created_at`,
      [caller(res).organizationId]
    );
    res.json({
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        domain: r.domain,
        active: r.is_active,
        createdAt: iso(r.created_at)
      }))
    });
  })
);

// -------------------------------------------------------- conversations

router.get(
  '/conversations',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = caller(res).organizationId;
    const params: unknown[] = [organizationId];
    const where = ['c.organization_id = $1'];
    if (req.query.siteId !== undefined) {
      params.push(await ownSite(organizationId, req.query.siteId));
      where.push(`c.site_id = $${params.length}`);
    }
    if (req.query.status !== undefined) {
      if (!STATUSES.includes(String(req.query.status))) {
        throw badRequest(`status is one of: ${STATUSES.join(', ')}`);
      }
      params.push(String(req.query.status));
      where.push(`c.status = $${params.length}`);
    }
    if (req.query.updatedSince !== undefined) {
      const since = new Date(String(req.query.updatedSince));
      if (Number.isNaN(since.getTime())) throw badRequest('updatedSince is an ISO date and time');
      params.push(since);
      where.push(`c.last_message_at >= $${params.length}`);
    }
    const cursor = decodeCursor(req.query.cursor);
    if (cursor) {
      params.push(cursor.at, cursor.id);
      where.push(
        `(c.last_message_at, c.id) < ($${params.length - 1}::timestamptz, $${params.length})`
      );
    }
    const limit = limitOf(req.query.limit);
    params.push(limit + 1);
    const { rows } = await query(
      `SELECT c.* FROM conversations c WHERE ${where.join(' AND ')}
        ORDER BY c.last_message_at DESC, c.id DESC LIMIT $${params.length}`,
      params
    );
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    res.json({
      data: page.map(conversationOut),
      nextCursor: rows.length > limit && last ? encodeCursor(last.last_message_at, last.id) : null
    });
  })
);

router.get(
  '/conversations/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await ownConversation(caller(res).organizationId, req.params.id);
    res.json({ data: conversationOut(conversation.toObject()) });
  })
);

router.patch(
  '/conversations/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const key = caller(res);
    const conversation = await ownConversation(key.organizationId, req.params.id);
    const hold = await siteHold(conversation.siteId);
    if (hold) throw forbidden('The site is read-only', hold);
    const body = (req.body ?? {}) as Record<string, unknown>;
    if (body.tags !== undefined) {
      if (
        !Array.isArray(body.tags) ||
        body.tags.length > 10 ||
        body.tags.some((t) => typeof t !== 'string' || !t.trim() || t.length > 32)
      ) {
        throw badRequest('tags is a list of up to 10 names of 1-32 characters');
      }
      conversation.tags = [...new Set(body.tags.map((t) => String(t).trim()))];
      await conversation.save();
    }
    if (body.status !== undefined) {
      if (!['open', 'pending', 'resolved', 'closed'].includes(String(body.status))) {
        throw badRequest('status is one of: open, pending, resolved, closed');
      }
      await setConversationStatus(
        ioFrom(req),
        conversation,
        body.status as ConversationDoc['status'],
        {
          organizationId: key.organizationId,
          userId: null,
          ip: req.ip,
          ua: req.get('user-agent'),
          via: `api:${key.name}`
        }
      );
    } else if (body.tags !== undefined) {
      const io = ioFrom(req);
      if (io) new AdminNotifier(io).conversationUpdated(conversation, conversation);
    }
    res.json({ data: conversationOut(conversation.toObject()) });
  })
);

// ------------------------------------------------------------- messages

router.get(
  '/conversations/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const conversation = await ownConversation(caller(res).organizationId, req.params.id);
    const page = await messagesPage(conversation._id, {
      after: req.query.after,
      limit: limitOf(req.query.limit, 100)
    });
    res.json({ data: page.messages.map(messageOut), hasMore: page.hasMore });
  })
);

/**
 * A reply written by the caller's system. It reaches the visitor as a team
 * message, silences the FAQ assistant like an agent's reply does, and counts
 * as the first response; it is nobody's assignment.
 */
router.post(
  '/conversations/:id/messages',
  asyncHandler(async (req: Request, res: Response) => {
    const key = caller(res);
    const conversation = await ownConversation(key.organizationId, req.params.id);
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content || content.length > 5000) throw badRequest('content is 1-5000 characters');
    const senderName =
      typeof req.body?.senderName === 'string' && req.body.senderName.trim()
        ? req.body.senderName.trim().slice(0, 60)
        : 'Support';
    if (['resolved', 'closed'].includes(conversation.status)) {
      throw new HttpError(409, 'The conversation has ended', 'CONVERSATION_CLOSED');
    }
    const hold = await siteHold(conversation.siteId);
    if (hold) throw forbidden('The site is read-only', hold);

    const io = ioFrom(req);
    if (conversation.responseOwner === 'assistant' && (await takeOver(io, conversation))) {
      conversation.responseOwner = 'human';
    }
    const message = await Message.create({
      conversationId: conversation._id,
      senderType: 'agent',
      senderId: `api:${key.keyId}`,
      senderName,
      content,
      messageType: 'text',
      isRead: true,
      clientMessageId: null
    });
    if (!conversation.firstResponseAt) {
      conversation.firstResponseAt = new Date();
      refreshSla(conversation);
    }
    conversation.lastMessageAt = new Date();
    await conversation.save();

    if (io) {
      new WidgetNotifier(io).newMessage(conversation._id, message.toObject());
      new AdminNotifier(io).messageAdded(conversation, message.toObject());
    }
    notifyIntegrations('message.created', conversation, { message });
    events.emit('api.message', { organizationId: key.organizationId, keyId: key.keyId });
    res.status(201).json({ data: messageOut(message.toObject()) });
  })
);

// ------------------------------------------------------------- visitors

router.get(
  '/visitors',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = caller(res).organizationId;
    const siteId = await ownSite(organizationId, req.query.siteId);
    const { rows } = await query(
      `SELECT visitor_id, country, browser, os, current_page, last_active_at, created_at
         FROM visitors WHERE organization_id = $1 AND site_id = $2
        ORDER BY last_active_at DESC LIMIT $3`,
      [organizationId, siteId, limitOf(req.query.limit)]
    );
    res.json({
      data: rows.map((r) => ({
        id: r.visitor_id,
        country: r.country,
        browser: r.browser,
        os: r.os,
        currentPage: r.current_page,
        lastActiveAt: iso(r.last_active_at),
        firstSeenAt: iso(r.created_at)
      }))
    });
  })
);

// ------------------------------------------------------------------ FAQ

interface FaqRow {
  id: string;
  site_id: string;
  question: string;
  answer: string;
  category: string;
  keywords: string[];
  is_active: boolean;
  sort_order: number;
  updated_at: Date;
}

const faqOut = (r: FaqRow) => ({
  id: r.id,
  siteId: r.site_id,
  question: r.question,
  answer: r.answer,
  category: r.category,
  keywords: r.keywords,
  active: r.is_active,
  order: r.sort_order,
  updatedAt: iso(r.updated_at)
});

function faqFields(body: Record<string, unknown>, partial: boolean) {
  const out: Record<string, unknown> = {};
  const text = (name: string, max: number) => {
    const value = body[name];
    if (value === undefined && partial) return;
    if (typeof value !== 'string' || !value.trim() || value.length > max) {
      throw badRequest(`${name} is 1-${max} characters`);
    }
    out[name] = value.trim();
  };
  text('question', 500);
  text('answer', 5000);
  if (body.category !== undefined) {
    if (typeof body.category !== 'string' || body.category.length > 60) {
      throw badRequest('category is up to 60 characters');
    }
    out.category = body.category.trim() || 'General';
  }
  if (body.keywords !== undefined) {
    if (!Array.isArray(body.keywords) || body.keywords.length > 20) {
      throw badRequest('keywords is a list of up to 20 words');
    }
    out.keywords = body.keywords.map((k) => String(k).slice(0, 40));
  }
  if (body.active !== undefined) out.is_active = body.active === true;
  if (body.order !== undefined) out.sort_order = Number(body.order) || 0;
  return out;
}

router.get(
  '/faqs',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = caller(res).organizationId;
    const siteId = await ownSite(organizationId, req.query.siteId);
    const { rows } = await query<FaqRow>(
      'SELECT * FROM faqs WHERE site_id = $1 ORDER BY sort_order, created_at LIMIT 500',
      [siteId]
    );
    res.json({ data: rows.map(faqOut) });
  })
);

router.post(
  '/faqs',
  asyncHandler(async (req: Request, res: Response) => {
    const organizationId = caller(res).organizationId;
    const siteId = await ownSite(organizationId, req.body?.siteId);
    const fields = faqFields(req.body ?? {}, false);
    const { rows } = await query<FaqRow>(
      `INSERT INTO faqs (id, site_id, question, answer, category, keywords, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        generateId(),
        siteId,
        fields.question,
        fields.answer,
        fields.category ?? 'General',
        fields.keywords ?? [],
        fields.is_active ?? true,
        fields.sort_order ?? 0
      ]
    );
    await forgetSiteBundle(siteId);
    res.status(201).json({ data: faqOut(rows[0]) });
  })
);

async function ownFaq(organizationId: string, id: unknown): Promise<FaqRow> {
  const { rows } = await query<FaqRow>(
    `SELECT f.* FROM faqs f JOIN sites s ON s.id = f.site_id
      WHERE f.id = $1 AND s.organization_id = $2`,
    [idOf(id, 'FAQ'), organizationId]
  );
  if (!rows[0]) throw notFound('FAQ');
  return rows[0];
}

router.patch(
  '/faqs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const faq = await ownFaq(caller(res).organizationId, req.params.id);
    const fields = faqFields(req.body ?? {}, true);
    const columns = Object.keys(fields);
    if (!columns.length) {
      res.json({ data: faqOut(faq) });
      return;
    }
    const { rows } = await query<FaqRow>(
      `UPDATE faqs SET ${columns.map((c, i) => `${c} = $${i + 2}`).join(', ')}, updated_at = now()
        WHERE id = $1 RETURNING *`,
      [faq.id, ...columns.map((c) => fields[c])]
    );
    await forgetSiteBundle(faq.site_id);
    res.json({ data: faqOut(rows[0]) });
  })
);

router.delete(
  '/faqs/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const faq = await ownFaq(caller(res).organizationId, req.params.id);
    await query('DELETE FROM faqs WHERE id = $1', [faq.id]);
    await forgetSiteBundle(faq.site_id);
    res.status(204).end();
  })
);

export default router;
