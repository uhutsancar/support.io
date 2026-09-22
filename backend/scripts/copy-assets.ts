// Copies the files the compiled server reads at runtime but tsc does not emit.
//
// src/db/migrate.ts resolves schema.sql next to itself, so the file has to sit
// beside the compiled module too. Without this the production image starts and
// then fails on the first boot, where it is least convenient to notice.

import fs from 'fs';
import path from 'path';

const ASSETS: Array<{ from: string; to: string }> = [
  { from: 'src/db/schema.sql', to: 'dist/db/schema.sql' }
];

for (const asset of ASSETS) {
  const source = path.resolve(asset.from);
  const target = path.resolve(asset.to);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  console.log(`copied ${asset.from} -> ${asset.to}`);
}
