// Structured logging (plan §11.3).
//
// One JSON line per event in production, readable lines in development
// (LOG_PRETTY is not needed: pino's default is JSON; development keeps the
// same format so what you read locally is what the server writes). Every
// HTTP request gets an id (`x-request-id` from the proxy, or a fresh UUID);
// it is echoed in the response header and in every error answer, so a
// customer's "it failed" can be found in the log.
//
// Never logged: passwords, tokens, cookies, API keys, message contents, full
// database URLs. Paths are logged without their query string, which can carry
// tokens (verification and reset links). An e-mail address that ends up in a
// logged object is masked to u***@d***.com (plan v10 SEC-16):
// enough to tell two apart, not enough to write to.
//
// The rest of the code still uses console.* in places; those calls are moved
// here as they are touched.

import crypto from 'crypto';
import util from 'util';
import pino from 'pino';
import type { NextFunction, Request, Response } from 'express';

/** u***@d***.com: the first letter of each part and the top-level domain. */
export function maskEmail(value: string): string {
  const at = value.lastIndexOf('@');
  if (at < 1) return '[redacted]';
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${value[0]}***@${host[0] || ''}***${tld}`;
}

// Keys whose value never reaches a log line, at the top level and one level
// down (pino's redact is path based; `*.x` is "x inside any object").
const SECRET_KEYS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'apiKey',
  'secret',
  'content',
  'text',
  'feedback',
  'phone',
  'email'
];
const HEADER_PATHS = ['authorization', 'cookie', '["set-cookie"]', '["x-goog-api-key"]'].flatMap(
  (header) =>
    [`req.headers.${header}`, `headers.${header}`, `*.headers.${header}`].map((path) =>
      path.replace('.[', '[')
    )
);

/** Where lines go: stdout, unless a test is collecting them (captureLogs). */
const stdout = pino.destination({ dest: 1, sync: false });
let collector: string[] | null = null;
const destination = {
  write(line: string) {
    if (collector) collector.push(line);
    else stdout.write(line);
  }
};

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    // An error's message and a database error's detail can carry the value
    // that failed, an e-mail address among them; scrubbed like console output.
    serializers: {
      err: (error: Error) => {
        const out = pino.stdSerializers.err(error) as unknown as Record<string, unknown>;
        for (const key of ['message', 'stack', 'detail', 'hint', 'where']) {
          if (typeof out[key] === 'string') out[key] = scrubText(out[key] as string);
        }
        return out;
      }
    },
    hooks: {
      logMethod(args, method) {
        Reflect.apply(
          method,
          this,
          args.map((arg) => sanitizeForLog(arg))
        );
      }
    },
    redact: {
      paths: [...HEADER_PATHS, ...SECRET_KEYS.flatMap((key) => [key, `*.${key}`])],
      censor: (value: unknown, path: string[]) =>
        path[path.length - 1] === 'email' && typeof value === 'string'
          ? maskEmail(value)
          : '[redacted]'
    }
  },
  destination
);

/**
 * For tests: every line from here on is kept in memory instead of printed,
 * until `stop()`. The level is lifted to `info` meanwhile, so a suite run with
 * NODE_ENV=test sees what production would write.
 */
export function captureLogs(): { lines: string[]; stop(): void } {
  const lines: string[] = [];
  const level = logger.level;
  collector = lines;
  if (logger.level === 'silent') logger.level = 'info';
  return {
    lines,
    stop() {
      collector = null;
      logger.level = level;
    }
  };
}

// ---------------------------------------------------------------- console
//
// Older code still writes with console.*, often a whole Error. A database
// error carries the offending value in its `detail` ("Key (email)=(…) already
// exists"), and anything can end up in a template string. Whatever goes
// through console is therefore scrubbed on the way out: e-mail addresses are
// masked, and session tokens (JWTs) and Google API keys are replaced.

const EMAIL_RX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const JWT_RX = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;
const GOOGLE_KEY_RX = /\bAIza[0-9A-Za-z_-]{35}\b/g;
const AWS_ACCESS_KEY_RX = /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g;
const BEARER_RX = /\bBearer\s+[A-Za-z0-9._~+/-]{12,}={0,2}/gi;
const PRIVATE_KEY_RX =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]{0,10000}?-----END [A-Z ]*PRIVATE KEY-----/g;
const TOKEN_URL_RX = /https:\/\/(?:hooks\.slack\.com\/services|api\.telegram\.org\/bot)[^\s"']+/gi;
const SECRET_KEY_RX =
  /(?:pass(?:word)?|token|secret|authorization|cookie|api.?key|credential|signature|totp|recovery|private.?key|encrypted|dsn)/i;
const LOG_MAX_DEPTH = 6;
const LOG_MAX_KEYS = 100;

/** The text with addresses masked and tokens and keys removed. */
export function scrubText(text: string): string {
  return text
    .replace(PRIVATE_KEY_RX, '[private-key]')
    .replace(JWT_RX, '[jwt]')
    .replace(GOOGLE_KEY_RX, '[api-key]')
    .replace(AWS_ACCESS_KEY_RX, '[aws-key]')
    .replace(BEARER_RX, 'Bearer [redacted]')
    .replace(TOKEN_URL_RX, '[token-url]')
    .replace(EMAIL_RX, (address) => maskEmail(address));
}

/** Bounded recursive redaction for every structured log argument. */
export function sanitizeForLog(
  value: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet()
): unknown {
  if (typeof value === 'string') return scrubText(value).replace(/[\r\n\t\0]/g, ' ');
  if (value === null || typeof value !== 'object') return value;
  if (depth >= LOG_MAX_DEPTH) return '[truncated]';
  if (seen.has(value)) return '[circular]';
  seen.add(value);
  if (value instanceof Error) {
    return {
      name: scrubText(value.name).slice(0, 100),
      message: scrubText(value.message).slice(0, 1000),
      stack: scrubText(value.stack || '').slice(0, 8000)
    };
  }
  if (Array.isArray(value)) {
    return value.slice(0, LOG_MAX_KEYS).map((item) => sanitizeForLog(item, depth + 1, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value).slice(0, LOG_MAX_KEYS)) {
    if (SECRET_KEY_RX.test(key)) out[key] = '[redacted]';
    else if (/email/i.test(key) && typeof item === 'string') out[key] = maskEmail(item);
    else out[key] = sanitizeForLog(item, depth + 1, seen);
  }
  return out;
}

function scrubArg(arg: unknown): unknown {
  const clean = sanitizeForLog(arg);
  return typeof clean === 'object'
    ? util.inspect(clean, { depth: LOG_MAX_DEPTH, breakLength: Infinity })
    : clean;
}

let consoleScrubbed = false;

/** Scrubs every console.* call from here on; server.ts calls it first thing. */
export function installConsoleRedaction(): void {
  if (consoleScrubbed) return;
  consoleScrubbed = true;
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[method].bind(console);
    console[method] = (...args: unknown[]) => original(...args.map(scrubArg));
  }
}

const REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

declare module 'express-serve-static-core' {
  interface Request {
    /** This request's id, also sent back as X-Request-Id. */
    id: string;
  }
}

/** Gives the request an id and logs it once it is answered. */
export function requestLogging(req: Request, res: Response, next: NextFunction): void {
  const incoming = String(req.headers['x-request-id'] || '');
  req.id = REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  const started = process.hrtime.bigint();
  res.on('finish', () => {
    // Health probes every few seconds would drown everything else.
    if (req.path === '/health' || req.path === '/ready') return;
    const ms = Number(process.hrtime.bigint() - started) / 1e6;
    const line = {
      requestId: req.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Math.round(ms)
    };
    if (res.statusCode >= 500) logger.error(line, 'request failed');
    else if (req.path.startsWith('/api')) logger.info(line, 'request');
  });
  next();
}
