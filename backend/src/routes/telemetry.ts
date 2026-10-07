// Errors the panel and the widget report (plan v10 OBS-01).
//
//   POST /api/telemetry/panel   the panel's uncaught errors
//   POST /api/widget/telemetry  the widget's failures, one in
//                               WIDGET_TELEMETRY_SAMPLE (default 1 in 10)
//
// Both read at most 8 KB of JSON (sent as text/plain, so a browser needs no
// preflight), are rate limited per address, keep only an error's type,
// message, stack and — for the panel — its path without the query, and
// answer 204. The widget sends no page address at all: it runs on customers'
// sites. What is kept goes to error tracking when SENTRY_DSN is set
// (services/errorReporting.ts) and, scrubbed, to the log.
//
// Mounted before the JSON parser (server.ts).

import express from 'express';
import { createLimiter } from '../middleware/rateLimit';
import { captureClientError } from '../services/errorReporting';
import { logger, scrubText } from '../config/logger';
import type { Request, Response } from 'express';

const text = express.text({ type: ['application/json', 'text/plain'], limit: '8kb' });

const limiter = (name: string, max: number) =>
  createLimiter({
    name,
    code: 'RATE_LIMITED',
    message: 'Too many reports',
    windowMs: 60 * 1000,
    max
  });

const str = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.slice(0, max) : '';

function parse(req: Request): Record<string, unknown> | null {
  if (typeof req.body !== 'string') return null;
  try {
    const value = JSON.parse(req.body);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function sampleRate(): number {
  const value = Number(process.env.WIDGET_TELEMETRY_SAMPLE);
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : 0.1;
}

export const panelTelemetry = express.Router();
panelTelemetry.post('/', limiter('telemetry-panel', 20), text, (req: Request, res: Response) => {
  const body = parse(req);
  if (body) {
    const report = {
      type: str(body.type, 100) || 'Error',
      message: str(body.message, 1000),
      stack: str(body.stack, 4000)
    };
    const path = str(body.path, 200).replace(/\?.*$/, '');
    captureClientError(report, { source: 'panel', path, release: str(body.release, 64) });
    logger.warn(
      { panel: { type: scrubText(report.type), message: scrubText(report.message), path } },
      'panel error'
    );
  }
  res.status(204).end();
});

export const widgetTelemetry = express.Router();
widgetTelemetry.post('/', limiter('telemetry-widget', 10), text, (req: Request, res: Response) => {
  const body = parse(req);
  if (body && Math.random() < sampleRate()) {
    const report = {
      type: str(body.code, 60) || 'WidgetError',
      message: str(body.message, 500),
      stack: str(body.stack, 2000)
    };
    const release = str(body.sdkVersion, 20);
    captureClientError(report, { source: 'widget', release });
    logger.warn(
      { widget: { code: scrubText(report.type), message: scrubText(report.message), release } },
      'widget error'
    );
  }
  res.status(204).end();
});
