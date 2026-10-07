// Deleting a whole workspace (plan (6) §22): what the owner's "delete
// account" means. Only the owner's own row used to be switched off, so the
// sites kept answering, and every visitor's name, e-mail, address and
// messages stayed in the database with nobody left to ask for them.
//
// One transaction removes the organization; the foreign keys take its sites,
// conversations, messages, visitors, FAQs, rules, invitations, usage and audit
// trail with it. The accounts that belonged to it are kept only as anonymous,
// disabled rows (a sender other rows may still name), and their open tokens
// are dropped. Uploaded files are removed from storage after the commit.
//
// A live subscription blocks it: it has to be cancelled in Paddle first, or
// Paddle would keep charging for a workspace that no longer exists.

import { query, withTransaction } from '../db/pool';
import { LIVE_STATUSES, isSubscriptionStatus } from '../domain/subscription';
import { HttpError } from '../http/errors';
import { deleteOrganizationFiles, deleteStoredFiles, storedKeyFromUrl } from '../middleware/upload';
import { logger } from '../config/logger';

export async function deleteOrganization(organizationId: string): Promise<{ files: number }> {
  const { rows: subscriptions } = await query<{ status: string }>(
    'SELECT status FROM subscriptions WHERE organization_id = $1',
    [organizationId]
  );
  if (subscriptions.some((s) => isSubscriptionStatus(s.status) && LIVE_STATUSES.has(s.status))) {
    throw new HttpError(
      409,
      'Cancel the subscription before deleting the workspace',
      'SUBSCRIPTION_ACTIVE'
    );
  }

  const keys = await withTransaction(async (client) => {
    const { rows: files } = await client.query<{ url: string | null }>(
      `SELECT m.file_data->>'url' AS url
         FROM messages m JOIN conversations c ON c.id = m.conversation_id
        WHERE c.organization_id = $1 AND m.file_data IS NOT NULL
       UNION ALL
       SELECT w.branding->>'logo' FROM widget_configs w WHERE w.organization_id = $1`,
      [organizationId]
    );

    // Accounts: no name, no address, no password, signed out everywhere.
    await client.query(
      `DELETE FROM auth_tokens
        WHERE account_id IN (SELECT id FROM users WHERE organization_id = $1
                             UNION SELECT id FROM teams WHERE organization_id = $1)`,
      [organizationId]
    );
    const anonymous = `email = 'deleted_' || id || '@deleted.invalid', name = 'Deleted User',
      password = '!', avatar = NULL, is_active = false, status = 'offline',
      email_verified_at = NULL, session_version = session_version + 1,
      totp_secret_enc = NULL, totp_enabled_at = NULL, totp_last_step = NULL,
      recovery_codes = '[]'::jsonb`;
    await client.query(`UPDATE users SET ${anonymous} WHERE organization_id = $1`, [
      organizationId
    ]);
    await client.query(
      `UPDATE teams SET ${anonymous}, phone = NULL, bio = NULL WHERE organization_id = $1`,
      [organizationId]
    );
    await client.query('DELETE FROM organizations WHERE id = $1', [organizationId]);
    return files.map((f) => storedKeyFromUrl(f.url));
  });

  // After the commit: a storage error must not bring the data back, so it is
  // logged and the deletion stands.
  let removed = 0;
  try {
    removed = await deleteStoredFiles(keys);
    // Private attachments live under the organization's own prefix; this
    // also catches files uploaded but never sent in a message.
    removed += await deleteOrganizationFiles(organizationId);
  } catch (error) {
    logger.error(
      { organizationId, error: error instanceof Error ? error.message : String(error) },
      'workspace deleted; removing its files failed'
    );
  }
  logger.info({ organizationId, files: removed }, 'workspace deleted');
  return { files: removed };
}
