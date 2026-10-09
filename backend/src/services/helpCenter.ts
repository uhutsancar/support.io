// A site's public help center (plan v10 PRD-10): its active FAQ entries at
// /help/<slug>, grouped by category, searchable, readable without
// JavaScript and by search engines — or kept out of them when the owner
// asks (noindex). Written on the server: one small page, no panel bundle.
//
// Everything on it is the site owner's text, escaped; links in an answer
// become links only when they are http(s), and carry rel="nofollow".

import { query } from '../db/pool';
import { limitsFor } from './entitlements';

export interface HelpCenterSettings {
  enabled: boolean;
  noindex: boolean;
  title: string | null;
  language: 'tr' | 'en';
}

export function helpCenterSettings(stored: unknown): HelpCenterSettings {
  const raw = (stored && typeof stored === 'object' ? stored : {}) as Record<string, unknown>;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 80) : '';
  return {
    enabled: raw.enabled === true,
    noindex: raw.noindex === true,
    title: title || null,
    language: raw.language === 'en' ? 'en' : 'tr'
  };
}

/** The public address of a site's help center, when it is on. */
export function helpCenterUrl(
  site: { helpSlug?: string | null; helpCenter?: unknown },
  base: string
): string | null {
  return site.helpSlug && helpCenterSettings(site.helpCenter).enabled
    ? `${base}/help/${site.helpSlug}`
    : null;
}

/** 3–40 lower-case letters, digits and inner hyphens; the same rule as the database's. */
export const HELP_SLUG = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

const TURKISH: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

/** An address made from the site's name: "Örnek Mağaza" → "ornek-magaza". */
export function suggestSlug(name: string): string {
  const slug = name
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => TURKISH[c] ?? c)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
  return HELP_SLUG.test(slug) ? slug : `yardim-${slug || 'merkezi'}`.slice(0, 40);
}

interface Article {
  id: string;
  question: string;
  answer: string;
  category: string;
}

/**
 * The words of a search as prefixes ("iadeler" → iade:*), OR-ed: Turkish
 * suffixes change the end of a word, and the stemmer alone gets some of them
 * wrong — it reads "iade" as "ia" plus a locative "-de". Four letters keep a
 * word's root and still tell words apart. Null when no word is long enough.
 */
export function prefixQuery(term: string): string | null {
  const words = term
    .toLocaleLowerCase('tr')
    .split(/[^0-9a-zçğıöşüâîû]+/)
    .filter((w) => w.length >= 3)
    .slice(0, 8)
    .map((w) => `${w.slice(0, 4)}:*`);
  return words.length ? [...new Set(words)].join(' | ') : null;
}

/** The site's active, site-wide entries; with `search`, the ones that match it, best first. */
export async function helpArticles(siteId: string, search?: string): Promise<Article[]> {
  const term = (search ?? '').trim().slice(0, 100);
  const params: unknown[] = [siteId];
  let match = '';
  let order = 'sort_order, created_at';
  if (term) {
    params.push(term, `%${term.replace(/([%_\\])/g, '\\$1')}%`, prefixQuery(term));
    match = ` AND (
        ($4::text IS NOT NULL AND search_vector @@ to_tsquery('simple'::regconfig, $4))
        OR to_tsvector('turkish'::regconfig, question || ' ' || answer || ' ' || array_to_string(keywords, ' '))
          @@ websearch_to_tsquery('turkish'::regconfig, $2)
        OR question ILIKE $3 OR answer ILIKE $3)`;
    // More of the words matched, and in the question, comes first.
    order = `CASE WHEN $4::text IS NULL THEN 0
                ELSE ts_rank(search_vector, to_tsquery('simple'::regconfig, $4)) END DESC,
             (question ILIKE $3) DESC, sort_order, created_at`;
  }
  const { rows } = await query<Article>(
    `SELECT id, question, answer, coalesce(nullif(category, ''), 'General') AS category
       FROM faqs
      WHERE site_id = $1 AND is_active AND page_specific = '*'${match}
      ORDER BY ${order}
      LIMIT 500`,
    params
  );
  return rows;
}

// ---------------------------------------------------------------- the page

const escape = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/** An answer as paragraphs, with its http(s) addresses as links. */
function answerHtml(answer: string): string {
  return answer
    .split(/\n{2,}/)
    .map((paragraph) => {
      const linked = escape(paragraph).replace(
        /\bhttps?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)]/g,
        (url) => `<a href="${url}" rel="nofollow noopener noreferrer" target="_blank">${url}</a>`
      );
      return `<p>${linked.replace(/\n/g, '<br>')}</p>`;
    })
    .join('');
}

/** Black or white, whichever reads better on the colour (WCAG luminance). */
function textOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#ffffff';
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return 1.05 / (luminance + 0.05) >= (luminance + 0.05) / 0.05 ? '#ffffff' : '#111827';
}

const WORDS = {
  tr: {
    help: 'Yardım Merkezi',
    search: 'Yardım konularında ara',
    searchButton: 'Ara',
    results: (n: number, q: string) => `“${q}” için ${n} sonuç`,
    none: 'Aradığınızı bulamadık. Başka kelimelerle deneyin ya da bize yazın.',
    empty: 'Henüz yardım konusu yok.',
    all: 'Tüm konular',
    contact: 'Sorunuzun cevabı burada yoksa sitemizden bize yazın:',
    general: 'Genel',
    powered: 'Support.io ile'
  },
  en: {
    help: 'Help Center',
    search: 'Search help articles',
    searchButton: 'Search',
    results: (n: number, q: string) => `${n} results for “${q}”`,
    none: 'Nothing matched. Try other words, or write to us.',
    empty: 'No help articles yet.',
    all: 'All articles',
    contact: 'If your question is not answered here, write to us on our site:',
    general: 'General',
    powered: 'Powered by Support.io'
  }
};

export interface HelpPageSite {
  id: string;
  name: string;
  domain: string;
  organizationId: string;
  slug: string;
  settings: HelpCenterSettings;
  primary: string;
  logo: string | null;
}

export async function renderHelpCenter(
  site: HelpPageSite,
  { search, base }: { search: string; base: string }
): Promise<string> {
  const words = WORDS[site.settings.language];
  const term = search.trim().slice(0, 100);
  const articles = await helpArticles(site.id, term);
  const branding = (await limitsFor(site.organizationId)).limits.branding;
  const title = site.settings.title || `${site.name} — ${words.help}`;
  const url = `${base}/help/${site.slug}`;
  const description =
    articles
      .slice(0, 3)
      .map((a) => a.question)
      .join(' · ')
      .slice(0, 155) || words.help;

  const groups = new Map<string, Article[]>();
  for (const article of articles) {
    const name = article.category === 'General' ? words.general : article.category;
    groups.set(name, [...(groups.get(name) ?? []), article]);
  }

  const structured = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: site.settings.language,
    mainEntity: articles.slice(0, 100).map((a) => ({
      '@type': 'Question',
      name: a.question,
      acceptedAnswer: { '@type': 'Answer', text: a.answer }
    }))
  };

  const header = textOn(site.primary);
  const sections = [...groups.entries()]
    .map(
      ([name, list]) => `
      <section aria-labelledby="c-${escape(list[0].id)}">
        <h2 id="c-${escape(list[0].id)}">${escape(name)}</h2>
        ${list
          .map(
            (a) => `
        <details id="a-${escape(a.id)}"${term ? ' open' : ''}>
          <summary>${escape(a.question)}</summary>
          <div class="answer">${answerHtml(a.answer)}</div>
        </details>`
          )
          .join('')}
      </section>`
    )
    .join('');

  const siteLink = /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(site.domain) ? `https://${site.domain}` : null;

  return `<!doctype html>
<html lang="${site.settings.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<meta name="description" content="${escape(description)}">
<link rel="canonical" href="${escape(url)}">
${site.settings.noindex || term ? '<meta name="robots" content="noindex, follow">' : ''}
<meta property="og:type" content="website">
<meta property="og:title" content="${escape(title)}">
<meta property="og:description" content="${escape(description)}">
<meta property="og:url" content="${escape(url)}">
<link rel="icon" href="/favicon.ico">
<script type="application/ld+json">${JSON.stringify(structured).replace(/</g, '\\u003c')}</script>
<style>
*{box-sizing:border-box}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#111827;background:#f9fafb;line-height:1.6}
header{background:${escape(site.primary)};color:${header};padding:40px 16px 56px}
.wrap{max-width:760px;margin:0 auto}
header .brand{display:flex;align-items:center;gap:12px;font-weight:600}
header img{max-height:40px;max-width:160px;border-radius:6px;background:#fff}
h1{font-size:30px;line-height:1.2;margin:18px 0 20px}
form{display:flex;gap:8px}
input[type=search]{flex:1;min-width:0;font:inherit;padding:12px 14px;border-radius:10px;border:1px solid #d1d5db;color:#111827;min-height:48px}
button{font:inherit;padding:0 18px;min-height:48px;border-radius:10px;border:0;background:#111827;color:#fff;cursor:pointer}
main{margin-top:-28px;padding:0 16px 48px}
.card{background:#fff;border:1px solid #e5e7eb;border-radius:14px;padding:8px 20px 20px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.note{color:#374151;margin:16px 0 0}
h2{font-size:18px;margin:24px 0 8px}
details{border-top:1px solid #e5e7eb}
details:first-of-type{border-top:0}
summary{cursor:pointer;padding:14px 0;font-weight:600;list-style-position:outside}
summary:focus-visible,a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
.answer{padding:0 0 14px;color:#374151}
.answer p{margin:0 0 10px}
a{color:#1d4ed8}
footer{max-width:760px;margin:0 auto;padding:0 16px 40px;color:#4b5563;font-size:14px}
footer .powered{display:inline-block;margin-top:12px;color:#4b5563}
</style>
</head>
<body>
<header>
  <div class="wrap">
    <div class="brand">${site.logo ? `<img src="${escape(site.logo)}" alt="">` : ''}<span>${escape(site.name)}</span></div>
    <h1>${escape(site.settings.title || words.help)}</h1>
    <form method="get" action="/help/${escape(site.slug)}" role="search">
      <input type="search" name="q" value="${escape(term)}" placeholder="${escape(words.search)}" aria-label="${escape(words.search)}" maxlength="100">
      <button type="submit">${escape(words.searchButton)}</button>
    </form>
  </div>
</header>
<main>
  <div class="wrap card">
    ${term ? `<p class="note" role="status">${escape(words.results(articles.length, term))} · <a href="/help/${escape(site.slug)}">${escape(words.all)}</a></p>` : ''}
    ${articles.length ? sections : `<p class="note">${escape(term ? words.none : words.empty)}</p>`}
  </div>
</main>
<footer>
  ${siteLink ? `<p>${escape(words.contact)} <a href="${escape(siteLink)}" rel="noopener">${escape(site.domain)}</a></p>` : ''}
  ${branding ? `<a class="powered" href="${escape(base)}/?ref=help-center" rel="noopener">${escape(words.powered)}</a>` : ''}
</footer>
</body>
</html>`;
}

/** The site behind a help center address, when its help center is on. */
export async function siteForHelpSlug(slug: string): Promise<HelpPageSite | null> {
  if (!HELP_SLUG.test(slug)) return null;
  const { rows } = await query<{
    id: string;
    name: string;
    domain: string;
    organization_id: string;
    help_slug: string;
    help_center: unknown;
    is_active: boolean;
    suspended_at: Date | null;
    blocked_at: Date | null;
    colors: { primary?: string } | null;
    branding: { logo?: string | null } | null;
  }>(
    `SELECT s.id, s.name, s.domain, s.organization_id, s.help_slug, s.help_center, s.is_active,
            s.suspended_at, s.blocked_at, w.colors, w.branding
       FROM sites s
       LEFT JOIN widget_configs w ON w.site_id = s.id
      WHERE lower(s.help_slug) = lower($1)
      LIMIT 1`,
    [slug]
  );
  const row = rows[0];
  if (!row || !row.is_active || row.suspended_at || row.blocked_at) return null;
  const settings = helpCenterSettings(row.help_center);
  if (!settings.enabled) return null;
  const primary = /^#[0-9a-f]{6}$/i.test(row.colors?.primary ?? '')
    ? row.colors!.primary!
    : '#4F46E5';
  const logo = row.branding?.logo;
  return {
    id: row.id,
    name: row.name,
    domain: row.domain,
    organizationId: row.organization_id,
    slug: row.help_slug,
    settings,
    primary,
    logo: typeof logo === 'string' && /^(https:\/\/|\/uploads\/)/.test(logo) ? logo : null
  };
}
