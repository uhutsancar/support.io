// Web Push to the panel (plan v10 PRD-09): who receives a conversation
// event on their phone or desktop while the panel is closed, and sending it.
//
// The recipients follow the same choices as the desktop notifications in
// Settings → Notifications (new conversation / assigned to me / every
// message), the same site access as the inbox, and they are skipped while
// they have the panel open: there the page's own notification does the job.
//
// A subscription's endpoint is an address of a browser push service; the
// server POSTs to it. Only the known push services are accepted, so an
// account cannot point the server at anything else (SSRF).

import webpush from 'web-push';
import { query } from '../db/pool';
import { pushConfig } from '../config/push';
import { mayAccessSite } from '../http/guards';
import { userRoom } from '../realtime/rooms';
import type { Server } from 'socket.io';

/** The push services of Chrome/Android, Firefox, Safari/iOS and Edge. */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/
];

const MAX_ENDPOINT = 1024;

/** True for an https address on a known push service. */
export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_ENDPOINT) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.port === '' || url.port === '443') &&
      !url.username &&
      !url.password &&
      PUSH_HOSTS.some((host) => host.test(url.hostname))
    );
  } catch {
    return false;
  }
}

export interface PushMessage {
  title: string;
  body: string;
  /** A path in the panel the notification opens. */
  url: string;
  /** Notifications with one tag replace each other on the device. */
  tag: string;
}

interface Subscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

type Transport = (
  subscription: Subscription,
  payload: string,
  options: webpush.RequestOptions
) => Promise<{ statusCode: number }>;

const sendWithWebPush: Transport = (subscription, payload, options) =>
  webpush.sendNotification(subscription, payload, options);

let transport: Transport = sendWithWebPush;

/** Tests replace the network with a recorder; null puts web-push back. */
export function usePushTransport(next: Transport | null): void {
  transport = next ?? sendWithWebPush;
}

// Development and CI (PUSH_TRANSPORT=memory, never in production): pushes
// are kept here instead of being sent, so the suites can see them without
// reaching Google's, Mozilla's or Apple's servers. GET /api/dev/push-outbox.
interface RecordedPush extends PushMessage {
  organizationId: string;
  accountId: string;
  at: string;
}
const recorded: RecordedPush[] = [];

const memoryTransport = () =>
  process.env.PUSH_TRANSPORT === 'memory' && process.env.NODE_ENV !== 'production';

/** What the memory transport kept for one organization, newest last. */
export function pushOutbox(organizationId: string): RecordedPush[] {
  return recorded.filter((entry) => entry.organizationId === organizationId);
}

let realtime: Server | null = null;

/** The socket server, to see who has the panel open (server.ts). */
export function usePushRealtime(io: Server | null): void {
  realtime = io;
}

export interface Account {
  type: 'user' | 'team';
  id: string;
}

/** Sends one message to every subscribed browser of these accounts. */
export async function sendPush(
  organizationId: string,
  accounts: Account[],
  message: PushMessage
): Promise<number> {
  const config = pushConfig();
  if (!config || !accounts.length) return 0;
  const { rows } = await query<{
    id: string;
    account_id: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  }>(
    `SELECT id, account_id, endpoint, p256dh, auth FROM push_subscriptions
      WHERE organization_id = $1
        AND (account_type, account_id) IN (SELECT * FROM unnest($2::text[], $3::text[]))`,
    [organizationId, accounts.map((a) => a.type), accounts.map((a) => a.id)]
  );
  const payload = JSON.stringify({
    title: message.title.slice(0, 80),
    body: message.body.slice(0, 160),
    url: message.url.startsWith('/') ? message.url : '/dashboard',
    tag: message.tag
  });
  if (memoryTransport()) {
    const kept = JSON.parse(payload) as PushMessage;
    for (const row of rows) {
      recorded.push({
        ...kept,
        organizationId,
        accountId: row.account_id,
        at: new Date().toISOString()
      });
    }
    recorded.splice(0, Math.max(0, recorded.length - 500));
    return rows.length;
  }
  let sent = 0;
  await Promise.all(
    rows.map(async (row) => {
      try {
        await transport(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          payload,
          {
            vapidDetails: {
              subject: config.subject,
              publicKey: config.publicKey,
              privateKey: config.privateKey
            },
            TTL: 60 * 60,
            urgency: 'high',
            timeout: 5000
          }
        );
        sent += 1;
        await query('UPDATE push_subscriptions SET last_used_at = now() WHERE id = $1', [row.id]);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // The browser unsubscribed or the subscription expired: forget it.
        if (status === 404 || status === 410) {
          await query('DELETE FROM push_subscriptions WHERE id = $1', [row.id]);
          return;
        }
        // Never the endpoint: it is a capability that delivers to the device.
        console.warn('[push] delivery failed', { status: status ?? null, subscription: row.id });
      }
    })
  );
  return sent;
}

// ------------------------------------------------------------ recipients

type Event = 'newConversation' | 'assigned' | 'message';

interface ConversationLike {
  _id: unknown;
  siteId: unknown;
  organizationId?: unknown;
  visitorName?: string | null;
}

const TEXT = {
  tr: {
    newConversation: 'Yeni konuşma',
    assigned: 'Size bir konuşma atandı',
    visitor: 'Ziyaretçi'
  },
  en: {
    newConversation: 'New conversation',
    assigned: 'A conversation was assigned to you',
    visitor: 'Visitor'
  }
};

/** The part of an account's preferences push reads. */
interface PushPreferences {
  desktop?: { newConversation?: boolean; assigned?: boolean; allMessages?: boolean };
  locale?: string;
}

interface AccountRow {
  type: 'user' | 'team';
  id: string;
  role: string;
  preferences: PushPreferences | null;
  sites: string[];
}

/** The subscribed, active accounts of an organization, with what push needs to know. */
async function subscribedAccounts(organizationId: string): Promise<AccountRow[]> {
  const { rows } = await query<AccountRow>(
    `SELECT 'user' AS type, u.id, u.role, u.preferences,
            coalesce(array_agg(s.site_id) FILTER (WHERE s.site_id IS NOT NULL), '{}') AS sites
       FROM users u
       LEFT JOIN user_assigned_sites s ON s.user_id = u.id
      WHERE u.organization_id = $1 AND u.is_active
        AND EXISTS (SELECT 1 FROM push_subscriptions p
                     WHERE p.account_type = 'user' AND p.account_id = u.id)
      GROUP BY u.id
     UNION ALL
     SELECT 'team' AS type, t.id, t.role, t.preferences,
            coalesce(array_agg(s.site_id) FILTER (WHERE s.site_id IS NOT NULL), '{}') AS sites
       FROM teams t
       LEFT JOIN team_assigned_sites s ON s.team_id = t.id
      WHERE t.organization_id = $1 AND t.is_active
        AND EXISTS (SELECT 1 FROM push_subscriptions p
                     WHERE p.account_type = 'team' AND p.account_id = t.id)
      GROUP BY t.id`,
    [organizationId]
  );
  return rows;
}

/** Whether the account has the panel open somewhere right now. */
async function panelOpen(accountId: string): Promise<boolean> {
  if (!realtime) return false;
  try {
    return (await realtime.of('/admin').in(userRoom(accountId)).fetchSockets()).length > 0;
  } catch {
    return false;
  }
}

const wants = (prefs: PushPreferences | null, event: Event): boolean => {
  const desktop = prefs?.desktop ?? {};
  if (event === 'newConversation') return desktop.newConversation !== false;
  if (event === 'assigned') return desktop.assigned !== false;
  return desktop.allMessages === true;
};

/**
 * Pushes a conversation event to whoever chose to hear about it. Best effort
 * and never awaited by the caller's response: a failure is logged.
 *
 * - newConversation, message: everyone who may work on the site
 * - assigned: the assignee alone (`assignee`), unless they did it themselves
 */
export async function pushConversationEvent(
  event: Event,
  conversation: ConversationLike,
  { assignee, actor, text }: { assignee?: unknown; actor?: unknown; text?: string } = {}
): Promise<number> {
  try {
    if (!pushConfig()) return 0;
    const organizationId = String(conversation.organizationId ?? '');
    if (!organizationId) return 0;
    let accounts = await subscribedAccounts(organizationId);
    if (!accounts.length) return 0;

    if (event === 'assigned') {
      if (!assignee || String(assignee) === String(actor ?? '')) return 0;
      accounts = accounts.filter((a) => a.id === String(assignee));
    } else {
      accounts = accounts.filter((a) => mayAccessSite(a.role, a.sites, conversation.siteId));
    }
    accounts = accounts.filter((a) => wants(a.preferences, event));

    const recipients: AccountRow[] = [];
    for (const account of accounts) {
      // eslint-disable-next-line no-await-in-loop -- a handful of accounts per workspace
      if (!(await panelOpen(account.id))) recipients.push(account);
    }
    if (!recipients.length) return 0;

    // One message per language.
    let sent = 0;
    for (const locale of ['tr', 'en'] as const) {
      const group = recipients.filter(
        (a) => (a.preferences?.locale === 'en' ? 'en' : 'tr') === locale
      );
      if (!group.length) continue;
      const words = TEXT[locale];
      const visitor = conversation.visitorName || words.visitor;
      const message: PushMessage =
        event === 'message'
          ? { title: visitor, body: text ?? '', url: '', tag: '' }
          : { title: words[event], body: visitor, url: '', tag: '' };
      message.url = `/dashboard/conversations?conversation=${String(conversation._id)}`;
      message.tag = `conversation-${String(conversation._id)}`;
      // eslint-disable-next-line no-await-in-loop -- two languages at most
      sent += await sendPush(
        organizationId,
        group.map((a) => ({ type: a.type, id: a.id })),
        message
      );
    }
    return sent;
  } catch (error) {
    console.error('[push] could not notify', { event, conversation: conversation._id }, error);
    return 0;
  }
}
