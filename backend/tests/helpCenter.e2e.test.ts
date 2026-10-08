'use strict';

// A site's public help center (plan v10 PRD-10): off until the owner turns
// it on with an address of their own; then its active, site-wide FAQ entries
// are a page anyone can read — grouped, searchable, escaped, marked up for
// search engines or kept out of them — and the widget learns its address.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { prefixQuery, suggestSlug } from '../src/services/helpCenter';
import { call, tenant } from './helpers/idor';
import { BASE, widgetSession, LOCAL_ORIGIN } from './helpers/widget';

test.after(async () => {
  await closeRedisClient();
  await getPool().end();
});

const json = (res: { text: string }) => JSON.parse(res.text);
const page = (path: string) => fetch(`${BASE}${path}`);
const stamp = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;

async function faq(
  siteId: string,
  question: string,
  answer: string,
  extra: Record<string, unknown> = {}
) {
  await query(
    `INSERT INTO faqs (id, site_id, question, answer, category, is_active, page_specific)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      generateId(),
      siteId,
      question,
      answer,
      extra.category ?? 'Kargo',
      extra.active ?? true,
      extra.page ?? '*'
    ]
  );
}

test('a search becomes word prefixes, so suffixes do not hide an article', () => {
  assert.equal(prefixQuery('İadeler'), 'iade:*');
  assert.equal(prefixQuery('kargom hala gelmedi'), 'karg:* | hala:* | gelm:*');
  assert.equal(prefixQuery("a b ' & | !"), null, 'nothing a tsquery could choke on');
});

test('an address is made from the name the Turkish way', () => {
  assert.equal(suggestSlug('Örnek Mağaza'), 'ornek-magaza');
  assert.equal(suggestSlug('Çiçekçi Şükrü & Oğulları'), 'cicekci-sukru-ogullari');
  assert.match(suggestSlug('!!'), /^yardim-/);
});

test('off until turned on; then the page, its search, its address in the widget', async () => {
  const t = await tenant('help');
  const slug = `yardim-${stamp()}`;
  await faq(
    t.site._id,
    'Kargom ne zaman gelir?',
    'Siparişler 2 iş gününde kargoya verilir.\nTakip: https://kargo.example/takip'
  );
  await faq(t.site._id, 'İade nasıl yapılır?', 'İade için <b>14 gün</b> içinde yazın.', {
    category: 'İade'
  });
  await faq(t.site._id, 'Gizli taslak', 'Yayında değil', { active: false });
  await faq(t.site._id, 'Yalnız ödeme sayfasında', 'Sayfaya özel', { page: '/odeme' });

  const before = await call(t.token, `/api/sites/${t.site._id}/help-center`);
  assert.equal(before.status, 200, before.text);
  assert.equal(json(before).settings.enabled, false);
  assert.ok(json(before).suggestedSlug);
  assert.equal((await page(`/help/${slug}`)).status, 404);

  // An address is needed, and it has a shape.
  assert.equal(
    (await call(t.token, `/api/sites/${t.site._id}/help-center`, 'PUT', { enabled: true })).status,
    400
  );
  for (const bad of ['a', 'Büyük Harf', '-tire', 'x'.repeat(41), '../etc']) {
    // eslint-disable-next-line no-await-in-loop
    const res = await call(t.token, `/api/sites/${t.site._id}/help-center`, 'PUT', { slug: bad });
    assert.equal(res.status, 400, bad);
  }
  const on = await call(t.token, `/api/sites/${t.site._id}/help-center`, 'PUT', {
    enabled: true,
    slug
  });
  assert.equal(on.status, 200, on.text);

  const res = await page(`/help/${slug}`);
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<html lang="tr">/);
  assert.match(html, /Kargom ne zaman gelir\?/);
  assert.match(html, /İade nasıl yapılır\?/);
  assert.doesNotMatch(html, /Gizli taslak/, 'inactive entries stay out');
  assert.doesNotMatch(html, /Yalnız ödeme sayfasında/, 'page-specific entries stay out');
  assert.doesNotMatch(html, /<b>14 gün<\/b>/, 'the owner’s text is escaped');
  assert.match(html, /&lt;b&gt;14 gün&lt;\/b&gt;/);
  assert.match(
    html,
    /<a href="https:\/\/kargo\.example\/takip" rel="nofollow noopener noreferrer"/
  );
  assert.match(html, /"@type":"FAQPage"/);
  assert.match(html, new RegExp(`<link rel="canonical" href="[^"]+/help/${slug}">`));
  assert.doesNotMatch(html, /name="robots"/, 'indexed unless the owner says otherwise');

  // Search: by word form, not only by the exact text.
  const found = await (await page(`/help/${slug}?q=${encodeURIComponent('kargolar')}`)).text();
  assert.match(found, /Kargom ne zaman gelir\?/);
  assert.doesNotMatch(found, /İade nasıl yapılır\?/);
  assert.match(found, /name="robots" content="noindex, follow"/, 'search results are not indexed');
  // The stemmer reads "iade" as "ia" + "-de"; the prefix search still finds it.
  const iade = await (await page(`/help/${slug}?q=${encodeURIComponent('iadeler')}`)).text();
  assert.match(iade, /İade nasıl yapılır?/);
  assert.doesNotMatch(iade, /Kargom ne zaman gelir?/);

  // The widget learns the address.
  const session = await widgetSession(t.site.siteKey, { origin: LOCAL_ORIGIN });
  assert.equal(session.status, 200);
  assert.match(String(session.body.helpUrl), new RegExp(`/help/${slug}$`));

  // noindex, and off again.
  await call(t.token, `/api/sites/${t.site._id}/help-center`, 'PUT', { noindex: true });
  assert.match(
    await (await page(`/help/${slug}`)).text(),
    /name="robots" content="noindex, follow"/
  );
  await call(t.token, `/api/sites/${t.site._id}/help-center`, 'PUT', { enabled: false });
  assert.equal((await page(`/help/${slug}`)).status, 404);
  const off = await widgetSession(t.site.siteKey, { origin: LOCAL_ORIGIN });
  assert.equal(off.body.helpUrl, null);
});

test('an address belongs to one site; a held site’s page is gone', async () => {
  const a = await tenant('helpa');
  const b = await tenant('helpb');
  const slug = `ortak-${stamp()}`;
  assert.equal(
    (await call(a.token, `/api/sites/${a.site._id}/help-center`, 'PUT', { enabled: true, slug }))
      .status,
    200
  );
  const taken = await call(b.token, `/api/sites/${b.site._id}/help-center`, 'PUT', {
    enabled: true,
    slug: slug.toUpperCase().toLowerCase()
  });
  assert.equal(taken.status, 409);
  assert.equal(json(taken).code, 'HELP_SLUG_TAKEN');
  // Another workspace's site cannot be configured.
  assert.equal(
    (await call(b.token, `/api/sites/${a.site._id}/help-center`, 'PUT', { enabled: false })).status,
    404
  );

  assert.equal((await page(`/help/${slug}`)).status, 200);
  await query('UPDATE sites SET suspended_at = now() WHERE id = $1', [a.site._id]);
  try {
    assert.equal((await page(`/help/${slug}`)).status, 404);
  } finally {
    await query('UPDATE sites SET suspended_at = NULL WHERE id = $1', [a.site._id]);
  }
});
