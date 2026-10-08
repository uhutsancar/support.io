'use strict';

// Visitor counts on the public pages (plan v10 MKT-04, KARAR-MKT-3): off by
// default; when both variables are valid the public pages carry the script
// with tracking left to the panel, and the policy allows that one origin.

import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { Request, Response } from 'express';
import { siteAnalytics } from '../src/services/siteAnalytics';
import { seoHead } from '../src/services/seoHead';
import { contentSecurityPolicy } from '../src/middleware/csp';

const ID = '4f1c2a9e-5b7d-4c3e-9a1f-2b6d8e0c7a35';
const PAGES = path.join(__dirname, '../../admin-panel/dist/public-pages.json');

afterEach(() => {
  delete process.env.ANALYTICS_SCRIPT_URL;
  delete process.env.ANALYTICS_WEBSITE_ID;
});

function policyFor(pathname: string): string {
  const headers: Record<string, string> = {};
  const res = {
    locals: {},
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    }
  } as unknown as Response;
  contentSecurityPolicy({ isProduction: true })({ path: pathname } as Request, res, () => {});
  return headers['Content-Security-Policy'] || '';
}

test('off unless both settings are there and well formed', () => {
  assert.equal(siteAnalytics(), null);
  process.env.ANALYTICS_SCRIPT_URL = 'https://stats.example.com/script.js';
  assert.equal(siteAnalytics(), null, 'no website id');
  process.env.ANALYTICS_WEBSITE_ID = 'not-a-uuid';
  assert.equal(siteAnalytics(), null, 'a bad id');
  process.env.ANALYTICS_WEBSITE_ID = ID;
  process.env.ANALYTICS_SCRIPT_URL = 'http://stats.example.com/script.js';
  assert.equal(siteAnalytics(), null, 'plain http off localhost');
  process.env.ANALYTICS_SCRIPT_URL = 'javascript:alert(1)';
  assert.equal(siteAnalytics(), null);
  process.env.ANALYTICS_SCRIPT_URL = 'https://stats.example.com/script.js';
  assert.deepEqual(siteAnalytics(), {
    origin: 'https://stats.example.com',
    script: 'https://stats.example.com/script.js',
    websiteId: ID
  });
});

test('the policy allows the analytics origin only when it is on', () => {
  assert.doesNotMatch(policyFor('/'), /stats\.example\.com/);
  process.env.ANALYTICS_SCRIPT_URL = 'https://stats.example.com/script.js';
  process.env.ANALYTICS_WEBSITE_ID = ID;
  const policy = policyFor('/');
  assert.match(policy, /script-src [^;]*https:\/\/stats\.example\.com/);
  assert.match(policy, /connect-src [^;]*https:\/\/stats\.example\.com/);
});

test(
  'public pages carry the script, without automatic tracking',
  { skip: !fs.existsSync(PAGES) },
  () => {
    assert.doesNotMatch(seoHead('/', 'https://app.example.com')!.html, /data-website-id/);
    process.env.ANALYTICS_SCRIPT_URL = 'https://stats.example.com/script.js';
    process.env.ANALYTICS_WEBSITE_ID = ID;
    const html = seoHead('/fiyatlandirma', 'https://app.example.com')!.html;
    assert.match(html, /<script defer src="https:\/\/stats\.example\.com\/script\.js"/);
    assert.match(html, new RegExp(`data-website-id="${ID}"`));
    assert.match(html, /data-auto-track="false"/);
    assert.match(html, /data-do-not-track="true"/);
    // Private pages get no head of their own, so no script either.
    assert.equal(seoHead('/dashboard', 'https://app.example.com'), null);
  }
);
