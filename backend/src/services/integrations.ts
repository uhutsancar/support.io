// Slack, Telegram and outgoing webhooks (plan v10 PRD-11).
//
// An event of a conversation — created, a message, closed, rated — becomes
// one delivery per integration that asked for it. A delivery is tried at
// once; when that fails, the SLA pass (services/slaSweeper.ts, the only
// timer) tries again after 1, 5, 15 and 30 minutes, then every few hours,
// for at most 24 hours. Each try first claims the row, so the immediate
// attempt and the timer never send the same delivery twice.
//
// Every call goes through services/outboundUrl.ts: https only, public
// addresses only, and the connection is made to the address that was
// checked (no DNS rebinding). Slack must be hooks.slack.com; Telegram is
// api.telegram.org. Webhooks are signed with the integration's own secret:
//
//   X-SupportIO-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "t.body">
//
// The address and keys are sealed in the database; the log keeps the event,
// the outcome and the HTTP status, and the payload only until it is sent.

import crypto from 'crypto';
import https from 'https';
import { query } from '../db/pool';
import { generateId } from '../db/objectId';
import { open, seal } from '../config/secretBox';
import { pinnedLookup, safeOutboundUrl, UnsafeUrlError } from './outboundUrl';
import type { SafeTarget } from './outboundUrl';
import { hasFeature } from './entitlements';

export const INTEGRATION_EVENTS = [
  'conversation.created',
  'message.created',
  'conversation.closed',
  'rating.created'
] as const;
export type IntegrationEvent = (typeof INTEGRATION_EVENTS)[number] | 'integration.test';
export type IntegrationKind = 'webhook' | 'slack' | 'telegram';

export interface IntegrationConfig {
  url?: string;
  secret?: string;
  botToken?: string;
  chatId?: string;
  language?: 'tr' | 'en';
}

/** What an event says about its conversation. */
export interface IntegrationEventData {
  organizationId: string;
  site: { id: string; name?: string | null };
  conversation: {
    id: string;
    ticketId?: string | null;
    status?: string | null;
    visitorName?: string | null;
    visitorEmail?: string | null;
  };
  message?: {
    id: string;
    senderType: string;
    senderName?: string | null;
    content: string;
    createdAt?: string | Date | null;
  };
  rating?: { score: number; comment?: string | null };
}

const MAX_HOURS = 24;
const BACKOFF_MINUTES = [1, 5, 15, 30, 60, 120, 240, 480, 720];
const LEASE_SECONDS = 120;
const MAX_ERROR = 200;

export const SLACK_URL = /^https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/-]{20,200}$/;
export const TELEGRAM_TOKEN = /^\d{5,15}:[A-Za-z0-9_-]{30,60}$/;
export const TELEGRAM_CHAT = /^(-?\d{1,20}|@[A-Za-z][A-Za-z0-9_]{4,31})$/;

// ------------------------------------------------------------ the network

export interface Response {
  status: number;
}
/** Makes the call to an address outboundUrl.ts has already cleared. */
type Poster = (
  target: SafeTarget,
  body: string,
  headers: Record<string, string>
) => Promise<Response>;

/**
 * Clears an address before anything is sent to it: https, public addresses
 * only, resolved once. Done here, ahead of every transport — the real one,
 * the development recorder and a test's — so none can skip it.
 */
async function checkedTarget(url: string): Promise<SafeTarget> {
  const target = await safeOutboundUrl(url);
  if (target.url.protocol !== 'https:') {
    throw new UnsafeUrlError('Only https addresses are allowed');
  }
  return target;
}

/** POSTs to the cleared address itself (pinned lookup: no second DNS answer). */
const postSafely: Poster = (target, body, headers) =>
  new Promise<Response>((resolve, reject) => {
    const request = https.request(
      target.url,
      {
        method: 'POST',
        lookup: pinnedLookup(target) as never,
        headers: { ...headers, 'Content-Length': String(Buffer.byteLength(body)) },
        timeout: 10_000
      },
      (response) => {
        // The answer is not needed, only its status; a few bytes are read
        // so the socket can close.
        response.resume();
        response.on('end', () => resolve({ status: response.statusCode ?? 0 }));
      }
    );
    request.on('timeout', () => request.destroy(new Error('timed out')));
    request.on('error', reject);
    request.end(body);
  });

// Development and CI (INTEGRATION_TRANSPORT=memory, never in production):
// calls are kept here instead of made, so the suites can read what Slack,
// Telegram or a webhook would have received. GET /api/dev/integration-outbox.
export interface RecordedCall {
  organizationId: string | null;
  url: string;
  headers: Record<string, string>;
  body: string;
  at: string;
}
const recordedCalls: RecordedCall[] = [];
const memoryTransport = () =>
  process.env.INTEGRATION_TRANSPORT === 'memory' && process.env.NODE_ENV !== 'production';

/** What the memory transport kept for one organization. */
export function integrationOutbox(organizationId: string): RecordedCall[] {
  return recordedCalls.filter((call) => call.organizationId === organizationId);
}

let poster: Poster = postSafely;

/** Tests replace the network with a recorder; null puts the real one back. */
export function useIntegrationPoster(next: Poster | null): void {
  poster = next ?? postSafely;
}

// ---------------------------------------------------------------- texts

const TEXT = {
  tr: {
    created: 'Yeni konuşma',
    closed: 'Konuşma kapandı',
    rating: 'Yeni puan',
    test: 'Support.io bağlantısı çalışıyor.',
    visitor: 'Ziyaretçi',
    open: 'Panelde aç'
  },
  en: {
    created: 'New conversation',
    closed: 'Conversation closed',
    rating: 'New rating',
    test: 'The Support.io connection works.',
    visitor: 'Visitor',
    open: 'Open in the panel'
  }
};

const baseUrl = () => String(process.env.APP_BASE_URL || '').replace(/\/+$/, '');

/** The line Slack and Telegram show for an event: plain text, no markup. */
export function eventText(
  event: IntegrationEvent,
  data: IntegrationEventData | null,
  language: 'tr' | 'en' = 'tr'
): string {
  const words = TEXT[language];
  if (event === 'integration.test' || !data) return words.test;
  const where = data.site.name ? ` · ${data.site.name}` : '';
  const visitor = data.conversation.visitorName || words.visitor;
  const ticket = data.conversation.ticketId ? ` ${data.conversation.ticketId}` : '';
  const link = baseUrl()
    ? `\n${words.open}: ${baseUrl()}/dashboard/conversations?conversation=${data.conversation.id}`
    : '';
  const clip = (text: string) => (text.length > 500 ? `${text.slice(0, 500)}…` : text);
  if (event === 'conversation.created') {
    const first = data.message?.content ? `\n${visitor}: ${clip(data.message.content)}` : '';
    return `${words.created}${ticket}${where}${first}${link}`;
  }
  if (event === 'message.created' && data.message) {
    const from =
      data.message.senderType === 'visitor' ? visitor : data.message.senderName || 'Support';
    return `${from}${where}: ${clip(data.message.content)}${link}`;
  }
  if (event === 'conversation.closed') return `${words.closed}${ticket}${where}${link}`;
  if (event === 'rating.created' && data.rating) {
    const comment = data.rating.comment ? `\n“${clip(data.rating.comment)}”` : '';
    return `${words.rating}: ${data.rating.score}/5${ticket}${where}${comment}${link}`;
  }
  return `${event}${ticket}${where}${link}`;
}

// ------------------------------------------------------------ the config

export function sealConfig(config: IntegrationConfig): string {
  return seal(JSON.stringify(config));
}

export function openConfig(sealed: string): IntegrationConfig | null {
  const plain = open(sealed);
  if (!plain) return null;
  try {
    return JSON.parse(plain) as IntegrationConfig;
  } catch {
    return null;
  }
}

/** What the panel may see of the address: enough to recognise it. */
export function hintFor(kind: IntegrationKind, config: IntegrationConfig): string {
  if (kind === 'telegram') return `chat ${config.chatId}`;
  if (kind === 'slack') return `hooks.slack.com/…${String(config.url).slice(-4)}`;
  try {
    const url = new URL(String(config.url));
    // Only the host: many receivers carry a token in the path.
    return `${url.host}/…`;
  } catch {
    return '';
  }
}

export const newSigningSecret = () => `whsec_${crypto.randomBytes(24).toString('base64url')}`;

/** The webhook signature header for a body, at a time (unix seconds). */
export function signature(secret: string, body: string, at: number): string {
  const mac = crypto.createHmac('sha256', secret).update(`${at}.${body}`).digest('hex');
  return `t=${at},v1=${mac}`;
}

// -------------------------------------------------------------- delivery

interface Claimed {
  id: string;
  integration_id: string;
  organization_id?: string;
  event: IntegrationEvent;
  payload: { data?: IntegrationEventData | null } & Record<string, unknown>;
  attempts: number;
  created_at: Date;
  kind: IntegrationKind;
  config: string;
}

/** Takes a due delivery for this worker; null when it is not due or another has it. */
async function claim(id: string): Promise<Claimed | null> {
  const { rows } = await query<Claimed>(
    `UPDATE integration_deliveries d
        SET attempts = d.attempts + 1,
            next_attempt_at = now() + make_interval(secs => $2)
       FROM integrations i
      WHERE d.id = $1 AND d.status = 'pending' AND d.next_attempt_at <= now()
        AND i.id = d.integration_id
      RETURNING d.id, d.integration_id, d.organization_id, d.event, d.payload, d.attempts,
                d.created_at, i.kind, i.config`,
    [id, LEASE_SECONDS]
  );
  return rows[0] ?? null;
}

async function send(item: Claimed & { organization_id?: string }): Promise<Response> {
  if (memoryTransport()) {
    const recorder: Poster = async (target, body, headers) => {
      recordedCalls.push({
        organizationId: item.organization_id ?? null,
        url: target.url.href.replace(/bot\d+:[A-Za-z0-9_-]+/, 'bot…'),
        headers,
        body,
        at: new Date().toISOString()
      });
      recordedCalls.splice(0, Math.max(0, recordedCalls.length - 500));
      return { status: 200 };
    };
    return sendWith(item, recorder);
  }
  return sendWith(item, poster);
}

async function sendWith(item: Claimed, transport: Poster): Promise<Response> {
  const post = async (url: string, body: string, headers: Record<string, string>) =>
    transport(await checkedTarget(url), body, headers);
  const config = openConfig(item.config);
  if (!config) throw new Error('the integration cannot be read');
  const data = (item.payload?.data ?? null) as IntegrationEventData | null;
  if (item.kind === 'slack') {
    if (!config.url || !SLACK_URL.test(config.url)) throw new UnsafeUrlError('Not a Slack address');
    const body = JSON.stringify({ text: eventText(item.event, data, config.language) });
    return post(config.url, body, { 'Content-Type': 'application/json' });
  }
  if (item.kind === 'telegram') {
    const body = JSON.stringify({
      chat_id: config.chatId,
      text: eventText(item.event, data, config.language),
      disable_web_page_preview: true
    });
    return post(`https://api.telegram.org/bot${config.botToken}/sendMessage`, body, {
      'Content-Type': 'application/json'
    });
  }
  const body = JSON.stringify(item.payload);
  const at = Math.floor(Date.now() / 1000);
  return post(String(config.url), body, {
    'Content-Type': 'application/json',
    'User-Agent': 'Support.io-Webhooks/1',
    'X-SupportIO-Event': item.event,
    'X-SupportIO-Delivery': item.id,
    'X-SupportIO-Signature': signature(String(config.secret), body, at)
  });
}

/** What can be said about a failure without leaking an address or a token. */
function describe(error: unknown): string {
  if (error instanceof UnsafeUrlError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/bot\d+:[A-Za-z0-9_-]+/g, 'bot…').slice(0, MAX_ERROR);
}

/** One try of one delivery. Returns its outcome, or null when it was not due. */
export async function attemptDelivery(
  id: string
): Promise<'delivered' | 'retry' | 'failed' | null> {
  const item = await claim(id);
  if (!item) return null;
  let status = 0;
  let error: string | null = null;
  try {
    status = (await send(item)).status;
    if (status < 200 || status >= 300) error = `HTTP ${status}`;
  } catch (failure) {
    error = describe(failure);
  }

  if (!error) {
    await query(
      `UPDATE integration_deliveries
          SET status = 'delivered', finished_at = now(), payload = NULL,
              last_status_code = $2, last_error = NULL
        WHERE id = $1`,
      [item.id, status]
    );
    await query(
      `UPDATE integrations SET last_status = 'ok', last_delivery_at = now() WHERE id = $1`,
      [item.integration_id]
    );
    return 'delivered';
  }

  const ageHours = (Date.now() - new Date(item.created_at).getTime()) / 3_600_000;
  const wait = BACKOFF_MINUTES[Math.min(item.attempts - 1, BACKOFF_MINUTES.length - 1)];
  const giveUp =
    item.event === 'integration.test' || ageHours + wait / 60 > MAX_HOURS || item.attempts >= 12;
  await query(
    `UPDATE integration_deliveries
        SET status = $2, finished_at = CASE WHEN $2 = 'failed' THEN now() END,
            payload = CASE WHEN $2 = 'failed' THEN NULL ELSE payload END,
            next_attempt_at = now() + make_interval(mins => $3),
            last_status_code = $4, last_error = $5
      WHERE id = $1`,
    [item.id, giveUp ? 'failed' : 'pending', wait, status || null, error]
  );
  await query(
    `UPDATE integrations SET last_status = 'error', last_delivery_at = now() WHERE id = $1`,
    [item.integration_id]
  );
  return giveUp ? 'failed' : 'retry';
}

/**
 * Turns an event into deliveries for the integrations that asked for it, and
 * tries each at once. Never throws: the conversation goes on regardless.
 */
export async function dispatchIntegrationEvent(
  event: IntegrationEvent,
  data: IntegrationEventData
): Promise<number> {
  try {
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM integrations
        WHERE organization_id = $1 AND is_active
          AND (site_id IS NULL OR site_id = $2) AND $3 = ANY(events)`,
      [data.organizationId, data.site.id, event]
    );
    if (!rows.length) return 0;
    // A workspace that left the paid plan keeps its settings, not the service.
    if (!(await hasFeature(data.organizationId, 'integrations'))) return 0;
    const ids: string[] = [];
    for (const row of rows) {
      const id = generateId();
      // eslint-disable-next-line no-await-in-loop -- a few integrations per workspace
      await query(
        `INSERT INTO integration_deliveries (id, integration_id, organization_id, event, payload)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          id,
          row.id,
          data.organizationId,
          event,
          JSON.stringify({ id, event, createdAt: new Date().toISOString(), data: publicData(data) })
        ]
      );
      ids.push(id);
    }
    await Promise.all(ids.map((id) => attemptDelivery(id).catch(() => null)));
    return ids.length;
  } catch (error) {
    console.error('[integrations] could not dispatch', { event }, error);
    return 0;
  }
}

/** The event as a webhook receives it: no workspace id, nothing internal. */
function publicData(data: IntegrationEventData) {
  return {
    site: data.site,
    conversation: data.conversation,
    ...(data.message
      ? {
          message: {
            ...data.message,
            createdAt: data.message.createdAt
              ? new Date(data.message.createdAt).toISOString()
              : null
          }
        }
      : {}),
    ...(data.rating ? { rating: data.rating } : {})
  };
}

/** A test message, sent now; the answer says whether it arrived. */
export async function sendTest(integrationId: string, organizationId: string) {
  const id = generateId();
  await query(
    `INSERT INTO integration_deliveries (id, integration_id, organization_id, event, payload)
     VALUES ($1, $2, $3, 'integration.test', $4)`,
    [
      id,
      integrationId,
      organizationId,
      JSON.stringify({
        id,
        event: 'integration.test',
        createdAt: new Date().toISOString(),
        data: null
      })
    ]
  );
  const outcome = await attemptDelivery(id);
  const { rows } = await query<{ last_status_code: number | null; last_error: string | null }>(
    'SELECT last_status_code, last_error FROM integration_deliveries WHERE id = $1',
    [id]
  );
  return {
    delivered: outcome === 'delivered',
    status: rows[0]?.last_status_code ?? null,
    error: rows[0]?.last_error ?? null
  };
}

/** The timer's share (services/slaSweeper.ts): deliveries whose next try is due. */
export async function runIntegrationDeliveries(limit = 50): Promise<number> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM integration_deliveries
      WHERE status = 'pending' AND next_attempt_at <= now()
      ORDER BY next_attempt_at LIMIT $1`,
    [limit]
  );
  let done = 0;
  for (const row of rows) {
    // eslint-disable-next-line no-await-in-loop -- one at a time, each claims its row
    if (await attemptDelivery(row.id)) done += 1;
  }
  return done;
}

/** The nightly purge's share: the delivery log is kept for 30 days. */
export async function purgeDeliveryLog(): Promise<number> {
  const { rowCount } = await query(
    `DELETE FROM integration_deliveries WHERE created_at < now() - interval '30 days'`
  );
  return rowCount ?? 0;
}

/** Erasure of conversations: deliveries still waiting forget their payload. */
export async function forgetDeliveryPayloads(conversationIds: string[]): Promise<void> {
  if (!conversationIds.length) return;
  await query(
    `UPDATE integration_deliveries
        SET payload = NULL, status = 'failed', finished_at = now(), last_error = 'conversation deleted'
      WHERE status = 'pending' AND payload->'data'->'conversation'->>'id' = ANY($1)`,
    [conversationIds]
  );
}

// ------------------------------------------------------------ the hooks

interface ConversationLike {
  _id: unknown;
  organizationId?: unknown;
  siteId: unknown;
  ticketId?: string | null;
  status?: string | null;
  visitorName?: string | null;
  visitorEmail?: string | null;
}

interface MessageLike {
  _id: unknown;
  senderType: string;
  senderName?: string | null;
  content: string;
  createdAt?: string | Date | null;
}

/**
 * Called where a conversation event happens (widget and panel sockets, the
 * end of a conversation, a rating). Not awaited: one cheap query decides
 * whether anyone listens before anything else is read.
 */
export function notifyIntegrations(
  event: (typeof INTEGRATION_EVENTS)[number],
  conversation: ConversationLike,
  extras: { message?: MessageLike; rating?: { score: number; comment?: string | null } } = {}
): void {
  const organizationId = String(conversation.organizationId ?? '');
  const siteId = String(conversation.siteId ?? '');
  if (!organizationId || !siteId) return;
  void (async () => {
    const listening = await query(
      `SELECT 1 FROM integrations
        WHERE organization_id = $1 AND is_active AND $2 = ANY(events)
          AND (site_id IS NULL OR site_id = $3)
        LIMIT 1`,
      [organizationId, event, siteId]
    );
    if (!listening.rowCount) return;
    const { rows } = await query<{ name: string }>('SELECT name FROM sites WHERE id = $1', [
      siteId
    ]);
    await dispatchIntegrationEvent(event, {
      organizationId,
      site: { id: siteId, name: rows[0]?.name ?? null },
      conversation: {
        id: String(conversation._id),
        ticketId: conversation.ticketId ?? null,
        status: conversation.status ?? null,
        visitorName: conversation.visitorName ?? null,
        visitorEmail: conversation.visitorEmail ?? null
      },
      ...(extras.message
        ? {
            message: {
              id: String(extras.message._id),
              senderType: extras.message.senderType,
              senderName: extras.message.senderName ?? null,
              content: extras.message.content,
              createdAt: extras.message.createdAt ?? new Date()
            }
          }
        : {}),
      ...(extras.rating ? { rating: extras.rating } : {})
    });
  })().catch((error) => console.error('[integrations] could not notify', { event }, error));
}
