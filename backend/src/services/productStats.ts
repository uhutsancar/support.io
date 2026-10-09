// The product's numbers for the owner (plan v10 OBS-07): how many
// workspaces use it, how many widgets are live, how sign-ups turn into
// active and paying customers, and how much the assistant resolves.
//
// Read by `npm run org:stats` and mailed weekly to OPS_REPORT_EMAIL (Monday
// morning, from the hourly sweep). Aggregates only: no workspace names, no
// addresses, nothing a visitor wrote.

import { query } from '../db/pool';
import { PLAN_LIMITS } from '../domain/plans';
import { getRedisClient } from '../config/redis';
import { sendMail } from './mail';
import { logger } from '../config/logger';
import type { PlanType } from '../domain';

export interface ProductStats {
  days: number;
  workspaces: number;
  /** Workspaces with at least one new conversation in the window. */
  activeWorkspaces: number;
  /** Sites whose widget was seen on a page in the last 7 days. */
  liveWidgets: number;
  signups: number;
  /** Share of the window's sign-ups that confirmed their address, %. */
  verifiedRate: number;
  /** Median hours from sign-up to the first visitor message, window's sign-ups. */
  medianHoursToFirstMessage: number | null;
  /** Window's sign-ups that reached a first visitor message, %. */
  activationRate: number;
  paying: Record<PlanType, number>;
  newPaying: number;
  canceled: number;
  /** At monthly list prices (yearly plans are not told apart): an estimate. */
  estimatedMrr: { amount: number; currency: string };
  assistant: { conversations: number; resolved: number; resolvedRate: number };
  /**
   * The first-use path of the window's sign-ups, step by step (UX-05): how
   * many got there and the median hours from sign-up. Each step is taken
   * from the record it leaves, so nothing extra is tracked.
   */
  funnel: FunnelStep[];
}

export const FUNNEL_STEPS = [
  'verified',
  'site',
  'installed',
  'firstMessage',
  'invited',
  'faq',
  'assistant',
  'paid'
] as const;

export interface FunnelStep {
  step: (typeof FUNNEL_STEPS)[number];
  reached: number;
  /** Of the window's sign-ups, %. */
  rate: number;
  medianHours: number | null;
}

const FUNNEL_LABEL: Record<FunnelStep['step'], string> = {
  verified: 'E-postasını doğruladı',
  site: 'Site ekledi',
  installed: 'Kodu kurdu',
  firstMessage: 'İlk ziyaretçi mesajı',
  invited: 'Ekip daveti',
  faq: 'SSS ekledi',
  assistant: 'Asistanı açtı',
  paid: 'Ücretli plana geçti'
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : 0);

export async function productStats(days = 7, now = new Date()): Promise<ProductStats> {
  const since = new Date(now.getTime() - days * 86_400_000);
  const one = async <T>(sql: string, params: unknown[] = []): Promise<T> =>
    (await query<T & Record<string, unknown>>(sql, params)).rows[0] as T;

  const [base, signups, activation, paying, moves, assistant, funnel] = await Promise.all([
    one<{ workspaces: number; active: number; live: number }>(
      `SELECT (SELECT count(*)::int FROM organizations WHERE is_active) AS workspaces,
              (SELECT count(DISTINCT organization_id)::int FROM conversations
                WHERE created_at > $1) AS active,
              (SELECT count(*)::int FROM sites
                WHERE (installation ->> 'lastSeenAt')::timestamptz > $2) AS live`,
      [since, new Date(now.getTime() - 7 * 86_400_000)]
    ),
    one<{ total: number; verified: number }>(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE u.email_verified_at IS NOT NULL)::int AS verified
         FROM organizations o
         JOIN users u ON u.id = o.owner_user_id
        WHERE o.created_at > $1`,
      [since]
    ),
    one<{ reached: number; median_hours: number | null }>(
      `WITH firsts AS (
         SELECT o.id, o.created_at,
                (SELECT min(c.created_at) FROM conversations c WHERE c.organization_id = o.id) AS first_at
           FROM organizations o WHERE o.created_at > $1)
       SELECT count(first_at)::int AS reached,
              percentile_cont(0.5) WITHIN GROUP (
                ORDER BY extract(epoch FROM first_at - created_at) / 3600
              ) FILTER (WHERE first_at IS NOT NULL) AS median_hours
         FROM firsts`,
      [since]
    ),
    query<{ plan_type: PlanType; n: number }>(
      `SELECT plan_type, count(*)::int AS n FROM subscriptions
        WHERE status IN ('active', 'trialing', 'past_due') GROUP BY plan_type`
    ),
    one<{ new_paying: number; canceled: number }>(
      `SELECT count(*) FILTER (WHERE created_at > $1 AND status <> 'canceled')::int AS new_paying,
              count(*) FILTER (WHERE status = 'canceled' AND updated_at > $1)::int AS canceled
         FROM subscriptions`,
      [since]
    ),
    one<{ conversations: number; resolved: number }>(
      `WITH helped AS (
         SELECT m.conversation_id,
                bool_or(m.assistant ->> 'handoff' IS NOT NULL) AS handed_over
           FROM messages m
          WHERE m.sender_id = 'assistant' AND m.created_at > $1
          GROUP BY m.conversation_id)
       SELECT count(*)::int AS conversations,
              count(*) FILTER (WHERE NOT handed_over)::int AS resolved
         FROM helped`,
      [since]
    ),
    query<{ step: FunnelStep['step']; reached: number; median_hours: number | null }>(
      `WITH t AS (
         SELECT o.created_at,
                (SELECT u.email_verified_at FROM users u WHERE u.id = o.owner_user_id) AS verified,
                (SELECT min(s.created_at) FROM sites s WHERE s.organization_id = o.id) AS site,
                (SELECT min(CASE WHEN s.installation ->> 'verifiedAt' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
                                 THEN (s.installation ->> 'verifiedAt')::timestamptz END)
                   FROM sites s WHERE s.organization_id = o.id) AS installed,
                (SELECT min(c.created_at) FROM conversations c
                  WHERE c.organization_id = o.id) AS first_message,
                (SELECT min(i.created_at) FROM invitations i WHERE i.organization_id = o.id) AS invited,
                (SELECT min(f.created_at) FROM faqs f JOIN sites s ON s.id = f.site_id
                  WHERE s.organization_id = o.id) AS faq,
                (SELECT min(a.created_at) FROM audit_logs a
                  WHERE a.organization_id = o.id AND a.action = 'ASSISTANT_ENABLED') AS assistant,
                (SELECT min(sub.created_at) FROM subscriptions sub
                  WHERE sub.organization_id = o.id) AS paid
           FROM organizations o WHERE o.created_at > $1)
       SELECT v.step, count(v.at)::int AS reached,
              percentile_cont(0.5) WITHIN GROUP (
                ORDER BY extract(epoch FROM v.at - t.created_at) / 3600
              ) FILTER (WHERE v.at IS NOT NULL) AS median_hours
         FROM t CROSS JOIN LATERAL (VALUES
                ('verified', t.verified), ('site', t.site), ('installed', t.installed),
                ('firstMessage', t.first_message), ('invited', t.invited), ('faq', t.faq),
                ('assistant', t.assistant), ('paid', t.paid)) AS v(step, at)
        GROUP BY v.step`,
      [since]
    )
  ]);

  const byPlan: Record<PlanType, number> = { FREE: 0, PRO: 0, ENTERPRISE: 0 };
  for (const row of paying.rows) byPlan[row.plan_type] = row.n;
  const mrr = (Object.keys(byPlan) as PlanType[]).reduce(
    (sum, plan) => sum + byPlan[plan] * (PLAN_LIMITS[plan].price.monthly ?? 0),
    0
  );

  return {
    days,
    workspaces: base.workspaces,
    activeWorkspaces: base.active,
    liveWidgets: base.live,
    signups: signups.total,
    verifiedRate: pct(signups.verified, signups.total),
    medianHoursToFirstMessage:
      activation.median_hours === null
        ? null
        : Math.round(Number(activation.median_hours) * 10) / 10,
    activationRate: pct(activation.reached, signups.total),
    paying: byPlan,
    newPaying: moves.new_paying,
    canceled: moves.canceled,
    estimatedMrr: { amount: mrr, currency: PLAN_LIMITS.PRO.price.currency },
    assistant: {
      conversations: assistant.conversations,
      resolved: assistant.resolved,
      resolvedRate: pct(assistant.resolved, assistant.conversations)
    },
    funnel: FUNNEL_STEPS.map((step) => {
      const row = funnel.rows.find((r) => r.step === step);
      const hours = row?.median_hours;
      return {
        step,
        reached: row?.reached ?? 0,
        rate: pct(row?.reached ?? 0, signups.total),
        medianHours:
          hours === null || hours === undefined ? null : Math.round(Number(hours) * 10) / 10
      };
    })
  };
}

/** The numbers as plain-text lines, for the terminal and the mail. */
export function statsText(s: ProductStats): string {
  return [
    `Son ${s.days} gün`,
    '',
    `Çalışma alanları           ${s.workspaces} (bu dönemde konuşma alan: ${s.activeWorkspaces})`,
    `Canlı widget (7 gün)       ${s.liveWidgets}`,
    `Yeni kayıt                 ${s.signups} (e-postasını doğrulayan: %${s.verifiedRate})`,
    `İlk ziyaretçi mesajına     %${s.activationRate} ulaştı, medyan ${s.medianHoursToFirstMessage ?? '-'} saat`,
    `Ücretli abonelik           PRO ${s.paying.PRO}, Kurumsal ${s.paying.ENTERPRISE} (yeni ${s.newPaying}, iptal ${s.canceled})`,
    `Tahmini MRR                ${s.estimatedMrr.amount} ${s.estimatedMrr.currency} (aylık liste fiyatıyla)`,
    `Asistan                    ${s.assistant.conversations} konuşma, %${s.assistant.resolvedRate} temsilciye geçmeden`,
    '',
    'İlk kullanım (bu dönemin kayıtları; ulaşan, medyan saat)',
    ...s.funnel.map(
      (f) =>
        `  ${FUNNEL_LABEL[f.step].padEnd(24)} %${f.rate} (${f.reached}), ${f.medianHours ?? '-'} saat`
    )
  ].join('\n');
}

/**
 * Mails last week's numbers to OPS_REPORT_EMAIL once a week, Monday
 * 05:00-09:00 UTC. A Redis key per ISO week keeps several API processes from
 * sending it twice; without Redis, one process's memory does.
 */
let sentWeek: string | null = null;
export async function weeklyReport(now = new Date()): Promise<boolean> {
  const to = (process.env.OPS_REPORT_EMAIL || '').trim();
  if (!to || now.getUTCDay() !== 1 || now.getUTCHours() < 5 || now.getUTCHours() >= 9) return false;
  const week = `${now.getUTCFullYear()}-${Math.ceil((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 604_800_000)}`;
  if (sentWeek === week) return false;
  const redis = await getRedisClient().catch(() => null);
  if (redis && !(await redis.set(`ops-report:${week}`, '1', { NX: true, EX: 8 * 86400 }))) {
    sentWeek = week;
    return false;
  }
  sentWeek = week;
  const stats = await productStats(7, now);
  const text = `${statsText(stats)}\n\nAyrıntı: npm run org:stats:prod -- 30\n`;
  const html = `<pre style="font:13px/1.5 ui-monospace,monospace">${text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')}</pre>`;
  const sent = await sendMail({
    to,
    subject: `Support.io haftalık rapor — ${now.toISOString().slice(0, 10)}`,
    text,
    html
  });
  if (!sent) logger.warn('the weekly report could not be mailed');
  return sent;
}
