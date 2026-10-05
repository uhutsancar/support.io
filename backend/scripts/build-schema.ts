// `npm run db:schema` — regenerates src/db/schema.sql from the migrations.
// `npm run db:schema -- --check` exits 1 when the file is out of date (CI).
//
// schema.sql is the whole schema in one readable file: what a fresh database
// ends up with after every migration ran. It is generated, never executed and
// never edited by hand — src/db/migrations is the source of truth.

import fs from 'fs';
import path from 'path';
import { loadMigrations } from '../src/db/migrate';

const TARGET = path.join(__dirname, '../src/db/schema.sql');

const HEADER = `-- GENERATED FILE — do not edit. Source: src/db/migrations/*.sql
-- Regenerate with \`npm run db:schema\`; CI fails when it is out of date.
--
-- The schema a fresh database ends up with: every migration, in order.
-- Applying it is the job of src/db/migrate.ts, which records each version in
-- schema_migrations; this file is for reading.
`;

function build(): string {
  const parts = loadMigrations().map(
    (m) =>
      `\n-- ===========================================================================\n-- ${m.file}\n-- ===========================================================================\n${m.sql.trimEnd()}\n`
  );
  return HEADER + parts.join('');
}

const expected = build();
if (process.argv.includes('--check')) {
  const current = fs.existsSync(TARGET)
    ? fs.readFileSync(TARGET, 'utf8').replace(/\r\n/g, '\n')
    : '';
  if (current !== expected) {
    console.error('src/db/schema.sql is out of date. Run: npm run db:schema');
    process.exit(1);
  }
  console.log('src/db/schema.sql is up to date.');
} else {
  fs.writeFileSync(TARGET, expected);
  console.log(`wrote ${path.relative(process.cwd(), TARGET)}`);
}
