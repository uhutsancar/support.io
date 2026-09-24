// One error model for the whole API.
//
// Before this file there were two conventions living side by side. Most routes
// called `sendError`, which mapped PostgreSQL SQLSTATEs to safe messages and
// logged the real cause. The rest — departments, team, audit, files — wrote
// `res.status(500).json({ error: 'Failed to fetch departments' })` straight
// into the catch block. That second form had three problems:
//
//   * a ValidationError the model raised on purpose came back as 500, so the
//     client could not tell "you sent something wrong" from "we broke";
//   * nothing was logged, so the actual cause was simply gone;
//   * the status was always 500, including for a duplicate-key conflict.
//
// Handlers now signal failure the way the language already does: they throw.
// An expected failure is an `HttpError` carrying its own status; anything else
// is a bug and becomes a logged 500. `describeError` is the single place that
// decides what the client is told, and `sendError` is kept as a thin wrapper
// so call sites can migrate one at a time.

import { ValidationError } from '../db/model';

/**
 * A failure the API means to report, with the status the caller should see.
 *
 * `message` is sent to the client verbatim, so it must never contain database
 * text, file paths or anything else internal. Use the constructors below rather
 * than building statuses by hand — they keep the codes consistent, which is
 * what the admin panel branches on.
 */
export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace?.(this, HttpError);
  }
}

export const badRequest = (message: string, details?: unknown): HttpError =>
  new HttpError(400, message, 'VALIDATION_ERROR', details);

export const unauthorized = (message = 'Please authenticate.'): HttpError =>
  new HttpError(401, message, 'UNAUTHENTICATED');

export const forbidden = (message: string, code = 'FORBIDDEN'): HttpError =>
  new HttpError(403, message, code);

/**
 * The answer for anything the caller may not see.
 *
 * A resource that belongs to another tenant answers 404, not 403: a 403 would
 * confirm that the id exists, which is exactly what someone walking ids is
 * trying to find out.
 */
export const notFound = (what = 'Resource', code = 'NOT_FOUND'): HttpError =>
  new HttpError(404, `${what} not found`, code);

export const conflict = (message: string): HttpError => new HttpError(409, message, 'CONFLICT');

export const unavailable = (message: string, code = 'UNAVAILABLE'): HttpError =>
  new HttpError(503, message, code);

/**
 * The message behind whatever was thrown.
 *
 * `useUnknownInCatchVariables` is on, so a catch binding is `unknown` and
 * `error.message` no longer compiles. That is the point: a library that throws
 * a string, or a rejected promise carrying a plain object, used to log the word
 * "undefined" and lose the cause entirely. This narrows once, here.
 */
export function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

/** PostgreSQL failures that mean "the request was wrong", not "we are broken". */
const PG_ERRORS: Record<string, { status: number; error: string; code: string }> = {
  '23505': { status: 409, error: 'This record already exists', code: 'CONFLICT' },
  '23503': { status: 400, error: 'A referenced record does not exist', code: 'INVALID_REFERENCE' },
  '23502': { status: 400, error: 'A required value is missing', code: 'VALIDATION_ERROR' },
  '23514': { status: 400, error: 'A value is outside the allowed range', code: 'VALIDATION_ERROR' },
  '22P02': { status: 400, error: 'A value has the wrong format', code: 'VALIDATION_ERROR' },
  '22001': { status: 400, error: 'A value is too long', code: 'VALIDATION_ERROR' },
  '22003': { status: 400, error: 'A number is out of range', code: 'VALIDATION_ERROR' }
};

/** Body-parser and upload failures, which arrive as tagged Errors, not HttpErrors. */
const REQUEST_ERROR_CODES = new Set([
  'LIMIT_FILE_SIZE',
  'LIMIT_FILE_COUNT',
  'LIMIT_UNEXPECTED_FILE',
  'UNSUPPORTED_FILE_TYPE',
  'entity.too.large',
  'entity.parse.failed'
]);

const GENERIC: Record<number, string> = {
  400: 'The request could not be processed',
  401: 'Please authenticate.',
  403: 'Not allowed',
  404: 'Not found',
  500: 'Internal server error'
};

export interface ErrorDescription {
  status: number;
  body: { error: string; code: string; details?: unknown };
  /** True when the cause is a bug rather than a rejected request; it gets logged. */
  unexpected: boolean;
}

function errorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object') {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/**
 * Decides what the client is told about a failure.
 *
 * `fallbackStatus` is used only for causes we do not recognise, so a handler
 * that used to answer 400 on a bad body keeps answering 400 — only the message
 * changes, from raw database text to something safe.
 */
export function describeError(error: unknown, fallbackStatus = 500): ErrorDescription {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        code: error.code,
        ...(error.details !== undefined ? { details: error.details } : {})
      },
      unexpected: false
    };
  }

  // A constraint the model states on purpose; its message is written for users.
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: { error: error.message, code: 'VALIDATION_ERROR' },
      unexpected: false
    };
  }

  const code = errorCode(error);

  const pg = code ? PG_ERRORS[code] : undefined;
  if (pg) {
    return { status: pg.status, body: { error: pg.error, code: pg.code }, unexpected: false };
  }

  if (code && REQUEST_ERROR_CODES.has(code)) {
    const message = error instanceof Error ? error.message : GENERIC[400];
    return { status: 400, body: { error: message, code }, unexpected: false };
  }

  // CORS rejection travels as a plain Error from the cors middleware.
  if (error instanceof Error && /CORS origin denied/i.test(error.message)) {
    return { status: 403, body: { error: error.message, code: 'CORS_DENIED' }, unexpected: false };
  }

  const status = fallbackStatus >= 400 && fallbackStatus < 600 ? fallbackStatus : 500;
  return {
    status,
    body: {
      error: GENERIC[status] ?? GENERIC[500],
      code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'
    },
    // Only a genuine 5xx is a bug worth a stack trace in the log; a 4xx that
    // reached here is a caller mistake we simply did not have a name for.
    unexpected: status >= 500
  };
}
