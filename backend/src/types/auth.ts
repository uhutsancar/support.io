/** Which table the authenticated principal lives in. */
import type { Doc } from '../db/model';
import type { OrganizationDoc } from '../models/Organization';
import type { TeamDoc } from '../models/Team';
import type { UserDoc } from '../models/User';

export type UserType = 'user' | 'team';

/** The claims the API signs into its access tokens. */
export interface AuthTokenPayload {
  userId: string;
  userType?: UserType;
  organizationId?: string | null;
  /** The account's session_version when this session was issued. */
  sv?: number;
  iat?: number;
  exp?: number;
  [claim: string]: unknown;
}

/** An owner/admin account or a team agent; both can sign in. */
export type AuthenticatedUser = Doc<UserDoc> | Doc<TeamDoc>;

export type AuthenticatedOrganization = Doc<OrganizationDoc>;
