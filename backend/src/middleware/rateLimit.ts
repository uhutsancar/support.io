'use strict';

// API hiz sinirlari.
//
// Uc gercek sorunu cozer:
//
//  1. Sayaclar surec belleginde tutuluyordu. Backend birden fazla surece
//     cikarildiginda (docker-compose.prod.yml bunu yapar) her surecin kendi
//     sayaci olur ve efektif sinir surec sayisiyla carpilir: 3 surecte "15
//     dakikada 100 giris denemesi" sessizce 300 olur. REDIS_URL tanimliyken
//     sayac Redis'te tutulur ve sinir tum sureclerde ortaktir.
//
//  2. Sinir yalnizca IP'ye gore isliyordu. Tek bir NAT arkasindaki musteri
//     ekibinin tamami ayni IP'den gelir; kalabalik bir destek ekibi birbirinin
//     kotasini yer. Kimligi dogrulanmis istekler artik kullaniciya gore
//     sayilir, yalnizca anonim istekler IP'ye duser.
//
//  3. 429 yaniti duz metindi. API'nin geri kalani JSON dondurur, bu yuzden
//     istemci tam da geri cekilmesi gereken anda govdeyi ayristiramiyordu.
//     Artik JSON ve `Retry-After` basligi doner.

// express-rate-limit'in Store arayuzu. Sayac Redis'te INCR ile tutulur; ilk
// artista anahtara pencere suresi kadar TTL verilir.
import { rateLimit, ipKeyGenerator, MemoryStore } from 'express-rate-limit';
import type {
  ClientRateLimitInfo,
  Options,
  RateLimitRequestHandler,
  Store
} from 'express-rate-limit';
import type { NextFunction, Request, Response } from 'express';
import { getRedisClient, isEnabled as redisConfigured } from '../config/redis';
import { readToken } from '../config/session';
import { verifySession } from '../config/tokens';
import { errorText } from '../http/errors';

class RedisStore implements Store {
  prefix: string;
  fallback: MemoryStore;
  localKeys: boolean;
  /** Filled in by express-rate-limit through init(). */
  windowMs!: number;

  constructor(prefix: string) {
    // express-rate-limit bu alani yalnizca cift sayim tespitinde kullanir;
    // anahtari Redis'e yazarken onune eklemek store'un kendi isidir. Eklenmezse
    // butun limitler ayni anahtarlari paylasir ve tek sayacta bulusur.
    this.prefix = prefix;
    // Redis yokken/dusukken ayni surec icinde calisan yedek. Sinir bu sirada
    // surec basina duser, ki hic sinir olmamasindan iyidir.
    this.fallback = new MemoryStore();
    this.localKeys = false;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
    this.fallback.init(options);
  }

  async client(): Promise<Awaited<ReturnType<typeof getRedisClient>>> {
    if (!redisConfigured()) return null;
    try {
      return await getRedisClient();
    } catch {
      // No Redis: the in-process fallback counter takes over.
      return null;
    }
  }

  redisKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const client = await this.client();
    if (!client) return this.fallback.increment(key);
    try {
      // INCR ve PEXPIRE tek turda gider: iki ayri gidis-donus arasinda surec
      // olurse anahtar TTL'siz kalir ve sonsuza kadar sayardi.
      const [totalHits, ttl] = await client
        .multi()
        .incr(this.redisKey(key))
        .pExpire(this.redisKey(key), this.windowMs, 'NX')
        .pTTL(this.redisKey(key))
        .exec()
        .then((replies: unknown[]) => [Number(replies[0]), Number(replies[2])]);

      return {
        totalHits,
        resetTime: new Date(Date.now() + (ttl > 0 ? ttl : this.windowMs))
      };
    } catch (error) {
      // Hiz siniri bir yan sistemdir: Redis dustugunde tum API'yi durdurmak
      // yerine surec ici sayaca dusulur.
      console.error(
        '[rate-limit] Redis sayaci okunamadi, surec ici sayaca dusuluyor:',
        errorText(error)
      );
      return this.fallback.increment(key);
    }
  }

  async decrement(key: string): Promise<void> {
    const client = await this.client();
    if (!client) return this.fallback.decrement(key);
    try {
      await client.decr(this.redisKey(key));
    } catch {
      // Sayaci geri alamamak yalnizca istemcinin kotasindan bir hak eksiltir.
    }
  }

  async resetKey(key: string): Promise<void> {
    const client = await this.client();
    if (!client) return this.fallback.resetKey(key);
    try {
      await client.del(this.redisKey(key));
    } catch {
      /* pencere dolunca kendiliginden temizlenir */
    }
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const client = await this.client();
    if (!client) return this.fallback.get(key);
    try {
      const [hits, ttl] = await client
        .multi()
        .get(this.redisKey(key))
        .pTTL(this.redisKey(key))
        .exec();
      if (hits === null) return undefined;
      return {
        totalHits: Number(hits),
        resetTime: new Date(Date.now() + (Number(ttl) > 0 ? Number(ttl) : this.windowMs))
      };
    } catch {
      // Redis unreachable: the limiter reports no record and the caller
      // falls back to its in-process counter.
      return undefined;
    }
  }
}

// Kimligi dogrulanmis istekleri kullaniciya, digerlerini IP'ye gore sayar.
// Gecersiz imzali bir token IP'ye duser, dolayisiyla token uydurarak sinir
// asilamaz.
function identifyClient(req: Request): string {
  // Oturum artık httpOnly çerezde; yalnızca başlığa bakmak tarayıcıdan gelen
  // her isteği IP'ye düşürür ve NAT arkasındaki bir ekip tek kotayı paylaşırdı.
  const { token } = readToken(req);
  if (token) {
    try {
      const decoded = verifySession(token);
      return `u:${decoded.userId}`;
    } catch {
      /* dogrulanamayan token anonim sayilir */
    }
  }
  // Widget uclari site anahtariyla dogrulanir; ayni sitedeki tum ziyaretciler
  // tek kotayi paylasmasin diye anahtar yalnizca IP ile birlestirilir.
  const siteKey = req.header('x-site-key');
  const ip = ipKeyGenerator(req.ip || '');
  return siteKey ? `s:${siteKey}:${ip}` : `ip:${ip}`;
}

function limitReachedResponse(code: string, message: string) {
  return (req: Request, res: Response, _next: NextFunction, options: Options): void => {
    const resetTime = req.rateLimit?.resetTime;
    const retryAfterSeconds = resetTime
      ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
      : Math.ceil(options.windowMs / 1000);
    res.set('Retry-After', String(retryAfterSeconds));
    res.status(options.statusCode).json({
      error: message,
      code,
      retryAfter: retryAfterSeconds
    });
  };
}

/** The knobs one named limiter needs. */
interface LimiterSpec {
  name: string;
  code: string;
  message: string;
  windowMs: number;
  max: number;
  /** Sayacin anahtari; verilmezse kullanici ya da IP. */
  keyGenerator?: (req: Request) => string;
  /** Yalnizca basarisiz (>= 400) yanitlari say. */
  skipSuccessfulRequests?: boolean;
}

function createLimiter({
  name,
  code,
  message,
  windowMs,
  max,
  keyGenerator,
  skipSuccessfulRequests
}: LimiterSpec): RateLimitRequestHandler {
  return rateLimit({
    windowMs,
    max,
    skipSuccessfulRequests: Boolean(skipSuccessfulRequests),
    // Standart RateLimit-* basliklari; eski X-RateLimit-* basliklari da panel
    // tarafinda okunabilsin diye acik birakilir.
    standardHeaders: true,
    legacyHeaders: true,
    keyGenerator: keyGenerator || identifyClient,
    store: new RedisStore(`rl:${name}:`),
    handler: limitReachedResponse(code, message)
  });
}

/**
 * The same shared counter for work that is not an HTTP request — an order
 * lookup the assistant makes from a socket event, for instance. `take` counts
 * one use and says whether it is still within the limit.
 */
function createQuota({ name, windowMs, max }: { name: string; windowMs: number; max: number }): {
  take(key: string): Promise<boolean>;
} {
  const store = new RedisStore(`rl:${name}:`);
  store.init({ windowMs } as Options);
  return {
    async take(key: string) {
      const { totalHits } = await store.increment(key);
      return totalHits <= max;
    }
  };
}

const minutes = (value: string | undefined, fallback: number): number => Number(value) || fallback;

/**
 * Üretim dışındaki varsayılan sınır.
 *
 * docker-compose.yml geliştirme yığınına zaten çok yüksek sınırlar veriyor
 * (API_RATE_MAX=1000000). Backend Docker'sız, `npm run dev` ile
 * çalıştırıldığında bu değişkenler yoktu ve üretimin sıkı varsayılanları
 * geçerliydi: panelde birkaç dakika gezinip demodan mesaj atan bir geliştirici
 * 15 dakikada 1000 isteği aşıyor, ardından giriş de widget da 429 alıyordu.
 * Ortam değişkeni verilmişse o kazanır; üretimde hiçbir şey değişmez.
 */
const isProduction = process.env.NODE_ENV === 'production';
const limit = (value: string | undefined, production: number, development: number): number =>
  minutes(value, isProduction ? production : development);

// Giris denemeleri: parola deneme saldirilarina karsi dar tutulur.
const loginLimiter = createLimiter({
  name: 'login',
  code: 'TOO_MANY_LOGIN_ATTEMPTS',
  message: 'Too many login attempts, please try again later.',
  windowMs: minutes(process.env.AUTH_RATE_WINDOW_MS, 15 * 60 * 1000),
  max: limit(process.env.AUTH_RATE_MAX, 100, 100000)
});

// Hesap başına sınır. IP sınırı tek başına dağıtık bir parola denemesini
// durdurmaz: yüz farklı adresten gelen saldırgan tek bir hesaba her adresin
// kotası kadar deneme yapar. Bu sayaç e-postaya göre tutulur ve yalnızca
// başarısız girişleri sayar; doğru parolayı giren kullanıcı hiç etkilenmez.
// E-posta, kayıtlı olup olmadığından bağımsız sayılır: aksi halde sınıra
// takılıp takılmamak hangi hesabın var olduğunu ele verirdi.
const loginAccountLimiter = createLimiter({
  name: 'login-account',
  code: 'TOO_MANY_LOGIN_ATTEMPTS',
  message: 'Too many failed attempts for this account, please try again later.',
  windowMs: minutes(process.env.ACCOUNT_LOCK_WINDOW_MS, 15 * 60 * 1000),
  max: minutes(process.env.ACCOUNT_LOCK_MAX, 10),
  skipSuccessfulRequests: true,
  keyGenerator: (req: Request) => {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    return email ? `acct:${email}` : `ip:${ipKeyGenerator(req.ip || '')}`;
  }
});

// Kayit ayri sayilir: giris denemeleriyle ayni sayaci paylastiklarinda, bir
// hesaba yapilan parola denemeleri o IP'den yeni kayit acilmasini da
// engelliyordu.
const registerLimiter = createLimiter({
  name: 'register',
  code: 'TOO_MANY_REGISTRATIONS',
  message: 'Too many registration attempts, please try again later.',
  windowMs: minutes(process.env.REGISTER_RATE_WINDOW_MS, 60 * 60 * 1000),
  max: limit(process.env.REGISTER_RATE_MAX, 20, 100000)
});

// Genel API trafigi.
const apiLimiter = createLimiter({
  name: 'api',
  code: 'TOO_MANY_REQUESTS',
  message: 'Too many requests, please slow down.',
  windowMs: minutes(process.env.API_RATE_WINDOW_MS, 15 * 60 * 1000),
  max: limit(process.env.API_RATE_MAX, 1000, 1000000)
});

export {
  loginLimiter,
  loginAccountLimiter,
  registerLimiter,
  apiLimiter,
  createLimiter,
  createQuota,
  identifyClient
};
