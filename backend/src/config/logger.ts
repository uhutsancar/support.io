// Structured logging (plan §11.3).
//
// One JSON line per event in production, readable lines in development
// (LOG_PRETTY is not needed: pino's default is JSON; development keeps the
// same format so what you read locally is what the server writes). Every
// HTTP request gets an id (`x-request-id` from the proxy, or a fresh UUID);
// it is echoed in the response header and in every error answer, so a
// customer's "it failed" can be found in the log.
//
// Never logged: passwords, tokens, cookies, message contents, full database
// URLs. Paths are logged without their query string, which can carry tokens
// (verification and reset links).
//
// The rest of the code still uses console.* in places; those calls are moved
// here as they are touched.

import crypto from 'crypto';
import pino from 'pino';
import type { NextFunction, Request, Response } from 'express';

export const logger = pino({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: undefined,
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'password',
      'token',
      '*.password',
      '*.token',
      'content',
      '*.content'
    ],
    censor: '[redacted]'
  }
});

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
