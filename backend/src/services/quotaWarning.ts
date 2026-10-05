// The "80% of this month's conversations" mail to an organization's owner.
//
// Sent from the conversation that crosses the line, which happens exactly
// once a month per organization (services/entitlements.ts#crossesWarning),
// so no bookkeeping is needed to keep it to one mail. Never awaited by the
// visitor's request and never throws into it.

import { query } from '../db/pool';
import { appBaseUrl, mail } from './mail';

export async function warnQuota(
  organizationId: string,
  used: number,
  limit: number
): Promise<void> {
  try {
    const { rows } = await query<{ name: string; email: string }>(
      `SELECT o.name, u.email
         FROM organizations o JOIN users u ON u.id = o.owner_user_id
        WHERE o.id = $1 AND u.is_active`,
      [organizationId]
    );
    if (!rows[0]) return;
    await mail.sendQuotaWarning(rows[0].email, {
      organization: rows[0].name,
      used,
      limit,
      link: `${appBaseUrl()}/dashboard/billing`
    });
  } catch (error) {
    console.error(
      '[quota] could not send the warning',
      error instanceof Error ? error.message : error
    );
  }
}
