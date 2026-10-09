// Blocks a site's widget for abuse — phishing, fraud, spam (plan v10 LEG-05)
// — or lifts the block. A blocked site's widget gets no session and a page
// left open can send nothing more; the owner can read the history and delete
// the site but cannot switch it back on: only this command does
// (sites.blocked_at, migration 0016). The reason stays in the support trail
// and is never shown to the owner.
//   development:  npm run site:disable -- <site key or id> --reason "phishing" [--enable]
//   production:   docker compose ... exec backend node dist/cli/disableSite.js <site> --reason "…" [--enable]
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool, query } from '../db/pool';
import { generateId } from '../db/objectId';

function option(name: string): string | null {
  const index = process.argv.indexOf(name);
  const value = index > 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith('--') ? value.trim() : null;
}

async function disableSite() {
  const ref = (process.argv[2] || '').trim();
  const enable = process.argv.includes('--enable');
  const reason = option('--reason');
  if (!ref || ref.startsWith('--') || (!enable && !reason)) {
    console.error(
      'Usage: npm run site:disable -- <site key or id> --reason "why"   (block)\n' +
        '       npm run site:disable -- <site key or id> --enable          (lift the block)'
    );
    process.exitCode = 1;
    return;
  }

  const { rows } = await query<{ id: string; name: string; organization_id: string }>(
    enable
      ? `UPDATE sites SET blocked_at = NULL, blocked_reason = NULL, updated_at = now()
          WHERE id = $1 OR site_key = $1
          RETURNING id, name, organization_id`
      : `UPDATE sites SET blocked_at = now(), blocked_reason = $2, updated_at = now()
          WHERE id = $1 OR site_key = $1
          RETURNING id, name, organization_id`,
    enable ? [ref] : [ref, reason]
  );
  const site = rows[0];
  if (!site) {
    console.error(`Site not found: ${ref}`);
    process.exitCode = 1;
    return;
  }
  // The same row the panel writes when a site changes, marked as a script.
  await query(
    `INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, NULL, 'SITE_UPDATED', 'site', $3, $4)`,
    [
      generateId(),
      site.organization_id,
      site.id,
      JSON.stringify({
        fields: ['blocked'],
        blocked: !enable,
        reason: enable ? null : reason,
        source: 'script',
        operator: process.env.USER || process.env.USERNAME || null
      })
    ]
  );
  console.log(`Site "${site.name}" (${site.id}) ${enable ? 'unblocked' : 'blocked'}`);
  if (!enable) {
    console.log(
      'Visitors with the chat open are refused from their next message; new page loads get no widget.'
    );
  }
}

disableSite()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
