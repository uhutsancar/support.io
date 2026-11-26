// First-run setup for the Docker Compose stack: `node scripts/setup-env.mjs`.
//
// Writes the two env files a fresh clone needs and generates the local
// JWT_SECRET. A file that already exists is never rewritten; the script only
// says what it found. Same command in PowerShell, cmd and Bash.

import { createECDH, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// A Web Push (VAPID) pair in the format web-push generates: the P-256 public
// point and private scalar, base64url. Development keeps pushes in memory
// (PUSH_TRANSPORT=memory), so the pair never signs a real delivery.
const ecdh = createECDH('prime256v1');
ecdh.generateKeys();
const vapidPublic = ecdh.getPublicKey().toString('base64url');
const scalar = ecdh.getPrivateKey();
const vapidPrivate = Buffer.concat([Buffer.alloc(32 - scalar.length), scalar]).toString(
  'base64url'
);

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
      '',
      '# Local Web Push pair (development only).',
      `VAPID_PUBLIC_KEY=${vapidPublic}`,
      `VAPID_PRIVATE_KEY=${vapidPrivate}`,
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
