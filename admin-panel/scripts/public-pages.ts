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
import {
  COMPARISONS,
  COMPARISONS_PUBLISHED,
  FEATURE_IDS,
  SOLUTION_IDS
} from '../src/pages/marketing/features';
import tr from '../src/locales/tr';
import en from '../src/locales/en';
import marketingTr from '../src/locales/marketing.tr';
import marketingEn from '../src/locales/marketing.en';
import pagesTr from '../src/locales/pages.tr';
import pagesEn from '../src/locales/pages.en';
import { BRAND_NAME } from '../src/lib/brand';

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
  const value = valueAt(lang, key);
  if (typeof value !== 'string' || !value) throw new Error(`missing ${lang} text: ${key}`);
  return value;
}
function valueAt(lang: 'tr' | 'en', key: string): unknown {
  return key
    .split('.')
    .reduce<unknown>((node, part) => (isPlainObject(node) ? node[part] : undefined), texts[lang]);
}

const SUFFIX = ` — ${BRAND_NAME}`;
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

interface FaqEntry {
  question: string;
  answer: string;
}
interface BreadcrumbEntry {
  name: string;
  path: string;
}
interface PublicContent {
  heading: string;
  description: string;
  sections: string[];
  faq?: FaqEntry[];
  breadcrumbs?: BreadcrumbEntry[];
}
interface PublicPage {
  tr: string;
  en: string;
  kind: string;
  meta: { tr: Meta; en: Meta };
  content?: { tr: PublicContent; en: PublicContent };
}

const pages: PublicPage[] = [
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
    ...pair((x) => x.apiDocs),
    kind: 'docs',
    meta: meta('apiDocs.meta.title', 'apiDocs.meta.description')
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
  { ...pair((x) => x.aiUse), kind: 'legal', meta: meta('legal.aiUse.title', 'legal.aiUse.meta') },
  // Karşılaştırmalar hukukçu onayından sonra listeye girer (features.ts).
  ...(COMPARISONS_PUBLISHED ? COMPARISONS : []).map(({ id }) => ({
    ...pair((x) => `${x.compare}/${id}`),
    kind: 'compare',
    meta: {
      tr: {
        title:
          text('tr', 'compare.metaTitle').replace(
            '{{name}}',
            text('tr', `compare.items.${id}.name`)
          ) + SUFFIX,
        description: text('tr', `compare.items.${id}.summary`)
      },
      en: {
        title:
          text('en', 'compare.metaTitle').replace(
            '{{name}}',
            text('en', `compare.items.${id}.name`)
          ) + SUFFIX,
        description: text('en', `compare.items.${id}.summary`)
      }
    }
  }))
];

const stringList = (lang: 'tr' | 'en', keys: string[]) =>
  keys
    .map((key) => valueAt(lang, key))
    .filter((value): value is string => typeof value === 'string');

function faqEntries(lang: 'tr' | 'en', key: string): FaqEntry[] | undefined {
  const items = valueAt(lang, key);
  if (!Array.isArray(items)) return undefined;
  const faq = items.flatMap((item) => {
    if (!isPlainObject(item) || typeof item.q !== 'string' || typeof item.a !== 'string') return [];
    return [{ question: item.q, answer: item.a }];
  });
  return faq.length ? faq : undefined;
}

function contentFor(page: PublicPage, lang: 'tr' | 'en'): PublicContent {
  const routes = r[lang];
  let heading = page.meta[lang].title.replace(SUFFIX, '');
  let description = page.meta[lang].description;
  let sections: string[] = [];
  let faq: FaqEntry[] | undefined;
  let breadcrumbs: BreadcrumbEntry[] | undefined;

  if (page.kind === 'home') {
    heading = `${text(lang, 'homePage.hero.title')} ${text(lang, 'homePage.hero.accent')}`;
    description = text(lang, 'homePage.hero.desc');
    sections = stringList(lang, [
      'homePage.tour.title',
      'homePage.industries.title',
      'homePage.story.title',
      'homePage.ai.title',
      'homePage.setup.title',
      'homePage.features.title',
      'homePage.security.title',
      'homePage.plans.title',
      'homePage.faq.title'
    ]);
    faq = faqEntries(lang, 'homePage.faq.items');
  } else if (page.kind === 'pricing') {
    heading = text(lang, 'pricingPage.title');
    description = text(lang, 'pricingPage.description');
    sections = stringList(lang, [
      'pricingPage.chooseTitle',
      'pricingPage.compareTitle',
      'pricingPage.faqTitle'
    ]);
    faq = faqEntries(lang, 'pricingPage.faqItems');
  } else if (page.kind === 'feature') {
    const id = page.en.split('/').pop()!;
    heading = text(lang, `featuresPage.items.${id}.title`);
    description = text(lang, `featuresPage.items.${id}.plain`);
    sections = stringList(lang, [
      `featuresPage.items.${id}.benefitsTitle`,
      `featuresPage.items.${id}.stepsTitle`
    ]);
    breadcrumbs = [
      { name: lang === 'tr' ? 'Ana sayfa' : 'Home', path: routes.home },
      { name: lang === 'tr' ? 'Özellikler' : 'Features', path: routes.features },
      { name: heading, path: lang === 'tr' ? page.tr : page.en }
    ];
  } else if (page.kind === 'solution') {
    const id = page.en.split('/').pop()!;
    heading = text(lang, `solutions.items.${id}.headline`);
    description = text(lang, `solutions.items.${id}.desc`);
    sections = stringList(lang, [
      'solutions.painsTitle',
      'solutions.usesTitle',
      'solutions.winsTitle'
    ]);
    breadcrumbs = [
      { name: lang === 'tr' ? 'Ana sayfa' : 'Home', path: routes.home },
      { name: lang === 'tr' ? 'Çözümler' : 'Solutions', path: routes.solutions },
      { name: text(lang, `solutions.items.${id}.name`), path: lang === 'tr' ? page.tr : page.en }
    ];
  }

  return {
    heading,
    description,
    sections,
    ...(faq ? { faq } : {}),
    ...(breadcrumbs ? { breadcrumbs } : {})
  };
}

for (const page of pages) {
  page.content = { tr: contentFor(page, 'tr'), en: contentFor(page, 'en') };
}

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'dist', 'public-pages.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `${JSON.stringify({ builtAt: new Date().toISOString(), pages }, null, 2)}\n`);
process.stdout.write(`public-pages.json: ${pages.length} pages\n`);
