// Authentication for the public widget endpoints.
//
// These are called from a customer's own page, with no session: the only
// credential is the site key. The tenant guards that used to live here
// (`requireOrgId`, `callerOrgId`, `findOwnedSite`) moved to `src/http/guards.ts`
// with the rest of the request-scoped authorization, and are re-exported below
// so existing imports keep working.

import Site from '../models/Site';
import { plainString } from './sanitize';
import { unauthorized } from '../http/errors';
import { asyncMiddleware } from '../http/asyncHandler';
import type { NextFunction, Request, Response } from 'express';

/**
 * Resolves the site behind an `X-Site-Key` and pins it on the request.
 *
 * The key may arrive in the header, the query string or the body, but it has to
 * be plain text in all three: a value that arrives as an object (`{ $ne: … }`)
 * used to compile into a filter that matched an arbitrary site, letting an
 * anonymous caller act with some other tenant's identity. See
 * `middleware/sanitize.ts` for the other two layers of that defence.
 */
const verifySiteKey = asyncMiddleware(async (req: Request, _res: Response, next: NextFunction) => {
  const siteKey =
    plainString(req.header('X-Site-Key'), 128) ||
    plainString(req.query.siteKey, 128) ||
    plainString(req.body?.siteKey, 128);
  if (!siteKey) throw unauthorized('Site key required');

  const site = await Site.findOne({ siteKey, isActive: true });
  if (!site) throw unauthorized('Invalid site key');

  req.site = site;
  next();
});

export { verifySiteKey };
export { callerOrgId, findOwnedSite } from '../http/guards';
