// Copies the files the compiled server reads at runtime but tsc does not emit.
//
// src/db/migrate.ts reads its migrations from a directory next to itself, so
// the SQL files have to sit beside the compiled module too. Without this the
// production image starts and then fails on the first migration, where it is
// least convenient to notice. The same goes for the word lists the password
// and sign-up policies read (src/config/data).

import fs from 'fs';
import path from 'path';

const DIRECTORIES: Array<{ from: string; to: string; ext: string }> = [
  { from: 'src/db/migrations', to: 'dist/db/migrations', ext: '.sql' },
  { from: 'src/config/data', to: 'dist/config/data', ext: '.txt' }
];

for (const dir of DIRECTORIES) {
  const source = path.resolve(dir.from);
  const target = path.resolve(dir.to);
  fs.mkdirSync(target, { recursive: true });
  for (const name of fs.readdirSync(source).filter((n) => n.endsWith(dir.ext))) {
    fs.copyFileSync(path.join(source, name), path.join(target, name));
    console.log(`copied ${dir.from}/${name} -> ${dir.to}/${name}`);
  }
}
