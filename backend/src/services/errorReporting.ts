// Error tracking (plan v10 OBS-01): unexpected failures of the API, the
// sockets, the panel and the widget go to a Sentry-compatible service
// (Sentry's EU region, or a self-hosted GlitchTip) when SENTRY_DSN is set.
// Without it nothing is sent anywhere; the log keeps everything as before.
//
// Not the Sentry SDK, on purpose: one small client decides exactly what
// leaves the server, and the panel and the widget report through our own
// endpoints (routes/telemetry.ts) instead of loading a third-party script on
// customers' pages. What is sent: the error's type, its message with e-mail
// addresses, tokens and keys scrubbed (config/logger.ts scrubText), file
// names and line numbers, the request's method and path (never the query),
// the request id, environment and release. Never: cookies, headers, bodies,
// IP addresses, user ids, message text.
//
//   SENTRY_DSN           https://<key>@<host>/<project>
//   SENTRY_ENVIRONMENT   default NODE_ENV
//   APP_RELEASE          the image's git sha, set by the release workflow
//
// At most EVENTS_PER_MINUTE events leave one process, and the same error
// (type, message, top frame) once a minute: a failing loop cannot flood the
// service or the bill.

import crypto from 'crypto';
import path from 'path';
import { logger, scrubText } from '../config/logger';

const EVENTS_PER_MINUTE = 30;
const SAME_ERROR_MS = 60_000;

interface Dsn {
  url: string;
  auth: string;
  raw: string;
}

let cachedDsn: { raw: string; dsn: Dsn | null } | null = null;

function dsn(): Dsn | null {
  const raw = (process.env.SENTRY_DSN || '').trim();
  if (cachedDsn?.raw === raw) return cachedDsn.dsn;
  let parsed: Dsn | null = null;
  try {
    if (raw) {
      const u = new URL(raw);
      const project = u.pathname.replace(/^\/+|\/+$/g, '');
      if (u.username && project) {
        parsed = {
          url: `${u.protocol}//${u.host}/api/${project}/envelope/`,
          auth: `Sentry sentry_version=7, sentry_key=${u.username}, sentry_client=supportio/1.0`,
          raw
        };
      }
    }
  } catch {
    parsed = null;
  }
  if (raw && !parsed) logger.warn('SENTRY_DSN is not a valid DSN; error tracking is off');
  cachedDsn = { raw, dsn: parsed };
  return parsed;
}

export function errorTrackingEnabled(): boolean {
  return dsn() !== null;
}

export type ErrorSource = 'api' | 'socket' | 'process' | 'job' | 'panel' | 'widget';

export interface ErrorContext {
  source: ErrorSource;
  requestId?: string | null;
  method?: string | null;
  /** A path without its query string. */
  path?: string | null;
  /** For panel and widget reports: their own version. */
  release?: string | null;
  level?: 'error' | 'warning';
}

interface Frame {
  function?: string;
  filename: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
}

const ROOT = path.resolve(__dirname, '../..');

/** Stack lines → Sentry frames, oldest first; file names relative, query strings gone. */
export function framesFrom(stack: string | undefined): Frame[] {
  const frames: Frame[] = [];
  for (const line of String(stack || '')
    .split('\n')
    .slice(1, 40)) {
    const m = /^\s*at (?:(.*?) \()?(.*?):(\d+):(\d+)\)?$/.exec(line);
    if (!m) continue;
    let file = m[2].replace(/\?.*$/, '').replace(/^file:\/\//, '');
    if (file.startsWith(ROOT)) file = file.slice(ROOT.length + 1);
    frames.push({
      function: m[1] ? scrubText(m[1]).slice(0, 100) : undefined,
      filename: scrubText(file).slice(0, 200),
      lineno: Number(m[3]),
      colno: Number(m[4]),
      in_app: !file.includes('node_modules')
    });
  }
  return frames.reverse();
}

let windowStart = 0;
let sentInWindow = 0;
const recent = new Map<string, number>();

function allowed(fingerprint: string): boolean {
  const now = Date.now();
  if (now - windowStart > 60_000) {
    windowStart = now;
    sentInWindow = 0;
  }
  if (sentInWindow >= EVENTS_PER_MINUTE) return false;
  const last = recent.get(fingerprint);
  if (last && now - last < SAME_ERROR_MS) return false;
  recent.set(fingerprint, now);
  if (recent.size > 500) recent.clear();
  sentInWindow += 1;
  return true;
}

/** The event as it would be sent; exported for the test of what leaves. */
export function buildEvent(
  error: { type: string; message: string; stack?: string },
  context: ErrorContext
) {
  const frames = framesFrom(error.stack);
  return {
    event_id: crypto.randomUUID().replace(/-/g, ''),
    timestamp: Date.now() / 1000,
    platform: context.source === 'panel' || context.source === 'widget' ? 'javascript' : 'node',
    level: context.level ?? 'error',
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: (context.release || process.env.APP_RELEASE || '').slice(0, 64) || undefined,
    tags: {
      source: context.source,
      ...(context.requestId ? { request_id: context.requestId } : {})
    },
    ...(context.path
      ? {
          request: {
            method: context.method || undefined,
            url: scrubText(context.path.replace(/\?.*$/, '')).slice(0, 200)
          }
        }
      : {}),
    exception: {
      values: [
        {
          type: scrubText(error.type).slice(0, 100),
          value: scrubText(error.message).slice(0, 1000),
          ...(frames.length ? { stacktrace: { frames } } : {})
        }
      ]
    }
  };
}

function send(event: ReturnType<typeof buildEvent>, target: Dsn): void {
  const envelope = [
    JSON.stringify({ event_id: event.event_id, sent_at: new Date().toISOString() }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event)
  ].join('\n');
  fetch(target.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-sentry-envelope', 'X-Sentry-Auth': target.auth },
    body: envelope,
    signal: AbortSignal.timeout(5000)
  }).catch(() => undefined);
}

/** Reports an unexpected error of the server. Never throws. */
export function captureError(error: unknown, context: ErrorContext): void {
  try {
    const target = dsn();
    if (!target) return;
    const e =
      error instanceof Error
        ? { type: error.name || 'Error', message: error.message || '', stack: error.stack }
        : { type: 'Error', message: String(error) };
    const top = framesFrom(e.stack).at(-1);
    if (!allowed(`${e.type}|${e.message}|${top?.filename}:${top?.lineno}`)) return;
    send(buildEvent(e, context), target);
  } catch {
    /* error tracking never breaks what it reports on */
  }
}

/** A panel or widget error reported through routes/telemetry.ts. */
export function captureClientError(
  report: { type: string; message: string; stack?: string },
  context: ErrorContext
): void {
  try {
    const target = dsn();
    if (!target) return;
    if (!allowed(`${context.source}|${report.type}|${report.message}`)) return;
    send(buildEvent(report, context), target);
  } catch {
    /* as above */
  }
}

/** For tests: forget the rate-limit state. */
export function resetErrorReporting(): void {
  windowStart = 0;
  sentInWindow = 0;
  recent.clear();
  cachedDsn = null;
}
