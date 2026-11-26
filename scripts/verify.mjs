// Local quality gate: `npm run verify` (fast, no services) or
// `npm run verify -- --build` (adds both builds, the size budgets and the
// built-panel address check). Runs every step even after a failure, prints a
// summary and exits 1 if any step failed. Same command on Windows and Linux.
//
// Steps that need running services live elsewhere:
//   backend integration   cd backend && npm run test:compose
//   database roles        cd backend && npm run test:db-roles
//   browser               cd e2e && npm run test:stack

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const withBuild = process.argv.includes('--build');
const results = [];

function run(name, cwd, command, args = []) {
  const started = Date.now();
  const child = spawnSync(command, args, {
    cwd: join(root, cwd),
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    shell: true,
    maxBuffer: 64 * 1024 * 1024
  });
  const output = `${child.stdout}${child.stderr}`;
  const ok = child.status === 0;
  results.push({ name, ok, note: `${((Date.now() - started) / 1000).toFixed(0)}s` });
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name}`);
  if (!ok) console.log(output.trim().split('\n').slice(-30).join('\n'));
  return output;
}

function check(name, problems) {
  results.push({ name, ok: problems.length === 0, note: `${problems.length} finding(s)` });
  console.log(`${problems.length ? 'FAIL' : 'pass'}  ${name}`);
  for (const line of problems.slice(0, 40)) console.log(`      ${line}`);
}

function lint(name, cwd) {
  const output = run(`${name} lint`, cwd, 'npx', ['eslint', '.', '-f', 'json']);
  try {
    const report = JSON.parse(output.slice(output.indexOf('[')));
    const errors = report.reduce((n, f) => n + f.errorCount, 0);
    const warnings = report.reduce((n, f) => n + f.warningCount, 0);
    results[results.length - 1].note += `, ${errors} errors, ${warnings} warnings`;
  } catch {
    /* the step already reported its failure */
  }
}

const tracked = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  .stdout.split('\n')
  .filter(Boolean);
const TEXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.yml',
  '.yaml',
  '.sh',
  '.md',
  '.html',
  '.css',
  '.php',
  '.liquid',
  '.sql',
  ''
]);
const readTracked = (file) => {
  const path = join(root, file);
  return existsSync(path) && TEXT.has(extname(file)) ? readFileSync(path, 'utf8') : '';
};

// The FAQ assistant (Gemini) is the only AI. The removed model server and its
// providers must not come back. Migrations, the generated schema and
// lockfiles are history or third-party text; this file and the old CI
// workflow name the patterns themselves.
const REMOVED_AI =
  /vllm|ollama|trendyol|openai|anthropic|AI_SERVICE_URL|LLM_(URL|MODEL)|order[_-]?lookup/i;
const AI_SKIP =
  /(^|\/)(migrations\/|schema\.sql$|package-lock\.json$)|^scripts\/verify\.mjs$|^\.github\/workflows\/|\.md$/;

// Credentials that must never be committed. Only the file, line and kind are
// printed, never the value. Documentation placeholders are not secrets.
const PLACEHOLDER = /change|example|placeholder|your[-_]|at[-_]least|replace|x{6}|<[^>]+>|\.\.\./i;
const SECRETS = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['GitHub token', /\bgh[pousr]_[0-9A-Za-z]{36,}\b/],
  ['Slack token', /\bxox[abpr]-[0-9A-Za-z-]{10,}\b/],
  ['Paddle live key', /\bpdl_live_[0-9A-Za-z_]{20,}\b/],
  ['Stripe live key', /\b[sr]k_live_[0-9A-Za-z]{20,}\b/],
  [
    'assigned secret',
    /^\s*(?:JWT_SECRET|[A-Z_]*(?:PASSWORD|SECRET|API_KEY|PRIVATE_KEY))\s*=\s*['"]?[A-Za-z0-9+/_-]{24,}/m
  ]
];

function scan(pattern, skip) {
  const hits = [];
  for (const file of tracked) {
    if (skip.test(file)) continue;
    readTracked(file)
      .split('\n')
      .forEach((line, i) => {
        if (pattern.test(line)) hits.push(`${file}:${i + 1}`);
      });
  }
  return hits;
}

function secretScan() {
  const hits = [];
  for (const file of tracked) {
    if (/package-lock\.json$|^scripts\/verify\.mjs$/.test(file)) continue;
    const lines = readTracked(file).split('\n');
    lines.forEach((line, i) => {
      for (const [kind, pattern] of SECRETS) {
        if (pattern.test(line) && !PLACEHOLDER.test(line)) hits.push(`${file}:${i + 1} (${kind})`);
      }
    });
  }
  return hits;
}

// A public IPv4 address written into the built panel would pin it to one
// server. Loopback, private ranges and 0.0.0.0 are allowed.
function builtPanelAddresses() {
  const dist = join(root, 'admin-panel', 'dist');
  if (!existsSync(dist)) return ['admin-panel/dist is missing: build the panel first'];
  const hits = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(js|html|css|json|webmanifest)$/.test(entry.name)) {
        for (const match of readFileSync(path, 'utf8').matchAll(
          /\/\/(\d{1,3}(?:\.\d{1,3}){3})\b/g
        )) {
          const [a, b] = match[1].split('.').map(Number);
          const local =
            a === 0 ||
            a === 10 ||
            a === 127 ||
            (a === 192 && b === 168) ||
            (a === 172 && b >= 16 && b <= 31);
          if (!local) hits.push(`${relative(root, path)}: ${match[1]}`);
        }
      }
    }
  };
  walk(dist);
  return hits;
}

// Server-side secrets from the local env files must not end up in what the
// browser downloads (the built panel and the widget). Only names are printed.
function builtSecrets() {
  const values = [];
  for (const file of ['.env', 'backend/.env']) {
    const path = join(root, file);
    if (!existsSync(path)) continue;
    for (const [, name, value] of readFileSync(path, 'utf8').matchAll(/^([A-Z0-9_]+)=(.+)$/gm)) {
      if (/SECRET|PASSWORD|PRIVATE|API_KEY|TOKEN/.test(name) && value.trim().length >= 12) {
        values.push([name, value.trim()]);
      }
    }
  }
  const hits = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(js|html|json|css|map)$/.test(entry.name)) {
        const text = readFileSync(path, 'utf8');
        for (const [name, value] of values) {
          if (text.includes(value)) hits.push(`${relative(root, path)} contains ${name}`);
        }
      }
    }
  };
  walk(join(root, 'admin-panel', 'dist'));
  walk(join(root, 'backend', 'public'));
  return hits;
}

run('backend typecheck', 'backend', 'npm', ['run', 'typecheck']);
lint('backend', 'backend');
run('backend format', 'backend', 'npm', ['run', 'format:check']);
run('backend schema matches migrations', 'backend', 'npm', ['run', 'db:schema', '--', '--check']);
run('backend production audit (high+)', 'backend', 'npm', [
  'audit',
  '--omit=dev',
  '--audit-level=high'
]);
run('panel typecheck', 'admin-panel', 'npm', ['run', 'typecheck']);
lint('panel', 'admin-panel');
run('panel format', 'admin-panel', 'npm', ['run', 'format:check']);
run('panel locales', 'admin-panel', 'npx', ['tsx', 'scripts/check-locales.ts']);
run('panel hard-coded text', 'admin-panel', 'npx', ['tsx', 'scripts/check-hardcoded-text.ts']);
run('panel production audit (high+)', 'admin-panel', 'npm', [
  'audit',
  '--omit=dev',
  '--audit-level=high'
]);
check('no removed AI component', scan(REMOVED_AI, AI_SKIP));
check('no committed secret', secretScan());

if (withBuild) {
  run('backend build', '.', 'npm', ['run', 'build:backend']);
  run('panel build', '.', 'npm', ['run', 'build:admin']);
  const sizes = run('size budgets', '.', 'node', ['scripts/check-bundle-size.mjs']);
  console.log(
    sizes
      .trim()
      .split('\n')
      .filter((l) => l.includes('|'))
      .join('\n')
  );
  check('no public IP in the built panel', builtPanelAddresses());
  check('no server secret in the built panel or widget', builtSecrets());
}

const failed = results.filter((r) => !r.ok);
console.log(
  '\n' + results.map((r) => `${r.ok ? 'pass' : 'FAIL'}  ${r.name}  (${r.note})`).join('\n')
);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);
