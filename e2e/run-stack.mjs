// `npm run test:stack [-- <playwright args>]` — the browser suite against the
// Docker Compose stack named by the root .env (COMPOSE_PROJECT_NAME, ports).
//
// For the run only, the backend is recreated pointing at e2e/fake-gemini.mjs
// (and with a throw-away Web Push pair when the root .env has none), so the
// assistant and push specs run without real keys. Afterwards the fake model is stopped and the backend is
// recreated with its normal settings. Exits with Playwright's exit code.
//
// Point it at a stack whose data you do not mind: the suite creates tenants.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const FAKE_PORT = process.env.FAKE_GEMINI_PORT || '5199';

// A Web Push pair only when neither the environment nor the root .env has one.
const rootEnv = existsSync(join(root, '.env')) ? readFileSync(join(root, '.env'), 'utf8') : '';
const hasVapid = process.env.VAPID_PUBLIC_KEY || /^VAPID_PUBLIC_KEY=\S+/m.test(rootEnv);
const webPush = createRequire(join(root, 'backend', 'package.json'))('web-push');
const keys = hasVapid ? null : webPush.generateVAPIDKeys();
const runEnv = {
  ...process.env,
  ...(keys ? { VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey } : {}),
  GEMINI_API_KEY: 'test-key-not-a-real-one',
  GEMINI_BASE_URL: `http://host.docker.internal:${FAKE_PORT}/v1beta`
};

const compose = (env, extra = []) =>
  spawnSync(
    'docker',
    ['compose', 'up', '-d', '--wait', '--wait-timeout', '400', 'backend', ...extra],
    {
      cwd: root,
      env,
      stdio: 'inherit'
    }
  ).status;

const fake = spawn(process.execPath, [join(here, 'fake-gemini.mjs'), FAKE_PORT], {
  env: { ...process.env, FAKE_GEMINI_HOST: '0.0.0.0' },
  stdio: 'inherit'
});

let code = 1;
try {
  if (compose(runEnv) !== 0) throw new Error('the stack did not become healthy');
  const playwright = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['playwright', 'test', ...process.argv.slice(2)],
    {
      cwd: here,
      env: { ...process.env, E2E_FAKE_GEMINI: '1' },
      stdio: 'inherit',
      shell: process.platform === 'win32'
    }
  );
  code = playwright.status ?? 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
} finally {
  fake.kill();
  compose(process.env);
}
process.exit(code);
