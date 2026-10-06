// Lists organizations for support and the closed beta (plan (6) §46).
//   development:  npm run org:list -- [text in the name or the owner's e-mail]
//   production:   docker compose ... exec backend npm run org:list:prod -- [text]
// Read only. Prints no visitor data, only what an operator needs to find a
// workspace: plan, subscription, owner, sites and this month's usage.
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool, query } from '../db/pool';

async function listOrganizations() {
  const filter = (process.argv[2] || '').trim().toLowerCase();
  const { rows } = await query<{
    id: string;
    name: string;
    plan_type: string;
    subscription: string | null;
    owner: string | null;
    sites: number;
    conversations: number;
    created_at: Date;
  }>(
    `SELECT o.id, o.name, o.plan_type,
            s.plan_type || ' ' || s.status AS subscription,
            (SELECT u.email FROM users u
              WHERE u.organization_id = o.id AND u.role = 'owner'
              ORDER BY u.created_at LIMIT 1) AS owner,
            (SELECT count(*)::int FROM sites WHERE organization_id = o.id) AS sites,
            coalesce((SELECT conversations FROM organization_usage_monthly
                       WHERE organization_id = o.id AND period = to_char(now(), 'YYYY-MM')), 0) AS conversations,
            o.created_at
       FROM organizations o
       LEFT JOIN subscriptions s ON s.organization_id = o.id
      WHERE $1 = '' OR lower(o.name) LIKE '%' || $1 || '%'
         OR EXISTS (SELECT 1 FROM users u WHERE u.organization_id = o.id
                     AND lower(u.email) LIKE '%' || $1 || '%')
      ORDER BY o.created_at DESC
      LIMIT 200`,
    [filter]
  );
  if (!rows.length) {
    console.log('No organization matches.');
    return;
  }
  console.table(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      plan: r.plan_type,
      subscription: r.subscription ?? '-',
      owner: r.owner ?? '-',
      sites: r.sites,
      'conversations this month': r.conversations,
      created: new Date(r.created_at).toISOString().slice(0, 10)
    }))
  );
}

listOrganizations()
  .catch((err) => {
    console.error('Error:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
