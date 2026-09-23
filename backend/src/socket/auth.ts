// Who is on the other end of an admin socket.
//
// Every failure below answers with the same message. A handshake either
// authenticates or it does not; telling the caller which step failed would let
// them probe for valid account ids.

import Team from '../models/Team';
import User from '../models/User';
import Organization from '../models/Organization';
import { SESSION_COOKIE } from '../config/session';
import { isOriginAllowed } from '../config/origins';
import { verifySession } from '../config/tokens';
import type { Namespace, Socket } from 'socket.io';
import type { AdminSocket } from './types';

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
