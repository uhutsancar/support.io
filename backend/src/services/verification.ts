// What an unverified account may not do yet.
//
// Signing up gives a working panel at once. Two things wait for a verified
// e-mail address: the widget going live on a customer's site, and
// paying. Both read the organization owner's address, because that is the
// account the organization — and its bills — belong to.

import { query } from '../db/pool';

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
