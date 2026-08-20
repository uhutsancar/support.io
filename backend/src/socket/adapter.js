'use strict';

// Socket.IO yatay ölçekleme adapter'ı.
//
// Varsayılan Socket.IO adapter'ı olayları yalnızca kendi süreç belleğinde
// tutar. Backend iki sürece çıkarıldığında, A sürecine bağlı bir ziyaretçinin
// mesajı B sürecine bağlı temsilciye hiç ulaşmaz — sohbet sessizce yarılanır.
// Bu, yüksek trafikte tek süreçte kalmayı zorunlu kılan asıl tavandı.
//
// REDIS_URL tanımlıysa yayın Redis pub/sub üzerinden yapılır ve backend
// istenildiği kadar sürece çoğaltılabilir. Tanımsızsa hiçbir şey değişmez:
// tek süreç, bugünkü davranış, ek bağımlılık yok.

const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

let clients = [];

async function attachRedisAdapter(io) {
  const url = process.env.REDIS_URL;
  if (!url) {
    return { enabled: false, reason: 'REDIS_URL tanımlı değil (tek süreç modu)' };
  }

  try {
    const pubClient = createClient({
      url,
      socket: {
        // Redis geçici olarak düşerse süreç ölmemeli; artan aralıklarla
        // yeniden dener ve bu sırada sunucu ayakta kalır.
        reconnectStrategy: (retries) => Math.min(retries * 200, 5000)
      }
    });
    const subClient = pubClient.duplicate();

    // Bağlantı koptuğunda 'error' yayılır; yakalanmazsa süreci düşürür.
    pubClient.on('error', (err) => console.error('[redis:pub]', err.message));
    subClient.on('error', (err) => console.error('[redis:sub]', err.message));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    clients = [pubClient, subClient];

    return { enabled: true, url: url.replace(/\/\/.*@/, '//***@') };
  } catch (error) {
    // Redis'e ulaşılamıyorsa tek süreç modunda devam edilir. Sunucunun hiç
    // açılmaması, ölçeklenememesinden daha kötüdür.
    console.error('[redis] Adapter kurulamadı, tek süreç modunda devam ediliyor:', error.message);
    return { enabled: false, reason: error.message };
  }
}

async function closeRedisAdapter() {
  await Promise.all(clients.map((c) => c.quit().catch(() => {})));
  clients = [];
}

module.exports = { attachRedisAdapter, closeRedisAdapter };
