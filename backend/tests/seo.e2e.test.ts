'use strict';

// robots.txt, sitemap.xml and X-Robots-Tag (plan v10 MKT-01, MKT-02): built
// from the domain the API runs on, never a hard-coded one; private pages
// carry noindex; the sitemap pairs every page with its other language.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sitemapXml } from '../src/routes/wellKnown';
import { BASE } from './helpers/widget';

test('robots.txt keeps private pages out and names the sitemap on this domain', async () => {
  const res = await fetch(`${BASE}/robots.txt`);
  assert.equal(res.status, 200);
  const text = await res.text();
  for (const path of [
    '/dashboard',
    '/en/dashboard',
    '/onboarding',
    '/api/',
    '/invite/',
    '/reset-password',
    '/verify-email'
  ]) {
    assert.match(text, new RegExp(`^Disallow: ${path}$`, 'm'), path);
  }
  assert.match(text, /^Sitemap: https?:\/\/[^\s]+\/sitemap\.xml$/m);
  assert.doesNotMatch(text, /support\.io/, 'no hard-coded domain');
});

test('the sitemap lists pages with their other language', async () => {
  const res = await fetch(`${BASE}/sitemap.xml`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /xml/);
  const body = await res.text();
  assert.match(body, /<urlset /);
  assert.match(body, /hreflang="tr"/);
  assert.match(body, /hreflang="en"/);
  assert.doesNotMatch(body, /support\.io/);

  // The renderer itself, with the panel build's list.
  const xml = sitemapXml('https://app.example.com', {
    builtAt: '2026-10-08T10:00:00Z',
    pages: [
      { tr: '/', en: '/en' },
      { tr: '/fiyatlandirma', en: '/en/pricing' }
    ]
  });
  assert.equal((xml.match(/<url>/g) || []).length, 4, 'each language its own entry');
  assert.match(xml, /<loc>https:\/\/app\.example\.com\/en\/pricing<\/loc>/);
  assert.match(xml, /hreflang="x-default" href="https:\/\/app\.example\.com\/fiyatlandirma"/);
  assert.match(xml, /<lastmod>2026-10-08<\/lastmod>/);
});

test('private pages say noindex; public ones do not', async () => {
  for (const path of [
    '/dashboard',
    '/en/dashboard/settings',
    '/onboarding',
    '/verify-email',
    '/invite/accept'
  ]) {
    const res = await fetch(`${BASE}${path}`);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow', path);
  }
  for (const path of ['/', '/fiyatlandirma', '/en/pricing']) {
    const res = await fetch(`${BASE}${path}`);
    assert.equal(res.headers.get('x-robots-tag'), null, path);
  }
});
