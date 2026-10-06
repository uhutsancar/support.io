'use strict';

// Paylasilan Redis istemcisi.
//
// Socket.IO adapter'i kendi pub/sub ciftini kurar (kutuphane bunu sart kosar).
// Buradaki istemci ise komut calistiran diger tuketiciler icindir: bugun hiz
// siniri sayaclari, yarin onbellek veya kuyruk.
//
// Baglanti tembel kurulur ve cagirani bloklamaz (yalnizca ilk baglanti,
// zaman asimiyla sinirli olarak beklenir). Redis yoksa veya dusukse null
// doner; cagiran taraf kendi yedegine duser. Hiz siniri gibi bir
// yan sistem yuzunden tum API'nin durmasi, sinirin bir sure surec belleginde
// tutulmasindan cok daha kotudur.

// The client type as `createClient` is actually called here. ReturnType alone
// would instantiate the generics with their constraints rather than their
// defaults, which is a wider type than any real client.
import { createClient } from 'redis';
import { errorText } from '../http/errors';
import { logger } from './logger';

// The generic slots are the client's module, function and script maps plus its
// RESP version. `{}` is the library's own default for the three maps — it means
// "nothing added" there, and substituting `Record<string, never>` makes the
// result incompatible with what `createClient()` actually returns, because the
// built-in modules no longer satisfy it. So the empty-object type is correct
// here specifically, and the lint rule that normally catches it is turned off
// for this one line rather than repaired into something that does not compile.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type RedisClient = ReturnType<typeof createClient<{}, {}, {}, 3, {}>>;

let client: RedisClient | null = null;
// Set only while the first connection is being awaited (bounded by the
// connect timeout); after that nobody waits for Redis again.
let firstConnect: Promise<void> | null = null;
let degraded = false;

function isEnabled() {
  return Boolean(process.env.REDIS_URL);
}

function connectTimeoutMs() {
  return Number(process.env.REDIS_CONNECT_TIMEOUT_MS) || 5000;
}

// Tek istemci kurulur ve omru boyunca ayni kalir: baglanti koparsa
// node-redis arkada kendisi yeniden baglanir. Bu sirada komutlar kuyrukta
// beklemez, hemen hata verir (disableOfflineQueue). Kuyruk acikken Redis
// dusukken gelen her istek (hiz siniri, onbellek) Redis geri gelene kadar
// asili kaliyordu.
function createShared(): RedisClient {
  const instance = createClient({
    url: process.env.REDIS_URL,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: connectTimeoutMs(),
      reconnectStrategy: (retries: number) => Math.min(retries * 200, 5000)
    }
  });
  // Yakalanmayan 'error' olayi süreci düşürür. Yeniden baglanma her denemede
  // hata yayar; kesinti basina tek satir yazilir.
  instance.on('error', (error: Error) => {
    if (degraded) return;
    degraded = true;
    logger.warn(
      { error: error.message },
      'Redis unreachable; rate limits and cache fall back to this process'
    );
  });
  instance.on('ready', () => {
    if (degraded) logger.info('Redis is back');
    degraded = false;
  });
  return instance;
}

// Hicbir zaman Redis'i beklemez (ilk baglantinin zaman asimi haric): hazir
// istemciyi ya da null doner, null alan cagiran kendi yedegine duser.
async function getRedisClient(): Promise<RedisClient | null> {
  if (!isEnabled()) return null;
  if (!client) {
    const instance = createShared();
    client = instance;
    let timer: NodeJS.Timeout | undefined;
    firstConnect = Promise.race([
      instance.connect().then(
        () => undefined,
        (error: unknown) => {
          // Gecersiz URL gibi yeniden denenemeyen hata: sonraki cagri bastan kurar.
          logger.error({ error: errorText(error) }, 'Redis connection failed');
          if (client === instance) client = null;
        }
      ),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, connectTimeoutMs());
        timer.unref();
      })
    ]).finally(() => {
      clearTimeout(timer);
      firstConnect = null;
    });
  }
  if (firstConnect) await firstConnect;
  return client?.isReady ? client : null;
}

async function closeRedisClient() {
  const instance = client;
  client = null;
  if (!instance) return;
  // Hazir degilse close() bekleyecek bir sey bulamaz; destroy yeniden
  // baglanma dongusunu de durdurur.
  if (instance.isReady) await instance.close().catch(() => instance.destroy());
  else instance.destroy();
}

export { getRedisClient, closeRedisClient, isEnabled };
