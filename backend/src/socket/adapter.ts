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

/** What the boot log needs to know about the adapter. */
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import type { Server } from 'socket.io';
import type { RedisClient } from '../config/redis';
import { errorText } from '../http/errors';

export type AdapterStatus = { enabled: true; url: string } | { enabled: false; reason: string };

let clients: RedisClient[] = [];

async function attachRedisAdapter(io: Server): Promise<AdapterStatus> {
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

  let pubClient: RedisClient | undefined;
  let subClient: RedisClient | undefined;
  try {
    pubClient = createClient({
      url,
      disableOfflineQueue: true,
      socket: {
        connectTimeout: connectTimeoutMs,
        // Redis geçici olarak düşerse süreç ölmemeli; artan aralıklarla
        // yeniden dener ve bu sırada sunucu ayakta kalır.
        reconnectStrategy: (retries: number) => Math.min(retries * 200, 5000)
      }
    });
    subClient = pubClient.duplicate({ disableOfflineQueue: false });

    // Adapter publish() sözlerini beklemez. Redis düşükken her yayın
    // kuyrukta zaman aşımına uğrar ve yakalanmamış ret olarak loga düşerdi.
    // Bu sürecin kendi istemcilerine yayın Redis'ten bağımsız sürer; yalnızca
    // diğer süreçlere gidecek kopya kaybolur, o da Redis yokken zaten
    // gidemez. Kuyruk kapalı: kesinti boyunca yayın biriktirilmez.
    const publish = pubClient.publish.bind(pubClient);
    Object.defineProperty(pubClient, 'publish', {
      value: (...args: Parameters<typeof publish>) => publish(...args).catch(() => 0)
    });

    // Bağlantı koptuğunda 'error' yayılır; yakalanmazsa süreci düşürür.
    // Yeniden bağlanma her denemede hata yayar; kesinti başına tek satır
    // yazılır, geri gelince de bir satır.
    for (const [name, c] of [
      ['pub', pubClient],
      ['sub', subClient]
    ] as const) {
      let down = false;
      c.on('error', (err: Error) => {
        if (down) return;
        down = true;
        console.error(`[redis:${name}]`, err.message);
      });
      c.on('ready', () => {
        if (down) console.log(`[redis:${name}] yeniden bağlandı`);
        down = false;
      });
    }

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
    console.error(
      '[redis] Adapter kurulamadı, tek süreç modunda devam ediliyor:',
      errorText(error)
    );
    // Yarım kalan istemciler arkada yeniden bağlanmayı denemeye devam eder ve
    // sonsuz hata logu üretir; kapatılmaları gerekir.
    await Promise.all(
      [pubClient, subClient]
        .filter((c): c is RedisClient => Boolean(c))
        .map((c) => c.disconnect().catch(() => {}))
    );
    return { enabled: false, reason: errorText(error) };
  }
}

async function closeRedisAdapter(): Promise<void> {
  // Redis düşükken close() gönderilemeyen komutları bekler ve kapanışı
  // zaman aşımına kadar uzatır; hazır olmayan istemci doğrudan bırakılır.
  await Promise.all(
    clients.map((c) => (c.isReady ? c.close().catch(() => c.destroy()) : c.destroy()))
  );
  clients = [];
}

export { attachRedisAdapter, closeRedisAdapter };
