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
import { productionConfigProblems, productionConfigWarnings } from '../src/config/productionChecks';

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
  REDIS_URL: 'redis://:0123456789abcdef0123456789abcdef@redis:6379',
  REDIS_PASSWORD: '0123456789abcdef0123456789abcdef',
  ALLOW_LOCAL_UPLOADS: undefined,
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

const problemText = () => productionConfigProblems().join('\n');

test('Redis needs a real password, and the URL must carry it', () => {
  withEnv({ ...COMPLETE, REDIS_PASSWORD: 'short', REDIS_URL: 'redis://:short@redis:6379' }, () =>
    assert.match(problemText(), /REDIS_PASSWORD/)
  );
  withEnv({ ...COMPLETE, REDIS_URL: 'redis://redis:6379' }, () =>
    assert.match(problemText(), /REDIS_URL must carry the password/)
  );
});

test('local uploads are refused unless asked for explicitly', () => {
  withEnv({ ...COMPLETE, UPLOAD_STORAGE: 'local' }, () =>
    assert.match(problemText(), /UPLOAD_STORAGE=local/)
  );
  withEnv({ ...COMPLETE, UPLOAD_STORAGE: 'local', ALLOW_LOCAL_UPLOADS: 'true' }, () =>
    assert.deepEqual(productionConfigProblems(), [])
  );
});

test('R2 or Hetzner storage through S3_ENDPOINT counts as configured', () => {
  withEnv(
    { ...COMPLETE, AWS_REGION: undefined, S3_ENDPOINT: 'https://acc.r2.cloudflarestorage.com' },
    () => assert.deepEqual(productionConfigProblems(), [])
  );
});

test('appendix C: what production can run without is warned about, never fatal', () => {
  const quiet = {
    ...COMPLETE,
    TURNSTILE_SITE_KEY: 'site',
    TURNSTILE_SECRET: 'secret',
    SENTRY_DSN: 'https://key@o1.ingest.de.sentry.io/1',
    ALERT_WEBHOOK_URL: 'https://hooks.example.com/x',
    BACKUP_REMOTE: 'r2:backups',
    BACKUP_AGE_RECIPIENT: 'age1example',
    BACKUP_PING_URL: 'https://hc-ping.com/x',
    SECURITY_CONTACT_EMAIL: 'security@example.com',
    OPS_REPORT_EMAIL: 'ops@example.com',
    GEMINI_API_KEY: 'test-key-not-a-real-one',
    GEMINI_TIER: 'paid',
    S3_ACL: undefined,
    MAIL_ALLOWLIST_DOMAINS: undefined,
    SITE_NOINDEX: 'false'
  };
  withEnv(quiet, () => assert.deepEqual(productionConfigWarnings(), []));
  withEnv(
    {
      ...quiet,
      SENTRY_DSN: undefined,
      BACKUP_PING_URL: undefined,
      GEMINI_TIER: 'free',
      S3_ACL: 'public-read',
      MAIL_ALLOWLIST_DOMAINS: 'example.com',
      SITE_NOINDEX: 'true'
    },
    () => {
      const text = productionConfigWarnings().join('\n');
      for (const name of [
        'SENTRY_DSN',
        'BACKUP_PING_URL',
        'GEMINI_TIER',
        'S3_ACL',
        'MAIL_ALLOWLIST_DOMAINS',
        'SITE_NOINDEX'
      ]) {
        assert.match(text, new RegExp(name), name);
      }
      assert.deepEqual(productionConfigProblems(), [], 'warnings do not stop the boot');
    }
  );
});
