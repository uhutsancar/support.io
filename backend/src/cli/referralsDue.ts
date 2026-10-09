// The referral months still to give (plan v10 PRD-23).
//   development:  npm run referrals:due
//                 npm run referrals:due -- --given <referral id> "<what it was given with>"
//   production:   docker compose ... exec backend npm run referrals:due:prod [-- --given …]
// With PADDLE_REFERRAL_DISCOUNT_ID set, the hourly sweep gives them by itself
// once the referrer has a live subscription; this lists what waits, and lets
// the owner record a month given by hand (in Paddle's dashboard).
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool, query } from '../db/pool';

async function main() {
  const [flag, id, reference] = process.argv.slice(2);
  if (flag === '--given') {
    if (!id || !reference) throw new Error('usage: --given <referral id> "<reference>"');
    const { rowCount } = await query(
      `UPDATE referrals SET rewarded_at = now(), reward_reference = $2
        WHERE id = $1 AND qualified_at IS NOT NULL AND rewarded_at IS NULL`,
      [id, `manual: ${reference}`.slice(0, 200)]
    );
    console.log(
      rowCount
        ? `Recorded: ${id}`
        : `Nothing to record for ${id} (unknown, not qualified, or given already)`
    );
    return;
  }
  const { rows } = await query<{
    id: string;
    referrer: string;
    owner: string | null;
    subscription: string | null;
    referred: string;
    qualified_at: Date;
  }>(
    `SELECT r.id, o.name AS referrer,
            (SELECT u.email FROM users u WHERE u.id = o.owner_user_id) AS owner,
            s.plan_type || ' ' || s.status || ' ' || coalesce(s.provider_subscription_id, '') AS subscription,
            ro.name AS referred, r.qualified_at
       FROM referrals r
       JOIN organizations o ON o.id = r.referrer_organization_id
       JOIN organizations ro ON ro.id = r.referred_organization_id
       LEFT JOIN subscriptions s ON s.organization_id = r.referrer_organization_id
      WHERE r.qualified_at IS NOT NULL AND r.rewarded_at IS NULL
      ORDER BY r.qualified_at`
  );
  if (!rows.length) {
    console.log('No referral month waits to be given.');
    return;
  }
  console.table(
    rows.map((r) => ({
      referral: r.id,
      referrer: r.referrer,
      owner: r.owner ?? '—',
      subscription: r.subscription ?? 'none (waits until they subscribe)',
      referred: r.referred,
      qualified: r.qualified_at.toISOString().slice(0, 10)
    }))
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
