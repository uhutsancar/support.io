'use strict';

// Kosum ortami dogrulamasi.
//
// Bu paket iki ayri kanaldan konusur: HTTP ile calisan backend'e ve dogrudan
// SQL ile veritabanina. Ikisi ayni veritabanini gostermezse testler kurduklari
// satirlari API'nin hic gormedigi bir yere yazar ve hata "foreign key ihlali"
// gibi tamamen alakasiz bir yerden patlar — kaybedilen zamanin buyuk kismi
// bunu tekrar tekrar tesis etmeye gider.
//
// Bu dosya o durumu, ne yapilmasi gerektigini soyleyen tek bir hatayla yakalar.
//
// Gercek bir vaka: bu is istasyonunda 5432'de yerel bir PostgreSQL 18 kurulu
// ve konteynerin yayinladigi portu golgeliyordu. Host'tan yapilan SQL yerel
// sunucuya, backend'inki konteyner sunucusuna gidiyordu.

import dotenv from 'dotenv';
import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db/pool';

dotenv.config();

const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

test('the API under test and this suite share one database', async () => {
  const health = await fetch(`${BASE}/health`).catch((error: any) => {
    assert.fail(
      `${BASE} adresinde backend yok (${error.message}).\n` +
      `Baslatmak icin: docker compose up -d\n` +
      `Baska bir adres icin: E2E_BASE_URL=http://host:port npm test`
    );
  });
  assert.ok(health.ok, `${BASE}/health saglikli degil: HTTP ${health.status}`);

  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `preflight${stamp}@preflight.test`;
  const registration = await fetch(`${BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'preflight',
      email,
      password: 'E2ePassw0rd!',
      companyName: 'preflight co'
    })
  });
  assert.ok(
    registration.ok,
    `Kayit ucu HTTP ${registration.status} dondu. 429 ise hiz siniri kotasi ` +
    `dolmustur: gelistirme yiginini REGISTER_RATE_MAX ile calistirin.`
  );

  // API'nin az once yazdigi satir bu paketin havuzundan gorunuyor mu?
  const seen = await query('SELECT 1 FROM users WHERE email = $1', [email]);
  assert.equal(
    seen.rowCount,
    1,
    'Backend ile bu paket AYRI veritabanlarina bakiyor.\n' +
    `  Bu paketin havuzu : ${describePool()}\n` +
    `  Backend           : ${BASE}\n` +
    'Ikisini ayni veritabanina yoneltin. Compose yigini icin:\n' +
    "  DATABASE_URL='postgresql://support_user:supportchat@localhost:5433/supportchat' npm test"
  );
});

function describePool() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL.replace(/\/\/[^@]*@/, '//***@');
  }
  return `${process.env.DB_HOST}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME}`;
}
