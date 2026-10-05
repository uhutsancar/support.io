// Who is on the other end of a socket: an agent on /admin, a visitor's widget
// on /widget.
//
// Every failure below answers with the same message per namespace. A
// handshake either authenticates or it does not; telling the caller which step
// failed would let them probe for valid account ids or site keys.

import Team from '../models/Team';
import User from '../models/User';
import Organization from '../models/Organization';
import { SESSION_COOKIE } from '../config/session';
import { isOriginAllowed } from '../config/origins';
import { sessionIsCurrent, verifySession, verifyWidgetSession } from '../config/tokens';
import { requestOrigin, siteAcceptsOrigin } from '../config/siteOrigins';
import { siteForWidgetSession, WIDGET_SESSION_INVALID } from '../middleware/widgetSession';
import type { Namespace, Socket } from 'socket.io';
import type { AdminSocket, WidgetSocket } from './types';

const AUTH_FAILED = 'Authentication required';

/**
 * Reads the session cookie out of a raw Cookie header.
 *
 * Express' cookie-parser does not run for a socket handshake, so the header
 * arrives unparsed.
 */
function sessionCookie(header: string | undefined): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/**
 * Authenticates the admin namespace.
 *
 * The session travels in an httpOnly cookie the browser attaches by itself.
 * That is also the weakness: the browser attaches it no matter which page
 * opened the socket, so a cookie-authenticated handshake must additionally come
 * from an allowed origin, or any site could open an authenticated socket on a
 * visitor's behalf (Cross-Site WebSocket Hijacking).
 *
 * The `handshake.auth.token` path exists for non-browser clients — tests,
 * server-to-server. Nothing attaches that automatically, so it is exempt from
 * the origin check.
 */
export function installAdminAuthentication(admin: Namespace): void {
  admin.use(async (rawSocket: Socket, next) => {
    const socket = rawSocket as AdminSocket;
    try {
      const cookieToken = sessionCookie(socket.handshake.headers?.cookie);
      const explicitToken = socket.handshake.auth?.token;

      if (!explicitToken && cookieToken && !isOriginAllowed(socket.handshake.headers?.origin)) {
        return next(new Error(AUTH_FAILED));
      }

      const raw = explicitToken || cookieToken || socket.handshake.headers?.authorization;
      const token = String(raw || '').replace(/^Bearer\s+/i, '');
      if (!token) return next(new Error(AUTH_FAILED));

      const decoded = verifySession(token);
      const Account = decoded.userType === 'team' ? Team : User;
      const account = await Account.findOne({ _id: decoded.userId, isActive: true });
      if (!account?.organizationId) return next(new Error(AUTH_FAILED));
      if (!sessionIsCurrent(decoded, account)) return next(new Error(AUTH_FAILED));

      // The organization comes from the database, not the token: an account
      // removed from a company would otherwise keep its access until the token
      // expired.
      if (
        decoded.organizationId &&
        String(decoded.organizationId) !== String(account.organizationId)
      ) {
        return next(new Error(AUTH_FAILED));
      }

      const organization = await Organization.findOne({
        _id: account.organizationId,
        isActive: true
      });
      if (!organization) return next(new Error(AUTH_FAILED));

      socket.userId = String(account._id);
      socket.userName = account.name || 'Support';
      socket.organizationId = String(account.organizationId);
      socket.role = account.role;
      socket.userType = decoded.userType === 'team' ? 'team' : 'user';
      // Empty means "every site"; see SocketContext.siteFor.
      socket.allowedSiteIds = new Set((account.assignedSites || []).map(String));

      next();
    } catch {
      next(new Error(AUTH_FAILED));
    }
  });
}

/**
 * Authenticates the widget namespace.
 *
 * The handshake carries the widget session the page obtained from
 * POST /api/widget/session (`auth: { token }`). The site, its organization and
 * the visitor are read from that signature and pinned on the socket before any
 * event runs; nothing an event payload says can change them. A browser
 * handshake must also come from one of the site's allowed origins, so a token
 * lifted from one site cannot be replayed from another site's page.
 *
 * The refusal is always the same code, which the widget answers by fetching a
 * fresh session and reconnecting.
 */
export function installWidgetAuthentication(widget: Namespace): void {
  widget.use(async (rawSocket: Socket, next) => {
    const socket = rawSocket as WidgetSocket;
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) return next(new Error(WIDGET_SESSION_INVALID));

      const claims = verifyWidgetSession(token);
      const site = await siteForWidgetSession(claims);
      if (!site) return next(new Error(WIDGET_SESSION_INVALID));

      const origin = requestOrigin(socket.handshake.headers as Record<string, unknown>);
      if (origin !== null && !siteAcceptsOrigin(site, origin)) {
        return next(new Error(WIDGET_SESSION_INVALID));
      }

      socket.siteId = String(site._id);
      socket.organizationId = String(site.organizationId);
      socket.visitorId = claims.visitorId;
      socket.widgetSessionId = claims.sid;
      // Defaults until the widget joins and says who the visitor is.
      socket.visitorName = 'Visitor';
      socket.visitorEmail = null;
      socket.currentPage = '/';
      next();
    } catch {
      next(new Error(WIDGET_SESSION_INVALID));
    }
  });
}
