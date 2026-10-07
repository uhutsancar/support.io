// The site's public pages, Turkish and English pairs, written next to the
// build as dist/public-pages.json (plan v10 MKT-01, MKT-03). The backend
// turns it into /sitemap.xml with the domain it runs on (APP_BASE_URL), so
// one image serves staging and production with their own addresses.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marketingRoutes } from '../src/lib/marketingPaths';
import { FEATURE_IDS, SOLUTION_IDS } from '../src/pages/marketing/features';

const tr = marketingRoutes('tr');
const en = marketingRoutes('en');

const pages: Array<{ tr: string; en: string }> = [
  { tr: tr.home, en: en.home },
  { tr: tr.features, en: en.features },
  ...FEATURE_IDS.map((id) => ({ tr: tr.feature(id), en: en.feature(id) })),
  ...SOLUTION_IDS.map((id) => ({ tr: `${tr.solutions}/${id}`, en: `${en.solutions}/${id}` })),
  { tr: tr.pricing, en: en.pricing },
  { tr: tr.docs, en: en.docs },
  { tr: tr.about, en: en.about },
  { tr: tr.privacy, en: en.privacy },
  { tr: tr.terms, en: en.terms }
];
const unique = pages.filter((p, i) => pages.findIndex((q) => q.tr === p.tr) === i);

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'dist', 'public-pages.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(
  out,
  `${JSON.stringify({ builtAt: new Date().toISOString(), pages: unique }, null, 2)}\n`
);
process.stdout.write(`public-pages.json: ${unique.length} pages\n`);
