// Turkish and English must carry the same keys (plan v10 UX-06).
//
// i18next falls back to Turkish for a key English lacks, so a missing
// translation does not break anything visibly — it shows Turkish text to an
// English reader, which is exactly why it needs a check. Compared pairwise,
// each file against its twin, the way src/i18n.ts merges them:
//
//   locales/tr.ts            ↔ locales/en.ts
//   locales/marketing.tr.ts  ↔ locales/marketing.en.ts
//   locales/pages.tr.ts      ↔ locales/pages.en.ts
//   locales/account.tr.ts    ↔ locales/account.en.ts
//
// Arrays are leaves: their items are content, and the two languages may
// legitimately list a different number of examples.
//
//   npx tsx scripts/check-locales.ts

import tr from '../src/locales/tr';
import en from '../src/locales/en';
import marketingTr from '../src/locales/marketing.tr';
import marketingEn from '../src/locales/marketing.en';
import pagesTr from '../src/locales/pages.tr';
import pagesEn from '../src/locales/pages.en';
import accountTr from '../src/locales/account.tr';
import accountEn from '../src/locales/account.en';

type Tree = Record<string, unknown>;

const isTree = (value: unknown): value is Tree =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function leaves(tree: Tree, prefix = ''): Set<string> {
  const out = new Set<string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isTree(value)) for (const leaf of leaves(value, path)) out.add(leaf);
    else out.add(path);
  }
  return out;
}

let problems = 0;
for (const [name, a, b] of [
  ['tr.ts / en.ts', tr, en],
  ['marketing.tr.ts / marketing.en.ts', marketingTr, marketingEn],
  ['pages.tr.ts / pages.en.ts', pagesTr, pagesEn],
  ['account.tr.ts / account.en.ts', accountTr, accountEn]
] as const) {
  const left = leaves(a as Tree);
  const right = leaves(b as Tree);
  const onlyTr = [...left].filter((k) => !right.has(k));
  const onlyEn = [...right].filter((k) => !left.has(k));
  if (onlyTr.length || onlyEn.length) {
    problems += onlyTr.length + onlyEn.length;
    console.error(`\n${name}`);
    for (const k of onlyTr) console.error(`  missing in English: ${k}`);
    for (const k of onlyEn) console.error(`  missing in Turkish: ${k}`);
  }
}

if (problems) {
  console.error(`\n${problems} key(s) exist in one language only.`);
  process.exit(1);
}
console.log('Locales: Turkish and English have the same keys.');
