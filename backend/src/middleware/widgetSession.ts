// Authentication for the public widget endpoints.
//
// These are called from a customer's page with no account behind them. The
// credential is the signed widget session the page obtained from
// POST /api/widget/session (config/tokens.ts): it names the site and the
// visitor, and nothing the request body says can change either. On top of the
// token, a browser request must come from one of the site's allowed origins
// (config/siteOrigins.ts), so a token lifted from one site's localStorage is
// useless on another site's page.

import Site from '../models/Site';
import { verifyWidgetSession, siteKeyMatches } from '../config/tokens';
import { requestOrigin, siteAcceptsOrigin } from '../config/siteOrigins';
import { HttpError, forbidden } from '../http/errors';
import { isBlocked, VISITOR_BLOCKED } from '../services/visitorBlocks';
import { asyncMiddleware } from '../http/asyncHandler';
import type { Doc } from '../db/model';
import type { SiteDoc } from '../models/Site';
import type { VerifiedWidgetSession } from '../config/tokens';
import type { NextFunction, Request, Response } from 'express';

/** The code the widget reacts to by fetching a fresh session and retrying. */
export const WIDGET_SESSION_INVALID = 'WIDGET_SESSION_INVALID';
export const ORIGIN_NOT_ALLOWED = 'ORIGIN_NOT_ALLOWED';

export const sessionInvalid = (): HttpError =>
  new HttpError(401, 'Widget session missing, expired or invalid', WIDGET_SESSION_INVALID);

export const originRefused = (): HttpError =>
  forbidden('This page is not an allowed origin for the site', ORIGIN_NOT_ALLOWED);

/** The bearer token on a request, if any. */
export function bearerToken(req: Request): string | null {
  const match = /^Bearer\s+(.+)$/i.exec((req.header('Authorization') || '').trim());
  return match ? match[1].trim() : null;
}

/**
 * The site a widget session belongs to, if the session still holds: the site
 * exists, is active, and its key has not been regenerated since the session
 * was issued. Shared by the HTTP middleware and the socket handshake.
 */
export async function siteForWidgetSession(
  claims: VerifiedWidgetSession
): Promise<Doc<SiteDoc> | null> {
  const site = await Site.findOne({ _id: claims.siteId, isActive: true });
  if (!site || !siteKeyMatches(site.siteKey, claims.kv)) return null;
  return site;
}

/**
 * Requires a valid widget session and, for a browser request, an allowed
 * origin. Pins `req.site` and `req.widget`.
 */
export const requireWidgetSession = asyncMiddleware(
  async (req: Request, _res: Response, next: NextFunction) => {
    const token = bearerToken(req);
    if (!token) throw sessionInvalid();

    let claims: VerifiedWidgetSession;
    try {
      claims = verifyWidgetSession(token);
    } catch {
      throw sessionInvalid();
    }

    const site = await siteForWidgetSession(claims);
    if (!site) throw sessionInvalid();

    // A request without any origin information is not from a browser page,
    // where this check means something; the token alone decides then.
    const origin = requestOrigin(req.headers);
    if (origin !== null && !siteAcceptsOrigin(site, origin)) throw originRefused();

    // Blocked since the session was issued (SEC-09): no upload, no form.
    if (await isBlocked({ siteId: String(site._id), visitorId: claims.visitorId, ip: req.ip })) {
      throw forbidden('This visitor is blocked on the site', VISITOR_BLOCKED);
    }

    req.site = site;
    req.widget = claims;
    next();
  }
);
