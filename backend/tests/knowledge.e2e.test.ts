'use strict';

// Knowledge sources (plan v10 PRD-21): pages of the site itself and PDFs the
// assistant may also answer from.
//
// The pieces first, in this process: HTML to text, passages, robots.txt,
// "on the site", PDF text, the SSRF guard. Then the routes against the
// running API, whose fetches go to its stand-in for the web
// (KNOWLEDGE_TRANSPORT=memory) after the same address checks. One test reads
// a real public page when the network allows it.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import {
  chunkText,
  htmlToText,
  KnowledgeError,
  onSite,
  readPage,
  readPdf,
  robotsAllows
} from '../src/services/knowledgeSources';
import { faqSources } from '../src/services/assistant/knowledge';
import { setPlan } from './helpers/accounts';
import { tenant } from './helpers/idor';
import { BASE } from './helpers/widget';
import type { Tenant } from './helpers/idor';

test.after(async () => {
  await closeRedisClient();
  await getPool().end();
});

const PDF = fs.readFileSync(path.join(__dirname, 'fixtures', 'kargo-rehberi.pdf'));

async function code(promise: Promise<unknown>): Promise<string | null> {
  try {
    await promise;
    return null;
  } catch (error) {
    return error instanceof KnowledgeError ? error.code : `other: ${(error as Error).message}`;
  }
}

// ---------------------------------------------------------------- pieces

test('a page becomes its title and readable text', () => {
  const page = htmlToText(`<!doctype html><html><head><title>Kargo &amp; Teslimat</title>
    <style>.x{color:red}</style><script>alert("x")</script></head><body>
    <nav>Ana sayfa · Ürünler · Sepet</nav>
    <main><h1>Kargo süreleri</h1><p>Siparişler&nbsp;2 iş günü içinde kargoya verilir.</p>
    <ul><li>İstanbul: 1 gün</li><li>Diğer iller: 2&#8211;3 gün</li></ul>
    <p>Bu metin, ana içeriğin seçildiğini göstermek için yeterince uzun bir paragraftır; menü ve alt bilgi okunmaz.</p></main>
    <footer>© 2026 Mağaza</footer></body></html>`);
  assert.equal(page.title, 'Kargo & Teslimat');
  assert.match(
    page.text,
    /^Kargo süreleri\nSiparişler 2 iş günü içinde kargoya verilir\.\nİstanbul: 1 gün\nDiğer iller: 2–3 gün/
  );
  for (const absent of ['alert', 'color:red', 'Ana sayfa', '© 2026']) {
    assert.ok(!page.text.includes(absent), absent);
  }
});

test('long text is cut into passages at paragraphs and sentences', () => {
  const sentence = 'Bu bir cümledir ve iade koşullarını anlatır. ';
  const text = [sentence.repeat(10), 'Kısa paragraf burada duruyor.', sentence.repeat(40)].join(
    '\n'
  );
  const chunks = chunkText(text, 400);
  assert.ok(chunks.length >= 5);
  for (const c of chunks) assert.ok(c.length <= 400, `${c.length}`);
  assert.ok(chunks.every((c) => !c.startsWith(' ')));
  assert.equal(chunks.join(' ').split('iade koşullarını').length - 1, 50);
});

test('robots.txt: our group over "*", the longest rule, Allow on a tie', () => {
  const robots = [
    'User-agent: *',
    'Disallow: /private',
    'Disallow: /*.pdf$',
    '',
    'User-agent: SupportioBot',
    'Disallow: /tmp',
    'Allow: /tmp/open'
  ].join('\n');
  assert.equal(robotsAllows(robots, '/private/page'), true, 'our group replaces "*"');
  assert.equal(robotsAllows(robots, '/tmp/x'), false);
  assert.equal(robotsAllows(robots, '/tmp/open/x'), true);
  const star = 'User-agent: *\nDisallow: /private\nDisallow: /*.pdf$\nAllow: /private/ok';
  assert.equal(robotsAllows(star, '/private/x'), false);
  assert.equal(robotsAllows(star, '/private/ok'), true);
  assert.equal(robotsAllows(star, '/files/a.pdf'), false);
  assert.equal(robotsAllows(star, '/files/a.pdf?x=1'), true);
  assert.equal(robotsAllows('', '/anything'), true);
  assert.equal(robotsAllows('User-agent: *\nDisallow: /', '/'), false);
});

test('only the site’s own domain counts as the site', () => {
  const domains = ['magaza.example', 'https://www.shop.example/'];
  assert.equal(onSite('magaza.example', domains), true);
  assert.equal(onSite('www.magaza.example', domains), true);
  assert.equal(onSite('blog.magaza.example', domains), true);
  assert.equal(onSite('shop.example', domains), true);
  for (const host of [
    'evilmagaza.example',
    'magaza.example.evil.com',
    'example',
    'other.example'
  ]) {
    assert.equal(onSite(host, domains), false, host);
  }
});

test('a PDF’s text, Turkish letters and all; anything else is refused', async () => {
  const text = await readPdf(PDF);
  assert.match(text, /İade süresi teslimattan itibaren 30 gündür/);
  assert.match(text, /Siparişleriniz İstanbul deposundan çıkar/);
  assert.equal(await code(readPdf(Buffer.from('%PDF-1.4 not really a pdf'))), 'unreadable_pdf');
});

test('addresses into our own network are refused before any request', async () => {
  for (const [url, domains] of [
    ['http://127.0.0.1/admin', ['127.0.0.1']],
    ['http://169.254.169.254/latest/meta-data', ['169.254.169.254']],
    ['http://localhost:5000/api', ['localhost']]
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    assert.equal(await code(readPage(url, [...domains])), 'unsafe', url);
  }
  assert.equal(await code(readPage('https://other.example/', ['magaza.example'])), 'not_on_site');
  // An IPv6 literal is never a site's domain: refused before any request too.
  const ipv6 = await code(readPage('http://[::1]/', ['[::1]']));
  assert.ok(ipv6 === 'unsafe' || ipv6 === 'not_on_site', String(ipv6));
});

test('a real public page, when the network allows', async (t) => {
  let text: string;
  try {
    ({ text } = await readPage('https://example.com/', ['example.com']));
  } catch (error) {
    if (
      error instanceof KnowledgeError &&
      ['unreachable', 'unsafe', 'timeout'].includes(error.code)
    ) {
      t.skip(`no network: ${error.code}`);
      return;
    }
    throw error;
  }
  assert.match(text, /Example Domain/);
});

// ---------------------------------------------------------------- routes

async function call(t: Tenant, pathName: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${BASE}${pathName}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t.token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

async function serve(t: Tenant, url: string, body: string, contentType?: string, status?: number) {
  const res = await call(t, '/api/dev/knowledge-pages', 'POST', { url, body, contentType, status });
  assert.equal(res.status, 204, 'the stand-in is mounted (KNOWLEDGE_TRANSPORT=memory)');
}

async function sources(t: Tenant) {
  return (await call(t, `/api/sites/${t.site._id}/knowledge`)).body;
}

async function settled(t: Tenant, count: number) {
  for (let i = 0; i < 80; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    const list = await sources(t);
    const done = list.sources.filter((s: { status: string }) => s.status !== 'pending');
    if (list.sources.length >= count && done.length === list.sources.length) return list;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('sources did not settle');
}

const html = (title: string, body: string) =>
  `<html><head><title>${title}</title></head><body><main><h1>${title}</h1><p>${body}</p></main></body></html>`;

test('pages of the site: added, read, refused by robots, kept to the site', async () => {
  const t = await tenant('knowpages');
  const { rows } = await query('SELECT domain FROM sites WHERE id = $1', [t.site._id]);
  const domain = rows[0].domain;
  const origin = `https://${domain}`;
  await serve(t, `${origin}/robots.txt`, 'User-agent: *\nDisallow: /gizli', 'text/plain');
  await serve(
    t,
    `${origin}/kargo`,
    html('Kargo bilgisi', 'Kargolar 2 iş günü içinde teslim edilir ve kargo ücreti 49 TL’dir.')
  );
  await serve(
    t,
    `${origin}/gizli/not`,
    html('Gizli', 'Bu sayfa robots.txt ile kapalıdır, okunmamalıdır ve asistan görmemelidir.')
  );
  await serve(
    t,
    `${origin}/iade`,
    html(
      'İade',
      'İadeler 30 gün içinde ücretsizdir; ürün kullanılmamış olmalıdır ve faturası bulunmalıdır.'
    )
  );
  await serve(
    t,
    `${origin}/sitemap.xml`,
    `<?xml version="1.0"?><urlset><url><loc>${origin}/kargo</loc></url><url><loc>${origin}/iade</loc></url><url><loc>https://other.example/x</loc></url></urlset>`,
    'application/xml'
  );

  const added = await call(t, `/api/sites/${t.site._id}/knowledge/pages`, 'POST', {
    url: `${origin}/kargo`
  });
  assert.equal(added.status, 201, JSON.stringify(added.body));
  assert.equal(added.body.source.status, 'pending');
  assert.equal(
    (await call(t, `/api/sites/${t.site._id}/knowledge/pages`, 'POST', { url: `${origin}/kargo` }))
      .status,
    409
  );
  await call(t, `/api/sites/${t.site._id}/knowledge/pages`, 'POST', { url: `${origin}/gizli/not` });
  const offSite = await call(t, `/api/sites/${t.site._id}/knowledge/pages`, 'POST', {
    url: 'https://other.example/page'
  });
  assert.equal(offSite.status, 400);
  assert.equal(offSite.body.code, 'NOT_ON_SITE');

  const map = await call(t, `/api/sites/${t.site._id}/knowledge/sitemap`, 'POST', {
    url: `${origin}/sitemap.xml`
  });
  assert.equal(map.status, 201, JSON.stringify(map.body));
  assert.deepEqual(map.body, { found: 2, added: 1 }, 'the off-site address is not followed');

  const list = await settled(t, 3);
  const byUrl = Object.fromEntries(list.sources.map((s: any) => [new URL(s.url).pathname, s]));
  assert.equal(byUrl['/kargo'].status, 'ready');
  assert.equal(byUrl['/kargo'].title, 'Kargo bilgisi');
  assert.ok(byUrl['/kargo'].chars > 40);
  assert.equal(byUrl['/iade'].status, 'ready');
  assert.equal(byUrl['/gizli/not'].status, 'failed');
  assert.equal(byUrl['/gizli/not'].error, 'robots');
  assert.equal(list.allowed, true);
  assert.equal(list.used, 3);
  assert.equal(list.limit, 50);

  // What the assistant would be given for a question about returns.
  const given = await faqSources(t.site._id, 'İade ücretli mi?', 8, true);
  const passage = given.find((s) => s.kind === 'page');
  assert.ok(passage, JSON.stringify(given));
  assert.equal(passage.url, `${origin}/iade`);
  assert.match(passage.answer, /30 gün içinde ücretsizdir/);
  assert.ok(!given.some((s) => /robots\.txt ile kapalı/.test(s.answer)));
  assert.ok(!(await faqSources(t.site._id, 'İade ücretli mi?', 8, false)).some((s) => s.kind));
});

test('a PDF is read and kept as text; anything else is refused', async () => {
  const t = await tenant('knowpdf');
  const upload = async (bytes: Buffer, name: string, type: string) => {
    const form = new FormData();
    form.append('file', new Blob([bytes], { type }), name);
    const res = await fetch(`${BASE}/api/sites/${t.site._id}/knowledge/pdf`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t.token}` },
      body: form
    });
    return { status: res.status, body: (await res.json()) as any };
  };
  const ok = await upload(PDF, 'Kargo Rehberi.pdf', 'application/pdf');
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.source.kind, 'pdf');
  assert.equal(ok.body.source.status, 'ready');
  assert.equal(ok.body.source.title, 'Kargo Rehberi.pdf');
  const notPdf = await upload(Buffer.from('<html>hi</html>'), 'sahte.pdf', 'application/pdf');
  assert.equal(notPdf.status, 400);
  assert.equal(notPdf.body.code, 'NOT_PDF');

  const given = await faqSources(t.site._id, 'Garanti kaç yıl?', 8, true);
  const passage = given.find((s) => s.kind === 'pdf');
  assert.ok(passage, JSON.stringify(given));
  assert.match(passage.answer, /2 yıl üretici garantilidir/);

  // Deleting a source deletes its passages.
  const removed = await call(
    t,
    `/api/sites/${t.site._id}/knowledge/${ok.body.source._id}`,
    'DELETE'
  );
  assert.equal(removed.status, 204);
  const { rows } = await query(
    'SELECT count(*)::int AS n FROM knowledge_chunks WHERE source_id = $1',
    [ok.body.source._id]
  );
  assert.equal(rows[0].n, 0);
});

test('on Free: listed and deletable, nothing added; another tenant sees nothing', async () => {
  const t = await tenant('knowfree');
  const other = await tenant('knowother');
  await setPlan(t.organizationId, 'FREE');
  const list = await sources(t);
  assert.equal(list.allowed, false);
  assert.equal(list.limit, 0);
  const refused = await call(t, `/api/sites/${t.site._id}/knowledge/pages`, 'POST', {
    url: 'https://x.example/'
  });
  assert.equal(refused.status, 403);
  assert.equal(refused.body.code, 'PLAN_UPGRADE_REQUIRED');
  assert.equal((await call(other, `/api/sites/${t.site._id}/knowledge`)).status, 404);
});

test('a site pointed at a private address cannot be read', async () => {
  const t = await tenant('knowssrf');
  await query(`UPDATE sites SET domain = '169.254.169.254' WHERE id = $1`, [t.site._id]);
  const added = await call(t, `/api/sites/${t.site._id}/knowledge/pages`, 'POST', {
    url: 'http://169.254.169.254/latest/meta-data/'
  });
  assert.equal(added.status, 201);
  const list = await settled(t, 1);
  assert.equal(list.sources[0].status, 'failed');
  assert.equal(list.sources[0].error, 'unsafe');
});
