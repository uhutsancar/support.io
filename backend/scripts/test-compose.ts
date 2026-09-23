'use strict';

// `npm run test:compose` — e2e paketini docker-compose gelistirme yigina karsi
// calistirir.
//
// Kabuktan bagimsiz olmasi icin bir betik: PowerShell'de `VAR=x npm test`
// soz dizimi calismaz, bu yuzden degiskenleri burada kuruyoruz.
//
// Yigin postgres'i 5433'te yayinlar (docker-compose.yml'deki POSTGRES_PORT).
// Varsayilanlar yalnizca ortamda tanimli degilse uygulanir.

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// Compose yayinlanan portu .env'deki BACKEND_PORT'tan alir; burada da ayni
// dosyayi okuyoruz, yoksa testler yigin baska bir porttaysa bos adrese gider.
function backendPort(): string {
  if (process.env.BACKEND_PORT) return process.env.BACKEND_PORT;
  const envFile = path.join(__dirname, '../../.env');
  const line = fs.existsSync(envFile)
    ? fs
        .readFileSync(envFile, 'utf8')
        .split(/\r?\n/)
        .find((l) => l.startsWith('BACKEND_PORT='))
    : undefined;
  return line ? line.slice('BACKEND_PORT='.length).trim() : '5000';
}

const defaults = {
  DATABASE_URL: 'postgresql://support_user:supportchat@localhost:5433/supportchat',
  E2E_BASE_URL: `http://localhost:${backendPort()}`
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value;
}

console.log(`e2e hedefi : ${process.env.E2E_BASE_URL}`);
console.log(`veritabani : ${String(process.env.DATABASE_URL).replace(/\/\/[^@]*@/, '//***@')}\n`);

const child = spawn(
  process.execPath,
  // Testler TypeScript; tsx olmadan node bu dosyalari calistiramaz.
  ['--import', 'tsx', '--test', 'tests/**/*.test.ts'],
  { stdio: 'inherit', env: process.env }
);
child.on('exit', (code) => process.exit(code ?? 1));
