// What the auth middleware attaches to a request.
//
// These are declared non-optional even though they are only present after
// `auth` (or `verifySiteKey`) has run: every route that reads them is mounted
// behind that middleware, and making them optional would mean a non-null
// assertion on essentially every handler in the codebase without catching a
// single real mistake. A route that is genuinely public simply never reads them.
import type { RateLimitInfo } from 'express-rate-limit';
import type { Doc } from '../db/model';
import type { SiteDoc } from '../models/Site';
import type { AuthTokenPayload, AuthenticatedOrganization, AuthenticatedUser, UserType } from './auth';

declare global {
  namespace Express {
    interface Request {
      /** The signed-in account. Set by `auth`. */
      user: AuthenticatedUser;
      /** Which table `user` came from. Set by `auth`. */
      userType: UserType;
      /** Convenience copy of `user._id`. Set by `auth`. */
      userId: string;
      /** The tenant, or null for an account that has no organization yet. */
      organization: AuthenticatedOrganization | null;
      /** The raw bearer token. Set by `auth`. */
      token: string;
      /** The verified claims. Set by `auth`. */
      tokenPayload: AuthTokenPayload;
      /** The site behind an X-Site-Key. Set by `verifySiteKey`. */
      site: Doc<SiteDoc>;
      /** Set by express-rate-limit, but only on a route it guards. */
      rateLimit?: RateLimitInfo;
    }
  }
}

export {};
