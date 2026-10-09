// Prepares the install channels for publishing once the production domain is
// known (SAHİP-05): copies the WordPress plugin, the GTM template and the
// Shopify extension to integrations/dist/ with __APP_DOMAIN__ replaced.
//
//   node integrations/release.mjs support.example.com
//
// Nothing here is published; see integrations/README.md for the owner's steps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const domain = (process.argv[2] || '').trim().toLowerCase();

if (!/^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(domain)) {
  console.error('usage: node integrations/release.mjs <production domain, e.g. support.example.com>');
  process.exit(1);
}

const SOURCES = [
  'wordpress/support-io-live-chat',
  'gtm',
  'shopify/extensions/support-io-chat'
];
const TEXT = /\.(php|txt|tpl|yaml|liquid|json|toml)$/;
const dist = path.join(here, 'dist');
fs.rmSync(dist, { recursive: true, force: true });

for (const source of SOURCES) {
  const from = path.join(here, source);
  for (const file of fs.readdirSync(from, { recursive: true })) {
    const src = path.join(from, file);
    if (fs.statSync(src).isDirectory()) continue;
    const dest = path.join(dist, source, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    if (!TEXT.test(file)) {
      fs.copyFileSync(src, dest);
      continue;
    }
    const text = fs.readFileSync(src, 'utf8').replaceAll('__APP_DOMAIN__', domain);
    if (text.includes('__APP_DOMAIN__')) throw new Error(`placeholder left in ${dest}`);
    fs.writeFileSync(dest, text);
  }
}

console.log(`integrations/dist/ is ready for ${domain}:`);
for (const source of SOURCES) console.log(`  ${source}`);
console.log('GTM: put the gallery commit in metadata.yaml (__TEMPLATE_COMMIT__) when publishing.');
