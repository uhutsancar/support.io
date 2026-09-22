'use strict';

// Analytics aggregation.
//
// The admin panel used to build these figures in the browser: it fetched
// conversations per site and reduced them in JavaScript. That endpoint caps at
// 50 rows, so every chart silently described at most 50 conversations per site
// and a couple of tiles were hardcoded outright. Everything here is computed by
// PostgreSQL over the whole window instead.
//
// Every function takes the caller's organization id and only ever reads rows
// belonging to it, so analytics cannot leak across tenants.

// Windows the API accepts. The number of days is looked up here rather than
// parsed from the request, so no caller-supplied text reaches an interval.
import { query } from './pool';

const RANGES: Record<string, number> = {
  today: 1,
  '7days': 7,
  '30days': 30,
  '90days': 90
};

/** The identifiers every aggregate is scoped by. */
type OrgId = string;
type SiteId = string | null | undefined;

// Shared WHERE fragment: one organization, optionally one site, inside the
// window. Returns the SQL text plus the parameter list it expects.
function scope(organizationId: OrgId, siteId: SiteId, days: number): { sql: string; params: unknown[] } {
  const params: unknown[] = [organizationId, `${days} days`];
  let sql = 'c.organization_id = $1 AND c.created_at >= now() - $2::interval';
  if (siteId) {
    params.push(siteId);
    sql += ` AND c.site_id = $${params.length}`;
  }
  return { sql, params };
}

const round = (value: unknown, digits = 1): number | null =>
  value === null || value === undefined ? null : Number(Number(value).toFixed(digits));

// Headline tiles.
async function overviewStats(organizationId: OrgId, siteId: SiteId, days: number) {
  const { sql, params } = scope(organizationId, siteId, days);

  const [totals, agents] = await Promise.all([
    query(
      `SELECT
         count(*)::int AS total,
         count(*) FILTER (WHERE c.status IN ('open', 'assigned', 'pending'))::int AS open_tickets,
         count(*) FILTER (WHERE c.status IN ('resolved', 'closed'))::int AS resolved,
         count(*) FILTER (WHERE c.status = 'open' AND c.assigned_agent_id IS NULL)::int AS unassigned,
         count(*) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'breached')::int AS sla_breaches,
         avg(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60)
           FILTER (WHERE c.first_response_at IS NOT NULL) AS avg_first_response,
         avg(EXTRACT(EPOCH FROM (c.resolved_at - c.created_at)) / 60)
           FILTER (WHERE c.resolved_at IS NOT NULL) AS avg_resolution,
         avg(NULLIF(c.rating ->> 'score', '')::numeric)
           FILTER (WHERE c.rating ->> 'score' IS NOT NULL) AS csat,
         count(*) FILTER (WHERE c.rating ->> 'score' IS NOT NULL)::int AS rated,
         -- The dashboard used to derive these two in the browser from one page
         -- of conversations per site, so both were wrong for any tenant with
         -- more than a page of history.
         count(*) FILTER (WHERE c.resolved_at >= date_trunc('day', now()))::int AS resolved_today,
         count(*) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'met')::int AS sla_met,
         count(*) FILTER (WHERE c.sla ->> 'firstResponseStatus' IN ('met', 'breached'))::int AS sla_measured
       FROM conversations c
      WHERE ${sql}`,
      params
    ),
    // Agent headcount is a live figure about the organization, not about the
    // window, so it is counted separately and never hardcoded.
    query(
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE status = 'online')::int AS active
         FROM teams
        WHERE organization_id = $1 AND is_active = true`,
      [organizationId]
    )
  ]);

  const t = totals.rows[0];
  const a = agents.rows[0];

  return {
    totalConversations: t.total,
    openTickets: t.open_tickets,
    resolvedConversations: t.resolved,
    unassigned: t.unassigned,
    slaBreaches: t.sla_breaches,
    avgFirstResponseMinutes: round(t.avg_first_response),
    avgResolutionMinutes: round(t.avg_resolution),
    csat: round(t.csat, 2),
    // The tile shows satisfaction as a percentage of a five point scale.
    satisfaction: t.csat === null ? null : Math.round(Number(t.csat) * 20),
    ratedCount: t.rated,
    activeAgents: a.active,
    totalAgents: a.total,
    resolvedToday: t.resolved_today,
    // Yalnizca olculebilmis konusmalar payda olur: SLA'si hic degerlendirilmemis
    // kayitlari paydaya koymak orani oldugundan dusuk gosterirdi.
    slaComplianceRate: t.sla_measured > 0
      ? Math.round((t.sla_met / t.sla_measured) * 100)
      : null
  };
}

// One row per day across the window, including days with no traffic so the
// chart keeps an even x axis.
async function dailyBreakdown(organizationId: OrgId, siteId: SiteId, days: number) {
  const { sql, params } = scope(organizationId, siteId, days);

  const { rows } = await query(
    `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
            count(c.id)::int AS tickets,
            count(c.id) FILTER (WHERE c.status IN ('resolved', 'closed'))::int AS resolved,
            count(c.id) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'met')::int AS sla_met
       FROM generate_series(
              date_trunc('day', now() - $2::interval),
              date_trunc('day', now()),
              interval '1 day') AS d(day)
       LEFT JOIN conversations c
              ON date_trunc('day', c.created_at) = d.day
             AND ${sql}
      GROUP BY d.day
      ORDER BY d.day`,
    params
  );

  return rows.map((r) => ({
    date: r.date,
    tickets: r.tickets,
    resolved: r.resolved,
    sla: r.sla_met
  }));
}

// Average first response time by hour of day, to show when the queue slows.
async function responseTimeByHour(organizationId: OrgId, siteId: SiteId, days: number) {
  const { sql, params } = scope(organizationId, siteId, days);

  const { rows } = await query(
    `SELECT h.hour::int AS hour,
            avg(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60) AS avg_minutes,
            count(c.id)::int AS samples
       FROM generate_series(0, 23) AS h(hour)
       LEFT JOIN conversations c
              ON EXTRACT(HOUR FROM c.created_at) = h.hour
             AND c.first_response_at IS NOT NULL
             AND ${sql}
      GROUP BY h.hour
      ORDER BY h.hour`,
    params
  );

  return rows.map((r) => ({
    hour: `${String(r.hour).padStart(2, '0')}:00`,
    // Null keeps an hour with no data out of the line rather than drawing it
    // as a suspiciously perfect zero.
    avgTime: r.samples > 0 ? round(r.avg_minutes) : null,
    samples: r.samples
  }));
}

async function channelDistribution(organizationId: OrgId, siteId: SiteId, days: number) {
  const { sql, params } = scope(organizationId, siteId, days);

  const { rows } = await query(
    `SELECT c.channel, count(*)::int AS value
       FROM conversations c
      WHERE ${sql}
      GROUP BY c.channel
      ORDER BY value DESC`,
    params
  );

  const labels: Record<string, { name: string; color: string }> = {
    'web-chat': { name: 'Web Chat', color: '#8B5CF6' },
    email: { name: 'E-posta', color: '#3B82F6' },
    whatsapp: { name: 'WhatsApp', color: '#10B981' },
    phone: { name: 'Telefon', color: '#F59E0B' }
  };

  return rows.map((r) => ({
    channel: r.channel,
    name: labels[r.channel]?.name || r.channel,
    color: labels[r.channel]?.color || '#6B7280',
    value: r.value
  }));
}

// Met / breached / still running, for both SLA clocks.
async function slaCompliance(organizationId: OrgId, siteId: SiteId, days: number) {
  const { sql, params } = scope(organizationId, siteId, days);

  const { rows } = await query(
    `SELECT
       count(*) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'met')::int AS fr_met,
       count(*) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'breached')::int AS fr_breached,
       count(*) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'pending')::int AS fr_pending,
       count(*) FILTER (WHERE c.sla ->> 'resolutionStatus' = 'met')::int AS res_met,
       count(*) FILTER (WHERE c.sla ->> 'resolutionStatus' = 'breached')::int AS res_breached,
       count(*) FILTER (WHERE c.sla ->> 'resolutionStatus' = 'pending')::int AS res_pending
     FROM conversations c
    WHERE ${sql}`,
    params
  );

  const r = rows[0];
  return [
    { category: 'İlk Yanıt SLA', key: 'firstResponse', met: r.fr_met, breached: r.fr_breached, pending: r.fr_pending },
    { category: 'Çözüm SLA', key: 'resolution', met: r.res_met, breached: r.res_breached, pending: r.res_pending }
  ];
}

async function departmentBreakdown(organizationId: OrgId, siteId: SiteId, days: number) {
  const { sql, params } = scope(organizationId, siteId, days);

  const { rows } = await query(
    `SELECT d.id,
            d.name,
            d.color,
            count(c.id)::int AS tickets,
            count(c.id) FILTER (WHERE c.status IN ('resolved', 'closed'))::int AS resolved,
            count(c.id) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'met')::int AS sla_met,
            count(c.id) FILTER (WHERE c.sla ->> 'firstResponseStatus' IN ('met', 'breached'))::int AS sla_decided,
            avg(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60)
              FILTER (WHERE c.first_response_at IS NOT NULL) AS avg_minutes
       FROM departments d
       JOIN conversations c ON c.department_id = d.id AND ${sql}
      GROUP BY d.id, d.name, d.color
      ORDER BY tickets DESC`,
    params
  );

  return rows.map((r) => ({
    _id: r.id,
    name: r.name,
    color: r.color,
    tickets: r.tickets,
    resolved: r.resolved,
    // Percentage of the conversations whose SLA actually reached a verdict;
    // the ones still running are excluded rather than counted as failures.
    sla: r.sla_decided > 0 ? round((r.sla_met / r.sla_decided) * 100) : null,
    avgTime: round(r.avg_minutes)
  }));
}

// Per-agent workload. Agents live in `teams`, and conversations reference them
// without a foreign key, so the join is on the id column directly.
async function agentBreakdown(organizationId: OrgId, siteId: SiteId, days: number) {
  const { sql, params } = scope(organizationId, siteId, days);

  const { rows } = await query(
    `SELECT t.id,
            t.name,
            t.status,
            count(c.id)::int AS total,
            count(c.id) FILTER (WHERE c.status IN ('open', 'assigned', 'pending'))::int AS active,
            count(c.id) FILTER (WHERE c.status IN ('resolved', 'closed'))::int AS resolved,
            count(c.id) FILTER (WHERE c.sla ->> 'firstResponseStatus' = 'met')::int AS sla_met,
            count(c.id) FILTER (WHERE c.sla ->> 'firstResponseStatus' IN ('met', 'breached'))::int AS sla_decided,
            avg(EXTRACT(EPOCH FROM (c.first_response_at - c.created_at)) / 60)
              FILTER (WHERE c.first_response_at IS NOT NULL) AS avg_minutes,
            avg(NULLIF(c.rating ->> 'score', '')::numeric)
              FILTER (WHERE c.rating ->> 'score' IS NOT NULL) AS rating
       FROM teams t
       LEFT JOIN conversations c ON c.assigned_agent_id = t.id AND ${sql}
      WHERE t.organization_id = $1 AND t.is_active = true
      GROUP BY t.id, t.name, t.status
      ORDER BY resolved DESC, t.name`,
    params
  );

  return rows.map((r) => ({
    _id: r.id,
    name: r.name,
    status: r.status,
    total: r.total,
    active: r.active,
    resolved: r.resolved,
    sla: r.sla_decided > 0 ? round((r.sla_met / r.sla_decided) * 100) : null,
    avgTime: round(r.avg_minutes),
    rating: round(r.rating, 2)
  }));
}

async function statusAndPriorityBreakdown(organizationId: OrgId, siteId: SiteId, days: number) {
  const { sql, params } = scope(organizationId, siteId, days);

  const [statuses, priorities] = await Promise.all([
    query(
      `SELECT c.status, count(*)::int AS value FROM conversations c
        WHERE ${sql} GROUP BY c.status ORDER BY value DESC`,
      params
    ),
    query(
      `SELECT c.priority, count(*)::int AS value FROM conversations c
        WHERE ${sql} GROUP BY c.priority ORDER BY value DESC`,
      params
    )
  ]);

  return {
    byStatus: statuses.rows.map((r) => ({ status: r.status, value: r.value })),
    byPriority: priorities.rows.map((r) => ({ priority: r.priority, value: r.value }))
  };
}

// The whole dashboard in one round trip.
/** The window and optional site an overview is asked for. */
export interface AnalyticsOverviewOptions {
  siteId?: SiteId;
  range?: string;
}

async function analyticsOverview(
  organizationId: OrgId,
  { siteId = null, range = '7days' }: AnalyticsOverviewOptions = {}
) {
  const days = RANGES[range];
  if (!days) throw new Error(`Unsupported range: ${range}`);

  const [stats, daily, hourly, channels, sla, departments, agents, breakdown] = await Promise.all([
    overviewStats(organizationId, siteId, days),
    dailyBreakdown(organizationId, siteId, days),
    responseTimeByHour(organizationId, siteId, days),
    channelDistribution(organizationId, siteId, days),
    slaCompliance(organizationId, siteId, days),
    departmentBreakdown(organizationId, siteId, days),
    agentBreakdown(organizationId, siteId, days),
    statusAndPriorityBreakdown(organizationId, siteId, days)
  ]);

  return {
    range,
    days,
    generatedAt: new Date().toISOString(),
    stats,
    dailyTickets: daily,
    responseTimeByHour: hourly,
    channelDistribution: channels,
    slaCompliance: sla,
    departmentStats: departments,
    agentPerformance: agents,
    ...breakdown
  };
}

export { analyticsOverview, RANGES };