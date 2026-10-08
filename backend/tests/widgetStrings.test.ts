'use strict';

// The widget's own words carry the same keys in Turkish and English (plan v10
// UX-06): a key one language lacks shows `undefined` on a customer's page.
// The widget is one script with no exports, so its STRINGS table is read
// from the source and evaluated on its own.
//
// Run: npx tsx --test tests/widgetStrings.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function stringsTable(): Record<string, Record<string, unknown>> {
  const source = fs.readFileSync(path.join(__dirname, '../src/widget/widget.ts'), 'utf8');
  const start = source.indexOf('var STRINGS = {');
  assert.ok(start >= 0, 'STRINGS table not found in widget.ts');
  const open = source.indexOf('{', start);
  let depth = 0;
  let end = open;
  let quote: string | null = null;
  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (ch === '\\') i += 1;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch;
    else if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  // eslint-disable-next-line no-new-func
  return new Function(`return (${source.slice(open, end + 1)});`)();
}

test('the widget speaks Turkish and English with the same keys, none empty', () => {
  const { tr, en } = stringsTable();
  const trKeys = Object.keys(tr).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(
    trKeys.filter((k) => !enKeys.includes(k)),
    [],
    'keys only in Turkish'
  );
  assert.deepEqual(
    enKeys.filter((k) => !trKeys.includes(k)),
    [],
    'keys only in English'
  );
  for (const [lang, table] of [
    ['tr', tr],
    ['en', en]
  ] as const) {
    for (const [key, value] of Object.entries(table)) {
      assert.ok(typeof value === 'string' && value.trim(), `${lang}.${key} is empty`);
    }
  }
  assert.ok(trKeys.length > 50, `only ${trKeys.length} keys found: the table was not read whole`);
});
