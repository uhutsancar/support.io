// POST /api/csp-report (plan v10 SEC-11): where browsers send what the
// Content Security Policy blocked (middleware/csp.ts names it in report-uri
// and report-to).
//
// Nothing is stored. One report in CSP_REPORT_SAMPLE_RATE (default 1 in 100)
// becomes a log line, enough to notice a policy that breaks a page without
// letting a noisy extension fill the log. The line keeps the directive and
// the origins involved, never a full URL: a page address or a blocked URL
// can carry a token or an e-mail address in its path or query.
//
// Mounted before the JSON parser (server.ts): browsers send
// application/csp-report (report-uri) or application/reports+json
// (report-to), at most 8 KB is read, and the address is rate limited. The
// answer is always 204, so a browser has nothing to retry.

import express from 'express';
import { createLimiter } from '../middleware/rateLimit';
import { logger } from '../config/logger';
import type { Request, Response } from 'express';

const router = express.Router();

const cspReportLimiter = createLimiter({
  name: 'csp-report',
  code: 'RATE_LIMITED',
  message: 'Too many reports',
  windowMs: 60 * 1000,
  max: Number(process.env.CSP_REPORT_RATE_MAX) || 30
});

function sampleRate(): number {
  const value = Number(process.env.CSP_REPORT_SAMPLE_RATE);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.01;
}

/** The origin of a URL, or a keyword like 'inline' / 'eval' as it is. */
function originOf(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null;
  if (!value.includes(':') || /^(inline|eval|wasm-eval|trusted-types-sink)$/.test(value)) {
    return value.slice(0, 40);
  }
  try {
    const url = new URL(value);
    return url.origin === 'null' ? `${url.protocol}` : url.origin;
  } catch {
    return null;
  }
}

/** The path of a page, without its query string or fragment. */
function pathOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    return new URL(value).pathname.slice(0, 200);
  } catch {
    return null;
  }
}

interface Violation {
  directive: string | null;
  blocked: string | null;
  page: string | null;
  disposition: string | null;
}

/** One violation from either report format, reduced to what is logged. */
export function summarize(raw: unknown): Violation[] {
  const pick = (r: Record<string, unknown>): Violation => ({
    directive:
      String(
        r['effective-directive'] ?? r.effectiveDirective ?? r['violated-directive'] ?? ''
      ).slice(0, 60) || null,
    blocked: originOf(r['blocked-uri'] ?? r.blockedURL),
    page: pathOf(r['document-uri'] ?? r.documentURL),
    disposition: typeof r.disposition === 'string' ? r.disposition.slice(0, 10) : null
  });
  // report-uri: { "csp-report": { … } }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const body = (raw as Record<string, unknown>)['csp-report'];
    return body && typeof body === 'object' ? [pick(body as Record<string, unknown>)] : [];
  }
  // report-to: [{ type: "csp-violation", body: { … } }, …]
  if (Array.isArray(raw)) {
    return raw
      .filter((r) => r && typeof r === 'object' && r.type === 'csp-violation' && r.body)
      .slice(0, 10)
      .map((r) => pick(r.body as Record<string, unknown>));
  }
  return [];
}

router.post(
  '/',
  cspReportLimiter,
  express.text({
    type: ['application/csp-report', 'application/reports+json', 'application/json'],
    limit: '8kb'
  }),
  (req: Request, res: Response) => {
    if (typeof req.body === 'string' && Math.random() < sampleRate()) {
      try {
        for (const violation of summarize(JSON.parse(req.body))) {
          logger.warn({ csp: violation }, 'csp violation');
        }
      } catch {
        /* not JSON: nothing to log */
      }
    }
    res.status(204).end();
  }
);

export default router;
