'use strict';

// Operating the service (plan §11, §13.5):
//
//  - /health says only that the process is up; /ready that it can serve
//  - neither leaks anything about the server
//  - a production boot with an incomplete configuration lists every problem
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE } from './helpers/widget';
import { productionConfigProblems } from '../src/config/productionChecks';

test('/health and /ready answer with nothing but their status', async () => {
  const health = await fetch(`${BASE}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });

  const ready = await fetch(`${BASE}/ready`);
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: 'ready' });
  assert.equal(ready.headers.get('cache-control'), 'no-store');
});

/** Runs `fn` with `vars` set in process.env, restoring it afterwards. */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

const COMPLETE = {
  JWT_SECRET: 'k'.repeat(16) + 'Z9x!'.repeat(6),
  CORS_ORIGINS: 'https://app.example.com',
  DATABASE_URL: undefined,
  DB_PASSWORD: 'a-long-random-database-password',
  APP_BASE_URL: 'https://app.example.com',
  MAIL_PROVIDER: 'smtp',
  SMTP_HOST: 'smtp.example.com',
  MAIL_FROM: 'Support.io <no-reply@example.com>',
  BILLING_ENABLED: 'false',
  UPLOAD_STORAGE: undefined,
  S3_BUCKET: 'bucket',
  AWS_BUCKET_NAME: undefined,
  AWS_ACCESS_KEY_ID: 'id',
  AWS_SECRET_ACCESS_KEY: 'secret-key',
  AWS_REGION: 'eu-central-1',
  S3_ENDPOINT: undefined
};

test('a complete production configuration passes the boot check', () => {
  withEnv(COMPLETE, () => assert.deepEqual(productionConfigProblems(), []));
});

test('an incomplete one is refused with every problem listed', () => {
  withEnv(
    {
      ...COMPLETE,
      JWT_SECRET: 'replace-with-at-least-32-random-characters',
      DB_PASSWORD: 'replace-with-a-long-random-password',
      APP_BASE_URL: 'http://app.example.com',
      MAIL_PROVIDER: 'console',
      BILLING_ENABLED: 'true',
      PADDLE_API_KEY: undefined,
      S3_BUCKET: undefined
    },
    () => {
      const problems = productionConfigProblems().join('\n');
      for (const expected of [
        'JWT_SECRET',
        'DB_PASSWORD',
        'APP_BASE_URL',
        'MAIL_PROVIDER=console',
        'PADDLE_API_KEY',
        'S3_BUCKET'
      ]) {
        assert.match(problems, new RegExp(expected), `expected a problem about ${expected}`);
      }
    }
  );
});

test('R2 or Hetzner storage through S3_ENDPOINT counts as configured', () => {
  withEnv(
    { ...COMPLETE, AWS_REGION: undefined, S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com' },
    () => assert.deepEqual(productionConfigProblems(), [])
  );
});
