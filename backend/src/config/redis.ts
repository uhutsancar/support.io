'use strict';

// Paylasilan Redis istemcisi.
//
// Socket.IO adapter'i kendi pub/sub ciftini kurar (kutuphane bunu sart kosar).
// Buradaki istemci ise komut calistiran diger tuketiciler icindir: bugun hiz
// siniri sayaclari, yarin onbellek veya kuyruk.
//
// Baglanti tembel kurulur ve HICBIR ZAMAN cagrani bloklamaz. Redis yoksa veya
// dusukse null doner; cagiran taraf kendi yedegine duser. Hiz siniri gibi bir
// yan sistem yuzunden tum API'nin durmasi, sinirin bir sure surec belleginde
// tutulmasindan cok daha kotudur.

// The client type as `createClient` is actually called here. ReturnType alone
// would instantiate the generics with their constraints rather than their
// defaults, which is a wider type than any real client.
import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient<{}, {}, {}, 3, {}>>;

let client: RedisClient | null = null;
let connecting: Promise<RedisClient | null> | null = null;

function isEnabled() {
  return Boolean(process.env.REDIS_URL);
}

// Cagiran her istekte await eder; ilk cagri baglantiyi baslatir, sonrakiler
// ayni sozu paylasir. Basarisiz olursa null doner ve bir sonraki cagri yeniden
// dener (Redis geri geldiginde kendiliginden toparlanmasi icin).
async function getRedisClient(): Promise<RedisClient | null> {
  if (!isEnabled()) return null;
  if (client?.isReady) return client;
  if (connecting) return connecting;

  connecting = (async () => {
    try {
      const instance = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000,
          reconnectStrategy: (retries: number) => Math.min(retries * 200, 5000)
        }
      });
      // Yakalanmayan 'error' olayi süreci düşürür.
      instance.on('error', (error: Error) => console.error('[redis:shared]', error.message));
      await instance.connect();
      client = instance;
      return client;
    } catch (error) {
      console.error('[redis:shared] Baglanti kurulamadi:', error.message);
      client = null;
      return null;
    } finally {
      connecting = null;
    }
  })();

  return connecting;
}

async function closeRedisClient() {
  if (client) {
    await client.quit().catch(() => {});
    client = null;
  }
}

export { getRedisClient, closeRedisClient, isEnabled };