'use strict';

// Çok süreçli yayın doğrulaması.
//
// Socket.IO'nun varsayılan adapter'ı olayları yalnızca kendi süreç belleğinde
// tutar. İki backend süreci çalıştığında, A sürecine bağlı bir ziyaretçinin
// mesajı B sürecine bağlı temsilciye ulaşmaz — sohbet sessizce yarılanır ve
// bu, tek süreçte kalmayı zorunlu kılan asıl ölçekleme tavanıdır.
//
// Bu betik iki ayrı porttaki backend'e bağlanır:
//   * ziyaretçi  -> A süreci  (/widget)
//   * temsilci   -> B süreci  (/admin)
// ve ziyaretçinin mesajının diğer sürece geçip geçmediğini ölçer.
//
// Kullanım (iki backend ayrı portlarda çalışıyor olmalı):
//   node scripts/multiprocess-check.js --a 5000 --b 5010

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import { io } from 'socket.io-client';


function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const PORT_A = arg('a', '5000');
const PORT_B = arg('b', '5010');
const URL_A = `http://127.0.0.1:${PORT_A}`;
const URL_B = `http://127.0.0.1:${PORT_B}`;

const DEMO_OWNER = { email: 'owner@demo.support.io', password: 'Demo1234!' };

async function main() {
  // Temsilci oturumu A üzerinden açılır; token her iki süreçte de geçerlidir.
  const loginRes = await fetch(`${URL_A}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(DEMO_OWNER)
  });
  if (!loginRes.ok) throw new Error(`Giriş başarısız (${loginRes.status}). Önce: npm run db:seed`);
  const { token } = (await loginRes.json()) as { token: string };

  const sitesRes = await fetch(`${URL_A}/api/sites`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { sites } = (await sitesRes.json()) as { sites: any[] };
  const site = sites.find((s: any) => s.siteKey === 'demo-site-key-0000-1111-2222') || sites[0];
  if (!site) throw new Error('Site yok. Önce: npm run db:seed');

  console.log(`Ziyaretçi -> ${URL_A}/widget`);
  console.log(`Temsilci  -> ${URL_B}/admin`);
  console.log(`Site      : ${site.name}\n`);

  // 1) Temsilci B sürecine bağlanır ve sitenin odasına girer.
  const admin = io(`${URL_B}/admin`, {
    transports: ['websocket'],
    auth: { token },
    forceNew: true
  });
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('admin bağlanamadı')), 15000);
    admin.on('connect', () => {
      clearTimeout(t);
      resolve();
    });
    admin.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
  admin.emit('join-site', { siteId: site._id });
  console.log('1) temsilci B sürecine bağlandı');

  // Yayının diğer süreçten gelmesini bekleyen söz.
  const crossProcess = new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), 12000);
    admin.on('new-message', (payload) => {
      if (payload?.message?.senderType === 'visitor') {
        clearTimeout(t);
        resolve(payload.message.content);
      }
    });
  });

  // 2) Ziyaretçi A sürecine bağlanır ve mesaj gönderir.
  const visitorId = `mp-${Date.now()}`;
  const marker = `Cok surec testi ${Date.now()}`;
  const visitor = io(`${URL_A}/widget`, { transports: ['websocket'], forceNew: true });

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('widget join zaman aşımı')), 15000);
    visitor.on('connect', () => {
      visitor.emit('join-conversation', {
        siteKey: site.siteKey,
        visitorId,
        visitorName: 'Çok Süreç Testi',
        currentPage: '/',
        metadata: { country: 'TR' }
      });
    });
    visitor.once('conversation-joined', () => {
      clearTimeout(t);
      resolve();
    });
    visitor.on('connect_error', (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
  console.log('2) ziyaretçi A sürecine bağlandı');

  visitor.emit('send-message', { content: marker, senderName: 'Çok Süreç Testi' });
  console.log('3) ziyaretçi A üzerinden mesaj gönderdi');

  const received = await crossProcess;

  visitor.close();
  admin.close();

  console.log('');
  if (received === marker) {
    console.log('SONUÇ: BAŞARILI — mesaj A sürecinden B sürecine ulaştı.');
    console.log('       Redis adapter çalışıyor, backend çoğaltılabilir.');
    process.exit(0);
  } else {
    console.log('SONUÇ: BAŞARISIZ — mesaj diğer sürece ulaşmadı.');
    console.log('       Adapter devre dışı; bu kurulumda backend tek süreçte kalmalı.');
    process.exit(1);
  }
}

main().catch((e: any) => {
  console.error('Hata:', e.message);
  process.exit(1);
});
