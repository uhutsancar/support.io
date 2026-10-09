'use strict';

// docker-compose.prod.yml lists the backend's environment one variable at a
// time, so a setting written in .env.production reaches the server only if
// the compose file names it. TURNSTILE_*, SITE_NOINDEX and
// MAIL_ALLOWLIST_DOMAINS were documented in .env.production.example and read
// by the backend, but never passed: the sign-up bot check could not be
// switched on, and staging could not hide from search engines. This test
// keeps the three files in step.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(__dirname, '..', '..');

function backendReads(): Set<string> {
  const names = new Set<string>();
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.ts$/.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        for (const m of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) names.add(m[1]);
        for (const m of text.matchAll(/process\.env\[['"]([A-Z][A-Z0-9_]+)['"]\]/g)) {
          names.add(m[1]);
        }
      }
    }
  };
  walk(path.join(ROOT, 'backend', 'src'));
  return names;
}

function exampleNames(): Set<string> {
  const text = fs.readFileSync(path.join(ROOT, '.env.production.example'), 'utf8');
  return new Set([...text.matchAll(/^#?\s?([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
}

function composeBackendEnv(): Set<string> {
  const text = fs.readFileSync(path.join(ROOT, 'docker-compose.prod.yml'), 'utf8');
  const start = text.indexOf('\n  backend:');
  assert.ok(start >= 0, 'the backend service is in the compose file');
  const end = text.indexOf('\n  proxy:', start);
  const block = text.slice(start, end < 0 ? undefined : end);
  return new Set([...block.matchAll(/^ {6}([A-Z][A-Z0-9_]+):/gm)].map((m) => m[1]));
}

test('every documented setting the backend reads reaches the backend container', () => {
  const reads = backendReads();
  const passed = composeBackendEnv();
  const missing = [...exampleNames()].filter((name) => reads.has(name) && !passed.has(name));
  assert.deepEqual(missing, [], 'add these to the backend environment in docker-compose.prod.yml');
});

test('the guard itself sees the files', () => {
  assert.ok(backendReads().has('JWT_SECRET'));
  assert.ok(exampleNames().has('JWT_SECRET'));
  assert.ok(composeBackendEnv().has('JWT_SECRET'));
});
