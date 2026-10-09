'use strict';

// The widget's languages (plan v10 PRD-16): every file says everything the
// English one says, keeps its placeholders, and the word each one tells
// visitors to type for a person is one the assistant hands over on — while
// an ordinary question in that language is not taken for one.
//
// Run: npx tsx --test tests/widgetLocales.test.ts (no services needed)

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { wantsHuman } from '../src/services/assistant/policy';
import { WIDGET_LANGUAGES } from '../src/routes/widget';

const DIR = path.join(__dirname, '..', 'src', 'widget', 'locales');
const read = (code: string): Record<string, string> =>
  JSON.parse(fs.readFileSync(path.join(DIR, `${code}.json`), 'utf8'));
const en = read('en');
const codes = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => path.basename(f, '.json'))
  .sort();

test('the panel offers exactly the languages there are files for', () => {
  assert.deepEqual(
    WIDGET_LANGUAGES.filter((c) => c !== 'auto').sort(),
    codes,
    'routes/widget.ts WIDGET_LANGUAGES and src/widget/locales disagree'
  );
  assert.deepEqual(codes, ['ar', 'de', 'en', 'es', 'fr', 'nl', 'ru', 'tr']);
});

for (const code of codes) {
  test(`${code}: every text, no stray key, placeholders kept`, () => {
    const strings = read(code);
    assert.deepEqual(Object.keys(strings).sort(), Object.keys(en).sort());
    for (const [key, value] of Object.entries(strings)) {
      assert.equal(typeof value, 'string', key);
      assert.ok(value.trim().length > 0, `${code}.${key} is empty`);
      const wanted = (en[key].match(/\{\w+\}/g) || []).sort();
      const found = (value.match(/\{\w+\}/g) || []).sort();
      assert.deepEqual(found, wanted, `${code}.${key} placeholders`);
      assert.ok(!/<|>/.test(value), `${code}.${key} must be text, not markup`);
    }
    if (code !== 'en' && code !== 'tr') {
      const same = Object.keys(en).filter(
        (k) => strings[k] === en[k] && !['online', 'optional'].includes(k)
      );
      // A few words are spelled the same (Online, Messages…); most are not.
      assert.ok(same.length < 6, `${code} looks untranslated: ${same.join(', ')}`);
    }
  });
}

// What each language's aiNote tells the visitor to type.
const TYPE_FOR_A_PERSON: Record<string, string> = {
  tr: 'temsilci',
  en: 'agent',
  de: 'Mitarbeiter',
  fr: 'conseiller',
  es: 'agente',
  nl: 'medewerker',
  ru: 'оператор',
  ar: 'موظف'
};

test('the word the widget suggests reaches a person, in every language', () => {
  for (const code of codes) {
    const word = TYPE_FOR_A_PERSON[code];
    assert.ok(word, `no handoff word listed for ${code}`);
    assert.ok(read(code).aiNote.includes(word), `${code}.aiNote does not name "${word}"`);
    assert.equal(wantsHuman(word), true, `"${word}" (${code}) does not hand over`);
    assert.equal(wantsHuman(`${word}, bitte`), true);
  }
});

test('ordinary questions in those languages are not taken for a person', () => {
  for (const question of [
    'Wie lange dauert der Versand?',
    'Quels sont vos horaires d’ouverture ?',
    '¿Cuánto cuesta el envío a Madrid?',
    'Hoeveel mensen passen er aan een tafel?',
    'Столик на четырёх человек на субботу?',
    'كم شخصًا يتسع الجناح؟',
    'Mensup olduğum kulüp indirimi geçerli mi?'
  ]) {
    assert.equal(wantsHuman(question), false, question);
  }
});
