// Re-seals stored secrets under the new JWT_SECRET (plan v10 SEC-18).
// Run it after deploying with JWT_SECRET = the new value and
// JWT_SECRET_PREVIOUS = the old one; docs/production-runbook.md §8.
//   development:  npm run secrets:rotate -- [--dry-run]
//   production:   docker compose ... exec backend npm run secrets:rotate:prod -- [--dry-run]
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool } from '../db/pool';
import { previousJwtSecret } from '../config/jwt';
import { rotateSealedSecrets } from '../services/secretRotation';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (!previousJwtSecret()) {
    console.error(
      'JWT_SECRET_PREVIOUS is not set (or equals JWT_SECRET). Set it to the old secret and ' +
        'JWT_SECRET to the new one, deploy, then run this again.'
    );
    process.exitCode = 1;
    return;
  }
  const report = await rotateSealedSecrets({ dryRun });
  console.log(`${dryRun ? '[dry run] ' : ''}sealed secrets:`);
  console.log(`  re-sealed under the new key : ${report.resealed}`);
  console.log(`  already under the new key   : ${report.current}`);
  console.log(`  opened by neither key       : ${report.unreadable} (left as they are)`);
  console.log(
    `accounts with recovery codes from the old key: ${report.oldRecoveryCodes}` +
      (report.oldRecoveryCodes
        ? ' — they work until JWT_SECRET_PREVIOUS is emptied; ask these users to create new ones'
        : '')
  );
}

main()
  .catch((err) => {
    console.error('Error:', err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
