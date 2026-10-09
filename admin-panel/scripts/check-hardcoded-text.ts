// Text a person reads must come from the locale files (plan v10 UX-06): a
// sentence written straight into a component shows Turkish to an English
// reader, or the other way round.
//
// This finds Turkish words written in .tsx files outside the locales —
// JSX text and string literals with Turkish letters — skipping comments,
// the fallback argument of t('key', 'fallback') (the key is checked by
// check-locales.ts) and the files listed below. English text is not
// detectable this way; review catches that.
//
// Existing occurrences are recorded per file in hardcoded-text.baseline.json;
// the check fails when a file has more than its baseline, so the number only
// goes down. After removing some, run with --update to lower the baseline.
//
//   npx tsx scripts/check-hardcoded-text.ts [--update] [--list]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, '..', 'src');
const BASELINE = path.join(here, 'hardcoded-text.baseline.json');

/** Content that is Turkish on purpose: demo data, the Turkish-only page. */
const SKIP = [/^locales\//, /\.test\.tsx?$/, /^pages\/docs\/content\.ts$/];

const TURKISH = /[çğışöüÇĞİŞÖÜ]/;

function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return files(full);
    return /\.tsx$/.test(entry.name) ? [full] : [];
  });
}

/** The source with comments and t('key', 'fallback') fallbacks blanked out. */
function scrub(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:'"`])\/\/.*$/gm, (m, lead: string) => lead + ' '.repeat(m.length - lead.length))
    .replace(/\bt\(\s*(['"`])[^'"`]*\1\s*,\s*(['"`])(?:\\.|(?!\2).)*\2/g, (m) =>
      m.replace(/[^\n]/g, ' ')
    );
}

function findings(file: string): string[] {
  const raw = fs.readFileSync(file, 'utf8').split('\n');
  const lines = scrub(raw.join('\n')).split('\n');
  const out: string[] = [];
  lines.forEach((line, i) => {
    // Marked as meant: a language's own name, demo data inside a mockup.
    if (/i18n-ignore/.test(raw[i]) || /i18n-ignore/.test(raw[i - 1] ?? '')) return;
    // String literals, text between JSX tags on one line, and a line of JSX
    // text on its own (prettier breaks long text out of its tags).
    const own = /^[^<>=;'"`]+$/.test(line.trim()) ? [line.trim()] : [];
    const pieces = [
      ...line.matchAll(/(['"`])((?:\\.|(?!\1).)*)\1/g),
      ...line.matchAll(/>([^<>{}]+)</g)
    ]
      .map((m) => m[2] ?? m[1])
      .concat(own);
    for (const piece of pieces) {
      if (piece && TURKISH.test(piece)) out.push(`${i + 1}: ${piece.trim().slice(0, 80)}`);
    }
  });
  return out;
}

const counts: Record<string, number> = {};
const listing: string[] = [];
for (const file of files(SRC)) {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  if (SKIP.some((rx) => rx.test(rel))) continue;
  const found = findings(file);
  if (found.length) {
    counts[rel] = found.length;
    for (const f of found) listing.push(`${rel}:${f}`);
  }
}

if (process.argv.includes('--list')) console.log(listing.join('\n'));

if (process.argv.includes('--update')) {
  fs.writeFileSync(BASELINE, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(
    `Baseline written: ${Object.values(counts).reduce((a, b) => a + b, 0)} occurrence(s).`
  );
  process.exit(0);
}

const baseline: Record<string, number> = fs.existsSync(BASELINE)
  ? JSON.parse(fs.readFileSync(BASELINE, 'utf8'))
  : {};
const worse = Object.entries(counts).filter(([file, n]) => n > (baseline[file] ?? 0));
const total = Object.values(counts).reduce((a, b) => a + b, 0);
if (worse.length) {
  console.error('Text written into components instead of the locale files (UX-06):');
  for (const [file, n] of worse) {
    console.error(`  ${file}: ${n} (allowed ${baseline[file] ?? 0})`);
    for (const line of listing.filter((l) => l.startsWith(`${file}:`)))
      console.error(`    ${line}`);
  }
  process.exit(1);
}
console.log(`Hard-coded text: ${total} occurrence(s), none above the baseline.`);
