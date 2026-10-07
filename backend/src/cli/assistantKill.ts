// The assistant's emergency switch for every site at once (plan v10 AI-07).
// Every API process hears it within 15 seconds; no restart. Audited.
//   development:  npm run assistant:kill -- on | off | status
//   production:   docker compose ... exec backend npm run assistant:kill:prod -- on | off | status
// Loads .env before any module below reads it; see src/config/env.ts.
import '../config/env';
import { pool } from '../db/pool';
import { closeRedisClient } from '../config/redis';
import { assistantConfig } from '../config/assistant';
import { checkModel, refreshKillSwitch, setKillSwitch } from '../services/assistant/availability';

async function main() {
  const command = (process.argv[2] || '').trim();
  const operator = process.env.USER || process.env.USERNAME || null;
  if (command === 'on' || command === 'off') {
    await setKillSwitch(command === 'on', operator);
    console.log(
      command === 'on'
        ? 'Kill switch ON: the assistant answers nowhere; visitors write to people.'
        : 'Kill switch off: sites that switched the assistant on answer again.'
    );
    return;
  }
  if (command === 'status') {
    const config = assistantConfig();
    const killed = await refreshKillSwitch();
    console.log(`configured : ${config ? `yes (${config.model}, ${config.tier} tier)` : 'no'}`);
    console.log(`kill switch: ${killed ? 'ON' : 'off'}`);
    if (config) console.log(`model check: ${await checkModel()}`);
    return;
  }
  console.error('Usage: npm run assistant:kill -- on | off | status');
  process.exitCode = 1;
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
