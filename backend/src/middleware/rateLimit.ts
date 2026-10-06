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
import { verifyMfaPending, verifySession, verifyWidgetSession } from '../config/tokens';
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

const recentlySeen = new Map<string, number>();

/**
 * True only for the first call with `key` in a window: SET NX in Redis, or a
 * small in-process map when Redis is away.
 */
async function firstInWindow(key: string, windowMs: number): Promise<boolean> {
  if (redisConfigured()) {
    try {
      const client = await getRedisClient();
      if (client)
        return (await client.set(`once:${key}`, '1', { NX: true, PX: windowMs })) === 'OK';
    } catch {
      /* fall through to the local map */
    }
  }
  const now = Date.now();
  for (const [k, until] of recentlySeen) if (until <= now) recentlySeen.delete(k);
  if ((recentlySeen.get(key) ?? 0) > now) return false;
  recentlySeen.set(key, now + windowMs);
  return true;
}

/** The LOGIN_FAILED_LOCKED audit row, for an account that exists. */
function emitLocked(req: Request, email: string): void {
  void (async () => {
    try {
      const { query } = await import('../db/pool');
      const { rows } = await query<{ id: string; organization_id: string | null }>(
        `SELECT id, organization_id FROM users WHERE email = $1 AND is_active
         UNION ALL
         SELECT id, organization_id FROM teams WHERE email = $1 AND is_active
         LIMIT 1`,
        [email]
      );
      if (!rows[0]) return;
      const events = (await import('../events')).default;
      events.emit('auth.login.locked', {
        organizationId: rows[0].organization_id,
        userId: rows[0].id,
        metadata: {},
        ip: req.ip,
        ua: req.get('user-agent')
      });
    } catch (error) {
      console.error('[rate-limit] could not record a locked account:', errorText(error));
    }
  })();
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
  const ip = ipKeyGenerator(req.ip || '');
  // Widget uclari imzali widget oturumuyla gelir; sayac oturuma ve IP'ye gore
  // tutulur ki ayni sitedeki tum ziyaretciler tek kotayi paylasmasin.
  const bearer = /^Bearer\s+(.+)$/i.exec((req.header('Authorization') || '').trim());
  if (bearer) {
    try {
      const widget = verifyWidgetSession(bearer[1].trim());
      return `w:${widget.sid}:${ip}`;
    } catch {
      /* dogrulanamayan token anonim sayilir */
    }
  }
  return `ip:${ip}`;
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
  /** Sinira takilan istekten sonra, yanit gittikten sonra calisir. */
  onLimit?: (req: Request) => void;
}

function createLimiter({
  name,
  code,
  message,
  windowMs,
  max,
  keyGenerator,
  skipSuccessfulRequests,
  onLimit
}: LimiterSpec): RateLimitRequestHandler {
  const respond = limitReachedResponse(code, message);
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
    handler: (req, res, next, options) => {
      respond(req, res, next, options);
      onLimit?.(req);
    }
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
  },
  // One audit row per locked account per window (SEC-06), however many
  // attempts keep hitting the lock: the trail should say it happened, not
  // fill up with the attacker's retries.
  onLimit: (req: Request) => {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    if (!email) return;
    void firstInWindow(`lock-audited:${email}`, 15 * 60 * 1000).then((first) => {
      if (first) emitLocked(req, email);
    });
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

// Widget oturumu: her sayfa acilisinda bir kez alinir. Site anahtari + IP'ye
// gore sayilir; anahtarlari tarayip oturum basmayi da yavaslatir.
const widgetSessionLimiter = createLimiter({
  name: 'widget-session',
  code: 'TOO_MANY_WIDGET_SESSIONS',
  message: 'Too many widget sessions, please try again later.',
  windowMs: minutes(process.env.WIDGET_SESSION_RATE_WINDOW_MS, 15 * 60 * 1000),
  max: limit(process.env.WIDGET_SESSION_RATE_MAX, 300, 100000),
  keyGenerator: (req: Request) => {
    const siteKey = typeof req.body?.siteKey === 'string' ? req.body.siteKey.slice(0, 128) : 'none';
    return `ws:${siteKey}:${ipKeyGenerator(req.ip || '')}`;
  }
});

// Sifre sifirlama talebi: IP basina ve e-posta basina iki sayac. E-posta
// sayaci, ayni adrese dakikada bir mail yagdirmayi engeller; kayitli olup
// olmamasindan bagimsiz sayilir ki sinira takilmak varligi ele vermesin.
const forgotPasswordLimiter = createLimiter({
  name: 'forgot-password',
  code: 'TOO_MANY_RESET_REQUESTS',
  message: 'Too many password reset requests, please try again later.',
  windowMs: minutes(process.env.RESET_RATE_WINDOW_MS, 15 * 60 * 1000),
  max: limit(process.env.RESET_RATE_MAX, 10, 100000)
});

const forgotPasswordAccountLimiter = createLimiter({
  name: 'forgot-password-account',
  code: 'TOO_MANY_RESET_REQUESTS',
  message: 'Too many password reset requests, please try again later.',
  windowMs: 60 * 60 * 1000,
  max: limit(process.env.RESET_ACCOUNT_RATE_MAX, 5, 100000),
  keyGenerator: (req: Request) => {
    const email =
      typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : '';
    return email ? `acct:${email}` : `ip:${ipKeyGenerator(req.ip || '')}`;
  }
});

// Dogrulama mailini yeniden gonderme: hesap basina.
const resendVerificationLimiter = createLimiter({
  name: 'resend-verification',
  code: 'TOO_MANY_VERIFICATION_MAILS',
  message: 'Too many verification e-mails, please try again later.',
  windowMs: 60 * 60 * 1000,
  max: limit(process.env.VERIFY_RESEND_RATE_MAX, 5, 100000)
});

// Hesap ayarlari: sifre ve e-posta degistirme, iki adimli dogrulamayi
// acip kapama, tum cihazlardan cikis. Kullanici basina saatte 5 (plan v10
// SEC-03): mevcut sifreyi tahmin etmek icin bir oturumun elinde tutulacak
// yol kalmaz.
const accountChangeLimiter = createLimiter({
  name: 'account-change',
  code: 'TOO_MANY_ACCOUNT_CHANGES',
  message: 'Too many account changes, please try again later.',
  windowMs: 60 * 60 * 1000,
  max: limit(process.env.ACCOUNT_RATE_MAX, 5, 100000)
});

// Ikinci adim (dogrulama kodu ya da kurtarma kodu): bekleyen giris basina
// 15 dakikada 5 deneme. Anahtar bekleyen girisin hesabidir; bilinmeyen bir
// belirtec IP'ye duser.
const mfaLimiter = createLimiter({
  name: 'mfa',
  code: 'TOO_MANY_MFA_ATTEMPTS',
  message: 'Too many verification attempts, please sign in again later.',
  windowMs: 15 * 60 * 1000,
  max: limit(process.env.MFA_RATE_MAX, 5, 100000),
  keyGenerator: (req: Request) => {
    const pending = verifyMfaPending(req.body?.mfaToken);
    return pending ? `mfa:${pending.userId}` : `ip:${ipKeyGenerator(req.ip || '')}`;
  }
});

// Genel API trafigi.
const apiLimiter = createLimiter({
  name: 'api',
  code: 'TOO_MANY_REQUESTS',
  message: 'Too many requests, please slow down.',
  windowMs: minutes(process.env.API_RATE_WINDOW_MS, 15 * 60 * 1000),
  max: limit(process.env.API_RATE_MAX, 1000, 1000000)
});

// Kurum basina yazma sinirlari (plan (6) §8.2). Plan limiti toplam site ve
// koltuk sayisini tutar; bunlar sil-yeniden-olustur dongusunu ve davet
// e-postalariyla rastgele adreslere spam atilmasini yavaslatir.
function perOrganization(req: Request): string {
  const id = req.organization?._id || req.user?.organizationId;
  return id ? `org:${String(id)}` : identifyClient(req);
}

const siteCreateLimiter = createLimiter({
  name: 'site-create',
  code: 'TOO_MANY_SITES_CREATED',
  message: 'Too many sites created, please try again later.',
  windowMs: 60 * 60 * 1000,
  max: limit(process.env.SITE_CREATE_RATE_MAX, 20, 100000),
  keyGenerator: perOrganization
});

const invitationLimiter = createLimiter({
  name: 'invitation-send',
  code: 'TOO_MANY_INVITATIONS',
  message: 'Too many invitations sent, please try again later.',
  windowMs: 60 * 60 * 1000,
  max: limit(process.env.INVITE_RATE_MAX, 20, 100000),
  keyGenerator: perOrganization
});

// Soket baglantilari. Bir oturum belirteci gecerli oldugu surece istenen kadar
// soket acmaya yetiyordu. Panel IP'ye, widget site + IP'ye gore sayilir:
// mobil operatorler cok sayida ziyaretciyi tek IP'nin arkasinda toplar ve her
// sayfa acilisi yeni bir baglantidir, bu yuzden widget'in tavani daha yuksek.
const socketConnectQuota = {
  admin: createQuota({
    name: 'socket-admin',
    windowMs: 60 * 1000,
    max: limit(process.env.SOCKET_ADMIN_CONNECT_RATE_MAX, 30, 100000)
  }),
  widget: createQuota({
    name: 'socket-widget',
    windowMs: 60 * 1000,
    max: limit(process.env.SOCKET_WIDGET_CONNECT_RATE_MAX, 60, 100000)
  })
};

/**
 * The address a socket handshake came from, by the same rule Express uses
 * with `trust proxy` 1: the last X-Forwarded-For entry, which Caddy writes.
 */
function handshakeIp(headers: Record<string, unknown>, address: string): string {
  const forwarded =
    typeof headers['x-forwarded-for'] === 'string' ? headers['x-forwarded-for'] : '';
  const last = forwarded.split(',').pop()?.trim();
  return ipKeyGenerator(last || address || '');
}

export {
  loginLimiter,
  loginAccountLimiter,
  registerLimiter,
  widgetSessionLimiter,
  forgotPasswordLimiter,
  forgotPasswordAccountLimiter,
  resendVerificationLimiter,
  accountChangeLimiter,
  mfaLimiter,
  apiLimiter,
  siteCreateLimiter,
  invitationLimiter,
  socketConnectQuota,
  handshakeIp,
  createLimiter,
  createQuota,
  identifyClient
};
