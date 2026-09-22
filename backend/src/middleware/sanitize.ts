'use strict';

// Kullanıcı girdisinden sorgu operatörlerini ayıklar.
//
// ORM Mongo benzeri bir sorgu dili konuşuyor: `{ siteKey: { $ne: 'x' } }`
// "anahtarı x olmayan herhangi bir site" demek. Değer beklenen bir yere
// kullanıcıdan gelen bir nesne ulaştığında sorgunun anlamı değişiyordu:
//
//   GET  /api/widget/settings?siteKey[$ne]=x   rastgele bir şirketin ayarları
//   POST /api/widget/installed {siteKey:{$ne}} başka bir şirketin site kaydına yazma
//   verifySiteKey (dosya yükleme, SSS arama)   rastgele bir sitenin kimliğiyle geçme
//
// Üç katman:
//   - Sorgu dizesi düz ayrıştırılır (server.ts: 'query parser' = 'simple');
//     `a[b]=c` bir nesneye dönüşmez.
//   - Bu ara katman JSON gövdelerindeki `$` ile başlayan anahtarları ve
//     prototip kirleten adları kaldırır. Panel ve widget hiçbir gövdede böyle
//     bir anahtar göndermiyor; meşru bir istek etkilenmez.
//   - Site anahtarı gibi kimlik değerleri giriş noktalarında ayrıca metin
//     olarak doğrulanır.

import type { Request, Response, NextFunction } from 'express';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 32;

function clean(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return undefined;
  if (Array.isArray(value)) return value.map((item) => clean(item, depth + 1));
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  const out: Record<string, unknown> = {};
  for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('$') || FORBIDDEN_KEYS.has(key)) continue;
    out[key] = clean(inner, depth + 1);
  }
  return out;
}

export function sanitizeInput(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') req.body = clean(req.body, 0);
  next();
}

/** Bir kimlik değerinin düz metin olduğunu doğrular (nesne/dizi değil). */
export function plainString(value: unknown, maxLength = 256): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : null;
}
