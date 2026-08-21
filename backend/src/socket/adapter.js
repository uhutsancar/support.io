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

  // REDIS_URL yanlış yazılmışsa (ör. ulaşılamayan bir host) reconnectStrategy
  // sonsuza kadar dener ve connect() hiç çözülmez — sunucu açılışta asılı
  // kalırdı. Açılış bir zaman aşımıyla yarıştırılır: Redis belirtilen süre
  // içinde cevap vermezse tek süreç moduna düşülür, süreç yine de dinlemeye
  // başlar.
  const connectTimeoutMs = Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000;

  let pubClient;
  let subClient;
  try {
    pubClient = createClient({
      url,
      socket: {
        connectTimeout: connectTimeoutMs,
        // Redis geçici olarak düşerse süreç ölmemeli; artan aralıklarla
        // yeniden dener ve bu sırada sunucu ayakta kalır.
        reconnectStrategy: (retries) => Math.min(retries * 200, 5000)
      }
    });
    subClient = pubClient.duplicate();

    // Bağlantı koptuğunda 'error' yayılır; yakalanmazsa süreci düşürür.
    pubClient.on('error', (err) => console.error('[redis:pub]', err.message));
    subClient.on('error', (err) => console.error('[redis:sub]', err.message));

    await Promise.race([
      Promise.all([pubClient.connect(), subClient.connect()]),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Redis ${connectTimeoutMs}ms içinde yanıt vermedi`)),
          connectTimeoutMs
        )
      )
    ]);

    io.adapter(createAdapter(pubClient, subClient));
    clients = [pubClient, subClient];

    return { enabled: true, url: url.replace(/\/\/.*@/, '//***@') };
  } catch (error) {
    // Redis'e ulaşılamıyorsa tek süreç modunda devam edilir. Sunucunun hiç
    // açılmaması, ölçeklenememesinden daha kötüdür.
    console.error('[redis] Adapter kurulamadı, tek süreç modunda devam ediliyor:', error.message);
    // Yarım kalan istemciler arkada yeniden bağlanmayı denemeye devam eder ve
    // sonsuz hata logu üretir; kapatılmaları gerekir.
    await Promise.all(
      [pubClient, subClient].filter(Boolean).map((c) => c.disconnect().catch(() => {}))
    );
    return { enabled: false, reason: error.message };
  }
}

async function closeRedisAdapter() {
  await Promise.all(clients.map((c) => c.quit().catch(() => {})));
  clients = [];
}

module.exports = { attachRedisAdapter, closeRedisAdapter };
