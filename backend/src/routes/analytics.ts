import express from 'express';
import events from '../events';
import { auth } from '../middleware/auth';
import { rolePermissions } from '../middleware/rbac';
import { agentRows, analyticsOverview, RANGES } from '../db/analyticsQueries';
import { conversationRows, slaBreaches, weekHeatmap } from '../db/reportQueries';
import { requireFeature } from '../services/entitlements';
import { toCsv, toXlsx } from '../services/reportFiles';
import type { Cell, Table } from '../services/reportFiles';
import {
  asyncHandler,
  badRequest,
  forbidden,
  loadOwnedSite,
  orgId,
  requireOrganization
} from '../http';
import type { Request, Response, NextFunction } from 'express';

const router = express.Router();

// Organization-wide reporting is not the same permission for every role in
// rolePermissions: an owner carries `view_analytics` while admins and managers
// carry `view_reports`. checkPermission only tests one name, so it would reject
// whichever half it was not given. Accepting either name keeps the middleware's
// role table as the single source of truth without renaming permissions that
// other routes already depend on.
const REPORTING_PERMISSIONS = ['view_analytics', 'view_reports'];

const canViewReports = (req: Request, _res: Response, next: NextFunction) => {
  const granted = rolePermissions[req.user?.role] || [];
  if (!REPORTING_PERMISSIONS.some((p) => granted.includes(p))) {
    throw forbidden('Insufficient role permissions');
  }
  next();
};

/** The window a request asks for, in days; only the named windows are accepted. */
function rangeDays(req: Request): { range: string; days: number } {
  const range = String(req.query.range || '7days');
  if (!RANGES[range]) {
    throw badRequest(`range must be one of: ${Object.keys(RANGES).join(', ')}`);
  }
  return { range, days: RANGES[range] };
}

/** An explicit site filter has to be a site this organization owns. */
async function siteFilter(req: Request): Promise<string | null> {
  return req.query.siteId ? String((await loadOwnedSite(req, req.query.siteId))._id) : null;
}

const TIME_ZONES = new Set(Intl.supportedValuesOf('timeZone'));
TIME_ZONES.add('UTC');

/** The viewer's IANA time zone (the panel sends the browser's); Istanbul otherwise. */
function timeZone(req: Request): string {
  const tz = String(req.query.tz || 'Europe/Istanbul');
  if (!TIME_ZONES.has(tz)) throw badRequest('tz is an IANA time zone, e.g. Europe/Istanbul');
  return tz;
}

// Whole analytics dashboard in one request. The aggregation is always scoped to
// the caller's organization, so a permitted user still only sees their tenant.
router.get(
  '/overview',
  auth,
  requireOrganization,
  canViewReports,
  asyncHandler(async (req: Request, res: Response) => {
    const { range } = rangeDays(req);
    const siteId = await siteFilter(req);
    res.json(await analyticsOverview(orgId(req), { siteId, range }));
  })
);

// When conversations start: weekday × hour in the viewer's time zone (PRD-22).
router.get(
  '/heatmap',
  auth,
  requireOrganization,
  canViewReports,
  asyncHandler(async (req: Request, res: Response) => {
    const { days } = rangeDays(req);
    const tz = timeZone(req);
    const siteId = await siteFilter(req);
    res.json({ timeZone: tz, grid: await weekHeatmap(orgId(req), siteId, days, tz) });
  })
);

// The conversations whose first answer came too late (PRD-22).
router.get(
  '/sla-breaches',
  auth,
  requireOrganization,
  canViewReports,
  asyncHandler(async (req: Request, res: Response) => {
    const { days } = rangeDays(req);
    const siteId = await siteFilter(req);
    const rows = await slaBreaches(orgId(req), siteId, days, 50);
    res.json({
      breaches: rows.map((r) => ({
        id: r.id,
        ticketId: r.ticket_id,
        siteId: r.site_id,
        site: r.site,
        createdAt: r.created_at,
        waitedMinutes: r.waited_minutes,
        status: r.status,
        priority: r.priority,
        agent: r.agent,
        department: r.department
      }))
    });
  })
);

// ------------------------------------------------------------------ export

const REPORTS = ['conversations', 'agents', 'sla'] as const;
type Report = (typeof REPORTS)[number];

const HEADERS: Record<Report, Record<'tr' | 'en', string[]>> = {
  conversations: {
    tr: [
      'Talep no',
      'Başlangıç',
      'Site',
      'Durum',
      'Öncelik',
      'Kanal',
      'Ziyaretçi',
      'E-posta',
      'Temsilci',
      'Departman',
      'Etiketler',
      'Mesaj sayısı',
      'İlk yanıt (dk)',
      'Çözüm (dk)',
      'SLA (ilk yanıt)',
      'Puan',
      'Yorum'
    ],
    en: [
      'Ticket',
      'Started',
      'Site',
      'Status',
      'Priority',
      'Channel',
      'Visitor',
      'E-mail',
      'Agent',
      'Department',
      'Tags',
      'Messages',
      'First response (min)',
      'Resolution (min)',
      'SLA (first response)',
      'Rating',
      'Comment'
    ]
  },
  agents: {
    tr: [
      'Temsilci',
      'Konuşma',
      'Açık',
      'Çözülen',
      'SLA uyumu (%)',
      'Ort. ilk yanıt (dk)',
      'Ort. puan'
    ],
    en: [
      'Agent',
      'Conversations',
      'Open',
      'Resolved',
      'SLA met (%)',
      'Avg first response (min)',
      'Avg rating'
    ]
  },
  sla: {
    tr: [
      'Talep no',
      'Başlangıç',
      'Site',
      'Bekleme (dk)',
      'Durum',
      'Öncelik',
      'Temsilci',
      'Departman'
    ],
    en: ['Ticket', 'Started', 'Site', 'Waited (min)', 'Status', 'Priority', 'Agent', 'Department']
  }
};

const SHEET: Record<Report, Record<'tr' | 'en', string>> = {
  conversations: { tr: 'Konuşmalar', en: 'Conversations' },
  agents: { tr: 'Temsilciler', en: 'Agents' },
  sla: { tr: 'SLA ihlalleri', en: 'SLA breaches' }
};

/** "2026-10-09 14:05" in the viewer's zone: what a spreadsheet shows plainly. */
function localTime(value: Date | string | null, tz: string): string {
  if (!value) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

async function buildTable(
  report: Report,
  organizationId: string,
  siteId: string | null,
  days: number,
  tz: string,
  lang: 'tr' | 'en'
): Promise<Table> {
  let rows: Cell[][];
  if (report === 'conversations') {
    rows = (await conversationRows(organizationId, siteId, days)).map((r) => [
      r.ticket_id,
      localTime(r.created_at, tz),
      r.site,
      r.status,
      r.priority,
      r.channel,
      r.visitor_name,
      r.visitor_email,
      r.agent,
      r.department,
      (r.tags || []).join(', '),
      r.messages,
      r.first_response_minutes,
      r.resolution_minutes,
      r.sla_first_response,
      r.rating,
      r.rating_comment
    ]);
  } else if (report === 'agents') {
    rows = (await agentRows(organizationId, siteId, days)).map((a) => [
      a.name,
      a.total,
      a.active,
      a.resolved,
      a.sla,
      a.avgTime,
      a.rating
    ]);
  } else {
    rows = (await slaBreaches(organizationId, siteId, days, 10_000)).map((r) => [
      r.ticket_id,
      localTime(r.created_at, tz),
      r.site,
      r.waited_minutes,
      r.status,
      r.priority,
      r.agent,
      r.department
    ]);
  }
  return { name: SHEET[report][lang], headers: HEADERS[report][lang], rows };
}

// A report as a file: CSV or Excel, on a plan with exports (PRD-22). It
// carries visitors' names and addresses, so every download is audited.
router.get(
  '/export',
  auth,
  requireOrganization,
  canViewReports,
  requireFeature('export'),
  asyncHandler(async (req: Request, res: Response) => {
    const report = String(req.query.report || 'conversations') as Report;
    if (!REPORTS.includes(report)) {
      throw badRequest(`report must be one of: ${REPORTS.join(', ')}`);
    }
    const format = String(req.query.format || 'csv');
    if (format !== 'csv' && format !== 'xlsx') throw badRequest('format must be csv or xlsx');
    const { range, days } = rangeDays(req);
    const tz = timeZone(req);
    const lang = req.query.lang === 'en' ? 'en' : 'tr';
    const siteId = await siteFilter(req);

    const table = await buildTable(report, orgId(req), siteId, days, tz, lang);
    const body = format === 'csv' ? toCsv(table) : toXlsx(table);
    const day = localTime(new Date(), tz).slice(0, 10);
    const file = `support-io-${report}-${range}-${day}.${format}`;

    events.emit('report.exported', {
      organizationId: orgId(req),
      userId: req.user?._id ?? null,
      metadata: { report, format, range, siteId, rows: table.rows.length },
      ip: req.ip,
      ua: req.get('user-agent')
    });
    res.set({
      'Content-Type':
        format === 'csv'
          ? 'text/csv; charset=utf-8'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${file}"`,
      // The panel names the file from this header; when it runs on another
      // origin than the API, the browser shares the header only if told so.
      'Access-Control-Expose-Headers': 'Content-Disposition',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(body);
  })
);

export default router;
