'use strict';

// Oturum çerezi ve CSRF eşleşmesi.
//
// Token eskiden yanıt gövdesinde dönüyor ve panel tarafından localStorage'a
// yazılıyordu. Orada duran bir yetki belgesini sayfada çalışan HER script
// okuyabilir: tek bir XSS, yedi günlük tam yetkili bir oturumu dışarı taşımaya
// yeter. Çerez `httpOnly` olduğunda JavaScript onu hiç göremez.
//
// Çerezle gelen kimlik tarayıcı tarafından kendiliğinden eklendiği için CSRF
// kapısı açılır: başka bir site, kullanıcının çerezini taşıyan bir istek
// tetikleyebilir. İki katmanla kapatılıyor:
//
//   SameSite       tarayıcı çerezi siteler arası isteklere hiç eklemez
//   çift gönderim  okunabilir `sc_csrf` çerezi, `X-CSRF-Token` başlığıyla
//                  eşleşmek zorunda. Saldırgan başka kökenden çerezi
//                  okuyamadığı için başlığı dolduramaz.
//
// Panel ile API ayrı kökenlerde dağıtıldığında SameSite=Lax çerezi engeller;
// o kurulum için COOKIE_SAMESITE=none verilir ve çerez zorunlu olarak Secure
// olur (tarayıcı şartı).

import crypto from 'crypto';
import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE = 'sc_session';
export const CSRF_COOKIE = 'sc_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/** Token ömrü. Çerez ve JWT aynı süreyi taşır; biri diğerinden uzun yaşarsa
 *  kullanıcı ya erken düşer ya da ölü bir çerez taşır. */
export const SESSION_TTL_SECONDS = Number(process.env.SESSION_TTL_SECONDS) || 7 * 24 * 60 * 60;

function sameSite(): 'lax' | 'strict' | 'none' {
  const configured = String(process.env.COOKIE_SAMESITE || '').toLowerCase();
  if (configured === 'none' || configured === 'strict' || configured === 'lax') return configured;
  return 'lax';
}

function secure(): boolean {
  // SameSite=None tarayıcı tarafından yalnızca Secure çerezlerde kabul edilir.
  if (sameSite() === 'none') return true;
  if (process.env.COOKIE_SECURE !== undefined) return process.env.COOKIE_SECURE === 'true';
  return process.env.NODE_ENV === 'production';
}

function base(): CookieOptions {
  return {
    sameSite: sameSite(),
    secure: secure(),
    path: '/',
    maxAge: SESSION_TTL_SECONDS * 1000,
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {})
  };
}

/** Oturumu kurar: token JavaScript'in göremeyeceği çerezde, CSRF eşi okunabilir. */
export function startSession(res: Response, token: string): string {
  const csrfToken = crypto.randomBytes(32).toString('base64url');
  res.cookie(SESSION_COOKIE, token, { ...base(), httpOnly: true });
  // Bu çerez bilerek okunabilir: panelin başlığa koyabilmesi gerekiyor. Tek
  // başına yetki vermez, yalnızca isteğin gerçekten panelden geldiğini gösterir.
  res.cookie(CSRF_COOKIE, csrfToken, { ...base(), httpOnly: false });
  return csrfToken;
}

export function endSession(res: Response): void {
  const { maxAge, ...clearing } = base();
  void maxAge;
  res.clearCookie(SESSION_COOKIE, { ...clearing, httpOnly: true });
  res.clearCookie(CSRF_COOKIE, { ...clearing, httpOnly: false });
}

/** İsteğin taşıdığı token: önce çerez, sonra Authorization başlığı.
 *
 *  Başlık yolu tarayıcı dışı istemciler (sunucu-sunucu çağrılar, testler, CLI)
 *  için duruyor. O yolda tarayıcı hiçbir şeyi kendiliğinden eklemediği için
 *  CSRF de söz konusu değildir. */
export function readToken(req: Request): { token: string | null; fromCookie: boolean } {
  const cookieToken = req.cookies?.[SESSION_COOKIE];
  if (typeof cookieToken === 'string' && cookieToken) return { token: cookieToken, fromCookie: true };

  const header = req.header('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return { token: match ? match[1].trim() : null, fromCookie: false };
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Çerezle kimliklenen durum değiştiren istekler için çift gönderim kontrolü.
 *
 * Authorization başlığıyla gelen istekler muaf: o kimliği tarayıcı
 * kendiliğinden eklemez, dolayısıyla başka bir sitenin tetiklediği istek onu
 * taşıyamaz.
 */
export function csrfOk(req: Request, fromCookie: boolean): boolean {
  if (!fromCookie) return true;
  if (SAFE_METHODS.has(req.method)) return true;

  const cookieValue = req.cookies?.[CSRF_COOKIE];
  const headerValue = req.header(CSRF_HEADER);
  if (typeof cookieValue !== 'string' || !cookieValue) return false;
  if (typeof headerValue !== 'string' || !headerValue) return false;
  if (cookieValue.length !== headerValue.length) return false;
  // Sabit süreli karşılaştırma: uzunluk eşitse baytlar sızdırılmadan bakılır.
  return crypto.timingSafeEqual(Buffer.from(cookieValue), Buffer.from(headerValue));
}
