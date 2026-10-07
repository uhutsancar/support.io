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

// Compose yayinlanan portu ve Paddle degerlerini kok .env'den alir; burada da
// ayni dosyayi okuyoruz, yoksa testler yigin baska bir porttaysa bos adrese
// gider ya da webhook'lari backend'in bilmedigi bir anahtarla imzalar.
function rootEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  const envFile = path.join(__dirname, '../../.env');
  const line = fs.existsSync(envFile)
    ? fs
        .readFileSync(envFile, 'utf8')
        .split(/\r?\n/)
        .find((l) => l.startsWith(`${name}=`))
    : undefined;
  return line ? line.slice(name.length + 1).trim() : undefined;
}

// The Paddle defaults are the ones docker-compose.yml gives the backend when
// the root .env sets none.
const defaults = {
  DATABASE_URL: 'postgresql://support_user:supportchat@localhost:5433/supportchat',
  E2E_BASE_URL: `http://localhost:${rootEnv('BACKEND_PORT') || '5000'}`,
  PADDLE_WEBHOOK_SECRET: rootEnv('PADDLE_WEBHOOK_SECRET') || 'local-dev-paddle-webhook-secret',
  PADDLE_PRICE_PRO: rootEnv('PADDLE_PRICE_PRO') || 'pri_local_pro',
  PADDLE_PRICE_ENTERPRISE: rootEnv('PADDLE_PRICE_ENTERPRISE') || 'pri_local_enterprise',
  // Suites that delete files in-process (retention, account deletion) must
  // reach the same disk as the stack, never a real bucket whose keys sit in
  // backend/.env.
  UPLOAD_STORAGE: 'local'
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) process.env[key] = value;
}

console.log(`e2e hedefi : ${process.env.E2E_BASE_URL}`);
console.log(`veritabani : ${String(process.env.DATABASE_URL).replace(/\/\/[^@]*@/, '//***@')}\n`);

// Bir betik verilirse (npm run loadtest) test paketi yerine o, ayni ortamla
// ve kalan argumanlarla calisir.
const [script, ...rest] = process.argv.slice(2);
const child = spawn(
  process.execPath,
  // Testler TypeScript; tsx olmadan node bu dosyalari calistiramaz.
  script
    ? ['--import', 'tsx', script, ...rest]
    : ['--import', 'tsx', '--test', 'tests/**/*.test.ts'],
  { stdio: 'inherit', env: process.env }
);
child.on('exit', (code) => process.exit(code ?? 1));
