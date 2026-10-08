// The site's public pages, Turkish and English pairs with each page's title
// and description, written next to the build as dist/public-pages.json
// (plan v10 MKT-01, MKT-03). The backend turns it into /sitemap.xml and into
// each page's <head> (title, description, Open Graph, canonical, hreflang,
// JSON-LD) with the domain it runs on, so one image serves staging and
// production, and a crawler or a link preview that runs no JavaScript still
// sees the right page.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marketingRoutes } from '../src/lib/marketingPaths';
import { FEATURE_IDS, SOLUTION_IDS } from '../src/pages/marketing/features';
import tr from '../src/locales/tr';
import en from '../src/locales/en';
import marketingTr from '../src/locales/marketing.tr';
import marketingEn from '../src/locales/marketing.en';
import pagesTr from '../src/locales/pages.tr';
import pagesEn from '../src/locales/pages.en';

type Tree = Record<string, unknown>;
const isPlainObject = (v: unknown): v is Tree =>
  Boolean(v) && typeof v === 'object' && !Array.isArray(v);
// The same merge as src/i18n.ts: marketing and page texts over the base.
function deepMerge(base: Tree, override: Tree): Tree {
  const out: Tree = { ...base };
  for (const [key, next] of Object.entries(override)) {
    out[key] =
      isPlainObject(next) && isPlainObject(base[key]) ? deepMerge(base[key] as Tree, next) : next;
  }
  return out;
}
const texts = {
  tr: deepMerge(deepMerge(tr as Tree, marketingTr as Tree), pagesTr as Tree),
  en: deepMerge(deepMerge(en as Tree, marketingEn as Tree), pagesEn as Tree)
};
function text(lang: 'tr' | 'en', key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (isPlainObject(node) ? node[part] : undefined), texts[lang]);
  if (typeof value !== 'string' || !value) throw new Error(`missing ${lang} text: ${key}`);
  return value;
}

const SUFFIX = ' — Support.io';
type Meta = { title: string; description: string };
const meta = (titleKey: string, descKey: string, suffix = true) => ({
  tr: { title: text('tr', titleKey) + (suffix ? SUFFIX : ''), description: text('tr', descKey) },
  en: { title: text('en', titleKey) + (suffix ? SUFFIX : ''), description: text('en', descKey) }
});

const r = { tr: marketingRoutes('tr'), en: marketingRoutes('en') };
const pair = (pick: (routes: ReturnType<typeof marketingRoutes>) => string) => ({
  tr: pick(r.tr),
  en: pick(r.en)
});

const pages: Array<{ tr: string; en: string; kind: string; meta: { tr: Meta; en: Meta } }> = [
  {
    ...pair((x) => x.home),
    kind: 'home',
    meta: meta('landing.home.metaTitle', 'landing.home.metaDesc', false)
  },
  {
    ...pair((x) => x.features),
    kind: 'features',
    meta: meta('featuresPage.meta.title', 'featuresPage.meta.description')
  },
  { ...pair((x) => x.ai), kind: 'ai', meta: meta('aiPage.meta.title', 'aiPage.meta.description') },
  ...FEATURE_IDS.filter((id) => id !== 'ai-assistant').map((id) => ({
    ...pair((x) => x.feature(id)),
    kind: 'feature',
    meta: meta(`featuresPage.items.${id}.title`, `featuresPage.items.${id}.plain`)
  })),
  ...SOLUTION_IDS.map((id) => ({
    ...pair((x) => `${x.solutions}/${id}`),
    kind: 'solution',
    meta: meta(`solutions.items.${id}.name`, `solutions.items.${id}.desc`)
  })),
  {
    ...pair((x) => x.pricing),
    kind: 'pricing',
    meta: meta('pricingPage.meta.title', 'pricingPage.meta.description')
  },
  {
    ...pair((x) => x.docs),
    kind: 'docs',
    meta: meta('docsPage.meta.title', 'docsPage.meta.description')
  },
  {
    ...pair((x) => x.about),
    kind: 'about',
    meta: meta('aboutPage.meta.title', 'aboutPage.meta.description')
  },
  {
    ...pair((x) => x.privacy),
    kind: 'legal',
    meta: meta('legal.privacy.title', 'legal.privacy.meta')
  },
  { ...pair((x) => x.terms), kind: 'legal', meta: meta('legal.terms.title', 'legal.terms.meta') },
  {
    ...pair((x) => x.accessibility),
    kind: 'legal',
    meta: meta('legal.accessibility.title', 'legal.accessibility.meta')
  },
  { ...pair((x) => x.aiUse), kind: 'legal', meta: meta('legal.aiUse.title', 'legal.aiUse.meta') }
];

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'dist', 'public-pages.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify({ builtAt: new Date().toISOString(), pages }, null, 2)}\n`);
process.stdout.write(`public-pages.json: ${pages.length} pages\n`);
