'use strict';

// Each public page's <head> from the server (plan v10 MKT-03): title,
// description, canonical and hreflang on the given domain, Open Graph with
// the PNG preview, JSON-LD with the plan prices, the page's language; other
// pages keep the shell's default. Uses the panel build's page list
// (admin-panel/dist/public-pages.json; `npx tsx scripts/public-pages.ts` in
// admin-panel writes it).

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { seoHead, withSeoHead } from '../src/services/seoHead';
import { PLAN_LIMITS } from '../src/domain/plans';

const PAGES = path.join(__dirname, '../../admin-panel/dist/public-pages.json');
const SHELL = `<!doctype html>
<html lang="tr">
  <head>
    <!--seo-->
    <title>Default</title>
    <!--/seo-->
  </head>
  <body></body>
</html>`;
const BASE = 'https://app.example.com';

test('a public page gets its own head on the given domain', { skip: !fs.existsSync(PAGES) }, () => {
  const html = withSeoHead(SHELL, '/en/pricing', BASE);
  assert.match(html, /<html lang="en"/);
  assert.doesNotMatch(html, /Default/);
  assert.match(html, /<title>[^<]+— Support\.io<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/app\.example\.com\/en\/pricing" \/>/);
  assert.match(html, /hreflang="tr" href="https:\/\/app\.example\.com\/fiyatlandirma"/);
  assert.match(html, /hreflang="x-default" href="https:\/\/app\.example\.com\/fiyatlandirma"/);
  assert.match(html, /property="og:image" content="https:\/\/app\.example\.com\/og-image\.png"/);
  assert.match(html, /property="og:url" content="https:\/\/app\.example\.com\/en\/pricing"/);

  const ld = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)![1]);
  const app = ld['@graph'].find((n: { '@type': string }) => n['@type'] === 'SoftwareApplication');
  assert.ok(app, 'pricing carries the application with its offers');
  const pro = app.offers.find((o: { name: string }) => o.name === 'PRO');
  assert.equal(pro.price, String(PLAN_LIMITS.PRO.price.monthly));
  assert.equal(pro.priceCurrency, 'TRY');
});

test(
  'Turkish pages stay Turkish; trailing slashes are the same page',
  { skip: !fs.existsSync(PAGES) },
  () => {
    const head = seoHead('/fiyatlandirma/', BASE);
    assert.ok(head);
    assert.equal(head!.lang, 'tr');
    assert.match(withSeoHead(SHELL, '/', BASE), /<html lang="tr"/);
  }
);

test('private and unknown pages keep the default head', () => {
  for (const pathname of ['/dashboard', '/en/login', '/nothing-here']) {
    assert.equal(withSeoHead(SHELL, pathname, BASE), SHELL, pathname);
  }
});

test('text is escaped; JSON-LD cannot close its script', { skip: !fs.existsSync(PAGES) }, () => {
  const html = withSeoHead(SHELL, '/', BASE);
  const ld = /<script type="application\/ld\+json">(.*?)<\/script>/s.exec(html)![1];
  assert.doesNotMatch(ld, /<\//);
});
