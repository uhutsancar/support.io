// The mails a conversation sends on its own (plan v10 PRD-01, PRD-04).
//
//   unanswered chats  a visitor wrote and nobody answered within the site's
//                     delay (3 minutes by default), or nobody was online at
//                     all: the people who work on the site are mailed. The
//                     first chat goes out at once; the ones in the next ten
//                     minutes (an hour for the hourly digest) are gathered
//                     into one mail, so a busy evening is not forty mails.
//   replies           an agent answered while the visitor was away and the
//                     visitor left an address: the replies go to them by
//                     mail with a link back into the chat, and a link to stop
//                     these mails
//   ratings           the conversation ended before the visitor rated it: one
//                     mail with a link to rate it
//
// All of it runs from the single SLA sweep (services/slaSweeper.ts), never
// from a timer of its own, so a multi-process deployment that sweeps from one
// process sends each mail once. Each mail is claimed with a conditional UPDATE
// before it is sent; two sweeps cannot both send it.

import { query } from '../db/pool';
import { appBaseUrl, mail } from './mail';
import { chatSettings } from './chatSettings';
import { signVisitorLink } from '../config/tokens';
import { apiOrigin } from '../middleware/upload';
import { ACTIVE_CONVERSATION_STATUSES } from '../domain';
import type { MailLocale } from './mail';
import type { NotificationPreferences } from '../domain';

const SIMPLE_EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const MINUTE = 60 * 1000;

interface SiteAccount {
  type: 'user' | 'team';
  id: string;
  email: string;
  name: string;
  role: string;
  preferences: NotificationPreferences;
}

/**
 * Everyone who works on a site and can answer: owners and admins always,
 * others only when the site is explicitly assigned to them.
 * Viewers read but do not answer, so they are not mailed.
 */
export async function siteAccounts(organizationId: string, siteId: string): Promise<SiteAccount[]> {
  const { rows } = await query<{
    type: 'user' | 'team';
    id: string;
    email: string;
    name: string;
    role: string;
    preferences: NotificationPreferences | null;
    sites: string[];
  }>(
    `SELECT 'user' AS type, u.id, u.email, u.name, u.role, u.preferences,
            coalesce(array_agg(a.site_id) FILTER (WHERE a.site_id IS NOT NULL), '{}') AS sites
       FROM users u LEFT JOIN user_assigned_sites a ON a.user_id = u.id
      WHERE u.organization_id = $1 AND u.is_active
      GROUP BY u.id
     UNION ALL
     SELECT 'team' AS type, t.id, t.email, t.name, t.role, t.preferences,
            coalesce(array_agg(a.site_id) FILTER (WHERE a.site_id IS NOT NULL), '{}') AS sites
       FROM teams t LEFT JOIN team_assigned_sites a ON a.team_id = t.id
      WHERE t.organization_id = $1 AND t.is_active
      GROUP BY t.id`,
    [organizationId]
  );
  return rows
    .filter((r) => r.role !== 'viewer')
    .filter((r) => ['owner', 'admin'].includes(r.role) || r.sites.includes(siteId))
    .map((r) => ({
      type: r.type,
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      preferences: r.preferences || {}
    }));
}

const localeOf = (prefs: NotificationPreferences): MailLocale =>
  prefs.locale === 'en' ? 'en' : 'tr';

// ------------------------------------------------------------ unanswered chats

interface MissedCandidate {
  id: string;
  site_id: string;
  organization_id: string;
  visitor_name: string;
  assigned_agent_id: string | null;
  created_at: Date;
  chat_settings: unknown;
  someone_online: boolean;
}

/**
 * Marks the chats that have waited long enough and queues a notice for each
 * person who should hear about them. `now` lets a test look ahead in time.
 */
export async function sweepMissedChats({ now = new Date() }: { now?: Date } = {}): Promise<number> {
  const { rows } = await query<MissedCandidate>(
    // Due: the site's delay has passed, or nobody of the organization is
    // online (no point waiting for an answer that cannot come). Newest first,
    // so a backlog of old chats never keeps a new one from being reported.
    `WITH candidates AS (
       SELECT c.id, c.site_id, c.organization_id, c.visitor_name, c.assigned_agent_id,
              c.created_at, s.chat_settings,
              (EXISTS (SELECT 1 FROM users u WHERE u.organization_id = c.organization_id
                         AND u.is_active AND u.status = 'online')
               OR EXISTS (SELECT 1 FROM teams t WHERE t.organization_id = c.organization_id
                         AND t.is_active AND t.status = 'online')) AS someone_online,
              make_interval(mins => coalesce(
                CASE WHEN (s.chat_settings -> 'missedChat' ->> 'delayMinutes') ~ '^[0-9]{1,3}$'
                     THEN (s.chat_settings -> 'missedChat' ->> 'delayMinutes')::int END, 3)) AS delay
         FROM conversations c
         JOIN sites s ON s.id = c.site_id AND s.is_active AND s.suspended_at IS NULL
        WHERE c.missed_notified_at IS NULL AND c.first_response_at IS NULL
          AND c.status = ANY($1) AND c.response_owner = 'human'
          AND c.created_at > $2::timestamptz - interval '2 days'
          AND EXISTS (SELECT 1 FROM messages m
                       WHERE m.conversation_id = c.id AND m.sender_type = 'visitor'))
     SELECT * FROM candidates
      WHERE NOT someone_online OR created_at <= $2::timestamptz - delay
      ORDER BY created_at DESC
      LIMIT 200`,
    [[...ACTIVE_CONVERSATION_STATUSES], now]
  );

  let queued = 0;
  for (const row of rows) {
    const settings = chatSettings(row.chat_settings);

    // eslint-disable-next-line no-await-in-loop
    const claimed = await query(
      `UPDATE conversations SET missed_notified_at = now()
        WHERE id = $1 AND missed_notified_at IS NULL AND first_response_at IS NULL`,
      [row.id]
    );
    if (!claimed.rowCount || settings.missedChat.notify === 'off') continue;

    // eslint-disable-next-line no-await-in-loop
    let people = await siteAccounts(row.organization_id, row.site_id);
    if (settings.missedChat.notify === 'assigned' && row.assigned_agent_id) {
      const assignee = people.filter((p) => p.id === row.assigned_agent_id);
      if (assignee.length) people = assignee;
    }
    for (const person of people) {
      if (person.preferences.missedChatEmail === 'off') continue;
      // eslint-disable-next-line no-await-in-loop
      await query(
        `INSERT INTO missed_chat_notices (account_type, account_id, site_id, pending)
         VALUES ($1, $2, $3, jsonb_build_array($4::text))
         ON CONFLICT (account_type, account_id, site_id) DO UPDATE
           SET pending = missed_chat_notices.pending || jsonb_build_array($4::text),
               updated_at = now()`,
        [person.type, person.id, row.site_id, row.id]
      );
      queued += 1;
    }
  }
  return queued;
}

/**
 * Sends the queued notices whose window has passed: at once for the first
 * one, then at most one mail per person and site every ten minutes (or hour).
 */
export async function flushMissedNotices({
  now = new Date()
}: { now?: Date } = {}): Promise<number> {
  const { rows } = await query<{
    account_type: 'user' | 'team';
    account_id: string;
    site_id: string;
    pending: string[];
    last_sent_at: Date | null;
    email: string;
    preferences: NotificationPreferences | null;
    site_name: string;
  }>(
    `SELECT n.account_type, n.account_id, n.site_id, n.pending, n.last_sent_at,
            coalesce(u.email, t.email) AS email,
            coalesce(u.preferences, t.preferences) AS preferences,
            s.name AS site_name
       FROM missed_chat_notices n
       JOIN sites s ON s.id = n.site_id
       LEFT JOIN users u ON n.account_type = 'user' AND u.id = n.account_id AND u.is_active
       LEFT JOIN teams t ON n.account_type = 'team' AND t.id = n.account_id AND t.is_active
      WHERE jsonb_array_length(n.pending) > 0
      LIMIT 500`
  );

  let sent = 0;
  for (const row of rows) {
    if (!row.email) continue;
    const prefs = row.preferences || {};
    if (prefs.missedChatEmail === 'off') continue;
    const windowMs = (prefs.missedChatEmail === 'hourly' ? 60 : 10) * MINUTE;
    if (row.last_sent_at && now.getTime() - new Date(row.last_sent_at).getTime() < windowMs) {
      continue;
    }
    // Claim exactly the ids read, so a chat queued in between is kept.
    // eslint-disable-next-line no-await-in-loop
    const claimed = await query(
      `UPDATE missed_chat_notices SET pending = '[]'::jsonb, last_sent_at = $5
        WHERE account_type = $1 AND account_id = $2 AND site_id = $3 AND pending = $4::jsonb`,
      [row.account_type, row.account_id, row.site_id, JSON.stringify(row.pending), now]
    );
    if (!claimed.rowCount) continue;

    // eslint-disable-next-line no-await-in-loop
    const details = await query<{ id: string; visitor_name: string; preview: string | null }>(
      `SELECT c.id, c.visitor_name,
              (SELECT m.content FROM messages m
                WHERE m.conversation_id = c.id AND m.sender_type = 'visitor'
                ORDER BY m.created_at LIMIT 1) AS preview
         FROM conversations c
        WHERE c.id = ANY($1) AND c.first_response_at IS NULL
        ORDER BY c.created_at DESC`,
      [row.pending]
    );
    // Answered meanwhile: nothing left to tell.
    if (!details.rows.length) continue;
    const newest = details.rows[0];
    const preview = newest.preview ? newest.preview.slice(0, 280) : undefined;
    void mail.sendMissedChat(row.email, {
      site: row.site_name,
      visitors: details.rows.map((d) => d.visitor_name || 'Visitor'),
      preview,
      link: `${appBaseUrl()}/dashboard/conversations?conversation=${encodeURIComponent(newest.id)}`,
      settingsLink: `${appBaseUrl()}/dashboard/settings#notifications`,
      locale: localeOf(prefs)
    });
    sent += 1;
  }
  return sent;
}

// -------------------------------------------------- replies to an away visitor

interface SiteForLinks {
  domain: string;
  installation: { origin?: string | null } | null;
}

/** The page the visitor was on, on the customer's own site, with a token. */
export function resumeLink(site: SiteForLinks, currentPage: string | null, token: string): string {
  let origin = site.installation?.origin || `https://${site.domain}`;
  try {
    origin = new URL(origin).origin;
  } catch {
    origin = `https://${site.domain}`;
  }
  // The widget reports the page as origin + path; an older one sent a path.
  let url: URL;
  try {
    const page = new URL(String(currentPage || ''));
    url = page.protocol === 'https:' || page.protocol === 'http:' ? page : new URL('/', origin);
  } catch {
    url = new URL(currentPage && currentPage.startsWith('/') ? currentPage : '/', origin);
  }
  url.searchParams.set('sc_resume', token);
  return url.toString();
}

export function optOutLink(token: string): string {
  return `${apiOrigin() || appBaseUrl()}/api/widget/email-optout?t=${encodeURIComponent(token)}`;
}

/**
 * Mails agents' replies to a visitor who left an address and is no longer on
 * the page. Only replies written a minute or more ago (the visitor may still
 * be reading) and after the last such mail are sent.
 */
export async function sweepVisitorReplies({
  now = new Date()
}: { now?: Date } = {}): Promise<number> {
  const { rows } = await query<{
    id: string;
    site_id: string;
    visitor_id: string;
    visitor_email: string;
    visitor_reply_mailed_at: Date | null;
    current_page: string;
    site_name: string;
    domain: string;
    installation: { origin?: string } | null;
    chat_settings: unknown;
    last_visitor_at: Date | null;
  }>(
    `SELECT c.id, c.site_id, c.visitor_id, c.visitor_email, c.visitor_reply_mailed_at,
            c.current_page, s.name AS site_name, s.domain, s.installation, s.chat_settings,
            (SELECT max(m.created_at) FROM messages m
              WHERE m.conversation_id = c.id AND m.sender_type = 'visitor') AS last_visitor_at
       FROM conversations c
       JOIN sites s ON s.id = c.site_id AND s.is_active
       JOIN visitors v ON v.site_id = c.site_id AND v.visitor_id = c.visitor_id AND NOT v.is_active
      WHERE c.visitor_email IS NOT NULL AND NOT c.email_replies_opt_out
        AND c.last_message_at > $1::timestamptz - interval '7 days'
        AND EXISTS (SELECT 1 FROM messages m
                     WHERE m.conversation_id = c.id AND m.sender_type = 'agent'
                       AND m.created_at > coalesce(c.visitor_reply_mailed_at, '-infinity'::timestamptz)
                       AND m.created_at <= $1::timestamptz - interval '1 minute')
      LIMIT 100`,
    [now]
  );

  let sent = 0;
  for (const row of rows) {
    if (!chatSettings(row.chat_settings).emailReplies) continue;
    if (!SIMPLE_EMAIL.test(row.visitor_email)) continue;
    const since = [row.visitor_reply_mailed_at, row.last_visitor_at]
      .filter((d): d is Date => Boolean(d))
      .map((d) => new Date(d).getTime());
    const after = new Date(since.length ? Math.max(...since) : 0);

    // eslint-disable-next-line no-await-in-loop
    const replies = await query<{ sender_name: string; content: string }>(
      `SELECT sender_name, content FROM messages
        WHERE conversation_id = $1 AND sender_type = 'agent' AND created_at > $2
        ORDER BY created_at LIMIT 10`,
      [row.id, after]
    );
    if (!replies.rows.length) {
      // Only replies the visitor has already answered: just move the mark.
      // eslint-disable-next-line no-await-in-loop
      await query('UPDATE conversations SET visitor_reply_mailed_at = $2 WHERE id = $1', [
        row.id,
        now
      ]);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const claimed = await query(
      `UPDATE conversations SET visitor_reply_mailed_at = $3
        WHERE id = $1 AND visitor_reply_mailed_at IS NOT DISTINCT FROM $2`,
      [row.id, row.visitor_reply_mailed_at, now]
    );
    if (!claimed.rowCount) continue;

    const claims = { siteId: row.site_id, conversationId: row.id, visitorId: row.visitor_id };
    void mail.sendVisitorReply(row.visitor_email, {
      site: row.site_name,
      replies: replies.rows.map((r) => ({ who: r.sender_name, text: r.content.slice(0, 2000) })),
      link: resumeLink(row, row.current_page, signVisitorLink('resume', claims)),
      optOutLink: optOutLink(signVisitorLink('email-optout', claims))
    });
    sent += 1;
  }
  return sent;
}

// ---------------------------------------------------------------- ratings

/**
 * One rating request by mail for a conversation that ended unrated while the
 * visitor was away; two minutes after the end, so the widget asks first.
 */
export async function sweepCsatRequests({
  now = new Date()
}: { now?: Date } = {}): Promise<number> {
  const { rows } = await query<{
    id: string;
    site_id: string;
    visitor_id: string;
    visitor_email: string;
    site_name: string;
    chat_settings: unknown;
  }>(
    `SELECT c.id, c.site_id, c.visitor_id, c.visitor_email, s.name AS site_name, s.chat_settings
       FROM conversations c
       JOIN sites s ON s.id = c.site_id AND s.is_active
       JOIN visitors v ON v.site_id = c.site_id AND v.visitor_id = c.visitor_id AND NOT v.is_active
      WHERE c.status IN ('resolved', 'closed') AND c.csat_requested_at IS NULL
        AND c.rating ->> 'score' IS NULL
        AND c.visitor_email IS NOT NULL AND NOT c.email_replies_opt_out
        AND coalesce(c.closed_at, c.resolved_at) BETWEEN $1::timestamptz - interval '2 days'
                                                   AND $1::timestamptz - interval '2 minutes'
      LIMIT 100`,
    [now]
  );
  let sent = 0;
  for (const row of rows) {
    const settings = chatSettings(row.chat_settings);
    if (!settings.csat.enabled || !settings.csat.askByEmail) continue;
    if (!SIMPLE_EMAIL.test(row.visitor_email)) continue;
    // eslint-disable-next-line no-await-in-loop
    const claimed = await query(
      `UPDATE conversations SET csat_requested_at = now()
        WHERE id = $1 AND csat_requested_at IS NULL`,
      [row.id]
    );
    if (!claimed.rowCount) continue;
    const token = signVisitorLink('csat', {
      siteId: row.site_id,
      conversationId: row.id,
      visitorId: row.visitor_id
    });
    void mail.sendCsatRequest(row.visitor_email, {
      site: row.site_name,
      link: `${appBaseUrl()}/rate?t=${encodeURIComponent(token)}`
    });
    sent += 1;
  }
  return sent;
}

/** Everything above, in order; called by the SLA sweep once a minute. */
export async function runConversationMail(now = new Date()): Promise<void> {
  const steps: Array<[string, () => Promise<number>]> = [
    ['missed chats', () => sweepMissedChats({ now })],
    ['missed-chat mails', () => flushMissedNotices({ now })],
    ['visitor replies', () => sweepVisitorReplies({ now })],
    ['rating requests', () => sweepCsatRequests({ now })]
  ];
  for (const [name, step] of steps) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await step();
    } catch (error) {
      console.error(
        `[conversation-mail] ${name} failed:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}
