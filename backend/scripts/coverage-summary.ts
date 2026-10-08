// The coverage of the modules that guard money and access (plan v10 TST-02).
//
// Reads c8's json-summary (coverage/coverage-summary.json) and prints the
// line coverage of the security and billing modules, with the whole
// codebase for context, as a Markdown table (CI appends it to the job
// summary). Visibility, not a gate: the target is 80 % per module, and a
// module under it is marked, not failed.
//
//   npx tsx scripts/coverage-summary.ts [coverage/coverage-summary.json]

import fs from 'fs';
import path from 'path';

const TARGET = 80;

const GROUPS: Record<string, string[]> = {
  Security: [
    'src/config/tokens.ts',
    'src/config/secretBox.ts',
    'src/config/session.ts',
    'src/config/passwords.ts',
    'src/config/logger.ts',
    'src/middleware/auth.ts',
    'src/middleware/rbac.ts',
    'src/middleware/csp.ts',
    'src/middleware/rateLimit.ts',
    'src/middleware/widgetSession.ts',
    'src/http/guards.ts',
    'src/services/mfa.ts',
    'src/services/visitorBlocks.ts',
    'src/services/secretRotation.ts',
    'src/socket/auth.ts',
    'src/socket/schema.ts'
  ],
  Billing: [
    'src/services/billing.ts',
    'src/services/entitlements.ts',
    'src/services/planOverage.ts',
    'src/services/paddlePrices.ts',
    'src/services/paddleInvoices.ts',
    'src/routes/billing.ts',
    'src/domain/subscription.ts',
    'src/domain/plans.ts'
  ]
};

interface Totals {
  lines: { total: number; covered: number; pct: number };
}

const file = process.argv[2] || 'coverage/coverage-summary.json';
const summary = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Totals>;
const root = path.resolve(__dirname, '..');

/** The entry for a repo-relative path, whatever form c8 wrote the key in. */
function entry(rel: string): Totals | undefined {
  const want = path.join(root, rel).toLowerCase().split(path.sep).join('/');
  for (const [key, value] of Object.entries(summary)) {
    if (key === 'total') continue;
    if (key.toLowerCase().split(path.sep).join('/').replace(/\\/g, '/') === want) return value;
  }
  return undefined;
}

const lines: string[] = [];
lines.push('| Module | Lines | Covered |', '|---|---:|---:|');
const total = summary.total.lines;
lines.push(`| **All of src/** | ${total.total} | ${total.pct.toFixed(1)} % |`);
const under: string[] = [];
for (const [group, files] of Object.entries(GROUPS)) {
  let all = 0;
  let covered = 0;
  const rows: string[] = [];
  for (const rel of files) {
    const e = entry(rel);
    if (!e) {
      rows.push(`| ${rel} | — | not run |`);
      under.push(rel);
      continue;
    }
    all += e.lines.total;
    covered += e.lines.covered;
    const mark = e.lines.pct < TARGET ? ' ⚠' : '';
    if (e.lines.pct < TARGET) under.push(rel);
    rows.push(`| ${rel} | ${e.lines.total} | ${e.lines.pct.toFixed(1)} %${mark} |`);
  }
  const pct = all ? (covered / all) * 100 : 0;
  lines.push(`| **${group}** | ${all} | **${pct.toFixed(1)} %** |`, ...rows);
}
lines.push(
  '',
  `Target ${TARGET} % per module; under it: ${under.length ? under.join(', ') : 'none'}.`
);
console.log(lines.join('\n'));
