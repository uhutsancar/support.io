// The last middleware in the chain: turns anything thrown into a JSON answer.
//
// It must be registered after every route and after the static handlers.
// Registered before them, a failure inside a route or while serving a file
// never reaches it and falls through to Express' default handler, which
// renders an HTML page with the stack trace outside production.

import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import { describeError } from './errors';

/** Logs the cause once, with the request that produced it. */
function logUnexpected(req: Request, error: unknown): void {
  console.error(`[http] ${req.method} ${req.originalUrl}`, error);
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // A failure after the headers went out cannot be reported in the body;
  // Express' default handler closes the connection, which is the only thing
  // left to do.
  if (res.headersSent) return next(error);

  const { status, body, unexpected } = describeError(error);
  if (unexpected) logUnexpected(req, error);

  res.status(status).json(body);
};

/** Answers an unmatched /api path as JSON rather than the SPA shell. */
export const apiNotFound = (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'API endpoint not found', code: 'NOT_FOUND' });
};
