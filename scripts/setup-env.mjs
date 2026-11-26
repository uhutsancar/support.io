// First-run setup for the Docker Compose stack: `node scripts/setup-env.mjs`.
//
// Writes the two env files a fresh clone needs and generates the local
// JWT_SECRET. A file that already exists is never rewritten; the script only
// says what it found. Same command in PowerShell, cmd and Bash.

import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const files = [
  {
    path: join(root, '.env'),
    label: '.env',
    body: [
      '# Read by docker compose. Change a port here when it is taken on this',
      '# machine; COMPOSE_PROJECT_NAME keeps a second copy apart from the first.',
      '# COMPOSE_PROJECT_NAME=supportio',
      'PROXY_PORT=80',
      'ADMIN_PORT=5173',
      'BACKEND_PORT=5000',
      'POSTGRES_PORT=5432',
      'REDIS_PORT=6381',
      ''
    ]
  },
  {
    path: join(root, 'backend', '.env'),
    label: 'backend/.env',
    required: ['JWT_SECRET'],
    body: [
      '# Read by the backend (dotenv). Docker Compose supplies the database,',
      '# Redis, mail and upload settings; values here fill in the rest.',
      'NODE_ENV=development',
      `JWT_SECRET=${randomBytes(48).toString('hex')}`,
      '',
      '# Optional providers. Leave empty to keep them off.',
      '# GEMINI_API_KEY=',
      ''
    ]
  }
];

for (const file of files) {
  if (!existsSync(file.path)) {
    writeFileSync(file.path, file.body.join('\n'), { flag: 'wx' });
    console.log(`created ${file.label}`);
    continue;
  }
  const text = readFileSync(file.path, 'utf8');
  const missing = (file.required || []).filter(
    (name) => !new RegExp(`^${name}=\\S+`, 'm').test(text)
  );
  console.log(
    missing.length
      ? `kept ${file.label} (exists) — add ${missing.join(', ')} to it yourself`
      : `kept ${file.label} (exists)`
  );
}
