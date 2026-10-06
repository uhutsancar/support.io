// Switches a site's widget off (or back on) by hand: abuse, a support case
// (plan (6) §46). A disabled site's widget gets no session; the panel and the
// conversation history stay.
//   development:  npm run site:disable -- <site key or id> [--enable]
//   production:   docker compose ... exec backend npm run site:disable:prod -- <site> [--enable]
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool, query } from '../db/pool';
import { generateId } from '../db/objectId';

async function disableSite() {
  const ref = (process.argv[2] || '').trim();
  const enable = process.argv.includes('--enable');
  if (!ref || ref.startsWith('--')) {
    console.error('Usage: npm run site:disable -- <site key or id> [--enable]');
    process.exitCode = 1;
    return;
  }

  const { rows } = await query<{ id: string; name: string; organization_id: string }>(
    `UPDATE sites SET is_active = $2, updated_at = now()
      WHERE id = $1 OR site_key = $1
      RETURNING id, name, organization_id`,
    [ref, enable]
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
        fields: ['isActive'],
        isActive: enable,
        source: 'script',
        operator: process.env.USER || process.env.USERNAME || null
      })
    ]
  );
  console.log(`Site "${site.name}" (${site.id}) ${enable ? 'enabled' : 'disabled'}`);
}

disableSite()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
