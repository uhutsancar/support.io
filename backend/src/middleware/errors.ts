'use strict';

// Hata yanıtlarının tek çıkış noktası.
//
// Rotaların catch blokları `res.status(500).json({ error: error.message })`
// yazıyordu. Bir veritabanı hatasının metni istemciye olduğu gibi gidiyordu:
// PostgreSQL mesajları tablo, sütun ve kısıt adlarını taşır
// ("duplicate key value violates unique constraint \"users_email_key\"",
// "column \"x\" does not exist") — bir saldırgana şemanın haritasını çizen
// bilgi. Artık:
//
//   ValidationError    modelin kendi kısıt mesajı, kasıtlı → 400 + mesaj
//   bilinen PG hatası  SQLSTATE'e göre durum kodu, genel mesaj
//   geri kalan her şey sunucu günlüğüne tam haliyle, istemciye genel mesaj
//
// Durum kodu çağıranın verdiği varsayılanı korur: daha önce 400 dönen bir
// catch bloğu bilinmeyen bir hatada yine 400 döner, yalnızca metni değişir.

import type { Response } from 'express';
import { ValidationError } from '../db/model';

interface PgLikeError {
  code?: unknown;
}

const PG_ERRORS: Record<string, { status: number; error: string; code: string }> = {
  '23505': { status: 409, error: 'This record already exists', code: 'CONFLICT' },
  '23503': { status: 400, error: 'A referenced record does not exist', code: 'INVALID_REFERENCE' },
  '23502': { status: 400, error: 'A required value is missing', code: 'VALIDATION_ERROR' },
  '23514': { status: 400, error: 'A value is outside the allowed range', code: 'VALIDATION_ERROR' },
  '22P02': { status: 400, error: 'A value has the wrong format', code: 'VALIDATION_ERROR' },
  '22001': { status: 400, error: 'A value is too long', code: 'VALIDATION_ERROR' },
  '22003': { status: 400, error: 'A number is out of range', code: 'VALIDATION_ERROR' }
};

const GENERIC: Record<number, string> = {
  400: 'The request could not be processed',
  500: 'Internal server error'
};

/**
 * Sends a safe error response and logs the real cause.
 *
 * @param fallbackStatus status used when the error is not one we recognise;
 *   pass what the catch block used to send so clients see the same code.
 */
export function sendError(res: Response, error: unknown, fallbackStatus = 500): Response {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message, code: 'VALIDATION_ERROR' });
  }

  const pgCode = error && typeof error === 'object' ? (error as PgLikeError).code : undefined;
  const mapped = typeof pgCode === 'string' ? PG_ERRORS[pgCode] : undefined;
  if (mapped) {
    return res.status(mapped.status).json({ error: mapped.error, code: mapped.code });
  }

  // Tam hata yalnızca burada, sunucu tarafında görünür.
  const req = res.req;
  console.error(`[http] ${req ? `${req.method} ${req.originalUrl}` : ''}`, error);
  const status = fallbackStatus >= 400 && fallbackStatus < 600 ? fallbackStatus : 500;
  return res.status(status).json({
    error: GENERIC[status] || GENERIC[500],
    code: status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'
  });
}
