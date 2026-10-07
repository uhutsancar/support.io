// Each public page's <head>, written by the server (plan v10 MKT-03,
// KARAR-MKT-1 option a without a headless browser in the build): the
// title and description from the panel's build (dist/public-pages.json),
// with Open Graph and Twitter tags, the canonical address and its other
// language (hreflang) and JSON-LD — all on the domain this process runs
// on. A crawler or a link preview that runs no JavaScript sees the right
// page; the page itself still renders in the browser.
//
// The shell marks the replaceable part with <!--seo--> … <!--/seo-->
// (admin-panel/index.html). Pages not in the list keep the shell's default.

import fs from 'fs';
import path from 'path';
import { PLAN_TYPES } from '../domain';
import { displayPrice } from './paddlePrices';

interface Meta {
  title: string;
  description: string;
}
interface PublicPage {
  tr: string;
  en: string;
  kind: string;
  meta?: { tr: Meta; en: Meta };
}

const PAGES_FILE = path.join(__dirname, '../../../admin-panel/dist/public-pages.json');

let loaded: { at: number; byPath: Map<string, { page: PublicPage; lang: 'tr' | 'en' }> } | null =
  null;

function pages() {
  // Read once a minute at most: the file changes only with a deploy.
  if (loaded && Date.now() - loaded.at < 60_000) return loaded.byPath;
  const byPath = new Map<string, { page: PublicPage; lang: 'tr' | 'en' }>();
  try {
    const { pages: list } = JSON.parse(fs.readFileSync(PAGES_FILE, 'utf8')) as {
      pages: PublicPage[];
    };
    for (const page of list) {
      byPath.set(page.tr, { page, lang: 'tr' });
      byPath.set(page.en, { page, lang: 'en' });
    }
  } catch {
    // No panel build: every page keeps the shell's default head.
  }
  loaded = { at: Date.now(), byPath };
  return byPath;
}

const attr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// JSON inside <script>: "</" must not end the element early.
const json = (value: unknown) => JSON.stringify(value).replace(/</g, '\u003c');

function structuredData(base: string, page: PublicPage, lang: 'tr' | 'en', meta: Meta) {
  const graph: unknown[] = [
    {
      '@type': 'Organization',
      '@id': `${base}/#organization`,
      name: 'Support.io',
      url: `${base}/`,
      logo: `${base}/icon-512.png`
    }
  ];
  if (page.kind === 'home' || page.kind === 'pricing') {
    graph.push({
      '@type': 'SoftwareApplication',
      name: 'Support.io',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description: meta.description,
      inLanguage: lang,
      publisher: { '@id': `${base}/#organization` },
      // The prices GET /api/plans shows: Paddle's once billing is on.
      offers: PLAN_TYPES.map((plan) => ({
        '@type': 'Offer',
        name: plan,
        price: String(displayPrice(plan).monthly ?? 0),
        priceCurrency: displayPrice(plan).currency,
        url: `${base}${lang === 'en' ? page.en : page.tr}`
      }))
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** The <head> part for a public page, or null when the path is not one. */
export function seoHead(
  pathname: string,
  base: string
): { html: string; lang: 'tr' | 'en' } | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const found = pages().get(clean);
  if (!found?.page.meta) return null;
  const { page, lang } = found;
  const meta = page.meta![lang];
  const url = `${base}${lang === 'en' ? page.en : page.tr}`;
  const image = `${base}/og-image.png`;
  const lines = [
    `<meta name="description" content="${attr(meta.description)}" />`,
    `<link rel="canonical" href="${attr(url)}" />`,
    `<link rel="alternate" hreflang="tr" href="${attr(base + page.tr)}" />`,
    `<link rel="alternate" hreflang="en" href="${attr(base + page.en)}" />`,
    `<link rel="alternate" hreflang="x-default" href="${attr(base + page.tr)}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Support.io" />',
    `<meta property="og:title" content="${attr(meta.title)}" />`,
    `<meta property="og:description" content="${attr(meta.description)}" />`,
    `<meta property="og:url" content="${attr(url)}" />`,
    `<meta property="og:image" content="${attr(image)}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    `<meta property="og:locale" content="${lang === 'en' ? 'en_US' : 'tr_TR'}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${attr(meta.title)}" />`,
    `<meta name="twitter:description" content="${attr(meta.description)}" />`,
    `<meta name="twitter:image" content="${attr(image)}" />`,
    `<script type="application/ld+json">${json(structuredData(base, page, lang, meta))}</script>`,
    `<title>${attr(meta.title)}</title>`
  ];
  return { html: lines.join('\n    '), lang };
}

/** The shell with the page's head in place of the default one. */
export function withSeoHead(shell: string, pathname: string, base: string): string {
  const head = seoHead(pathname, base);
  if (!head) return shell;
  const start = shell.indexOf('<!--seo-->');
  const end = shell.indexOf('<!--/seo-->');
  if (start < 0 || end < start) return shell;
  const replaced = shell.slice(0, start) + head.html + shell.slice(end + '<!--/seo-->'.length);
  return head.lang === 'en' ? replaced.replace('<html lang="tr"', '<html lang="en"') : replaced;
}
