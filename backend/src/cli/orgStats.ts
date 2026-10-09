// The product's numbers (plan v10 OBS-07): workspaces, live widgets,
// sign-ups and activation, paying customers and an estimated MRR, and how
// much the assistant resolves. Aggregates only.
//   development:  npm run org:stats -- [days, default 7] [--json]
//   production:   docker compose ... exec backend node dist/cli/orgStats.js [days] [--json]
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool } from '../db/pool';
import { closeRedisClient } from '../config/redis';
import { productStats, statsText } from '../services/productStats';

async function main() {
  const days = Math.min(Math.max(Number(process.argv[2]) || 7, 1), 365);
  const stats = await productStats(days);
  console.log(process.argv.includes('--json') ? JSON.stringify(stats, null, 2) : statsText(stats));
}

main()
  .catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedisClient();
    await pool.end();
  });
