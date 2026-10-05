// What an unverified account may not do yet.
//
// Signing up gives a working panel at once. Two things wait for a verified
// e-mail address (plan §7.2): the widget going live on a customer's site, and
// paying. Both read the organization owner's address, because that is the
// account the organization — and its bills — belong to.

import { query } from '../db/pool';
import { forbidden } from '../http/errors';
import type { NextFunction, Request, Response } from 'express';

/** Whether the organization's owner has verified their e-mail address. */
export async function organizationVerified(organizationId: unknown): Promise<boolean> {
  if (!organizationId) return false;
  const { rows } = await query<{ verified: boolean }>(
    `SELECT u.email_verified_at IS NOT NULL AS verified
       FROM organizations o
       JOIN users u ON u.id = o.owner_user_id
      WHERE o.id = $1`,
    [String(organizationId)]
  );
  return Boolean(rows[0]?.verified);
}

export const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/** Route guard: the signed-in account has verified its address. */
export function requireVerifiedEmail(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user?.emailVerifiedAt) {
    throw forbidden('Verify your e-mail address first', EMAIL_NOT_VERIFIED);
  }
  next();
}
