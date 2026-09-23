// Lets a route handler be an ordinary async function.
//
// Express 4 does not await a handler, so a rejected promise inside one is an
// unhandled rejection: the request hangs until it times out and the error never
// reaches the error middleware. That is why every handler in this codebase was
// wrapped in `try { ... } catch (error) { sendError(res, error); }` — 58 copies
// of the same six lines, and the one place the pattern was forgotten is the one
// place a failure disappeared.
//
// Wrapping once here removes the boilerplate and makes the behaviour uniform:
// a handler returns a response or throws, and `errorHandler` decides what the
// client sees. This is the same shape `routes/ai.ts` already used for its own
// handlers; it is now available to every route.

import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown> | unknown;

export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (req, res, next) => {
    // `Promise.resolve` also covers a synchronous throw, so a handler that is
    // not actually async is wrapped just as safely.
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
}

/** The same wrapper for a middleware, which reads more clearly at the call site. */
export const asyncMiddleware = asyncHandler;
