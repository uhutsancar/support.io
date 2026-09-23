'use strict';

// İmzalı token'ların tek kaynağı.
//
// İki farklı amaçlı token aynı anahtarla, aynı algoritmayla imzalanıyordu:
//
//   oturum         panelin kimliği (userId, rol, organizasyon)
//   yükleme kanıtı widget'ın herkese açık yükleme uç noktasının verdiği,
//                  "bu dosyayı biz yükledik" diyen 15 dakikalık kanıt
//
// Doğrulayan taraf token'ın amacına hiç bakmıyordu. Bir web sitesinin anonim
// ziyaretçisi bir dosya yükleyip aldığı kanıtı Authorization başlığına
// koyduğunda imza geçiyordu; kanıtta userId olmadığı için sorgu
// `User.findOne({ _id: undefined, isActive: true })` oluyor, ORM tanımsız
// koşulu düşürüyor ve çağıran veritabanındaki ilk aktif kullanıcı — herhangi
// bir şirketin sahibi — olarak kimlik kazanıyordu.
//
// Artık iki katman var:
//   - Her amaç kendi türetilmiş anahtarıyla imzalanır. Bir yükleme kanıtı
//     oturum anahtarıyla hiçbir koşulda doğrulanamaz; claim kontrolü
//     unutulsa bile.
//   - Her token bir `aud` taşır ve doğrulayıcı onu ister. Oturum ayrıca
//     geçerli bir userId ve userType taşımak zorunda.

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { jwtSecret } from './jwt';
import { isValidObjectId } from '../db/objectId';
import type { AuthTokenPayload } from '../types/auth';

const SESSION_AUDIENCE = 'support-chat:session';
const UPLOAD_AUDIENCE = 'support-chat:upload-proof';

/** Tek kök gizli anahtardan amaca özgü bir anahtar türetir (HMAC-SHA256). */
function derivedKey(purpose: string): Buffer {
  return crypto.createHmac('sha256', jwtSecret()).update(`support-chat/${purpose}/v1`).digest();
}

// ------------------------------------------------------------------ oturum

export function signSession(payload: AuthTokenPayload, expiresInSeconds: number): string {
  return jwt.sign({ ...payload }, derivedKey('session'), {
    algorithm: 'HS256',
    audience: SESSION_AUDIENCE,
    expiresIn: expiresInSeconds
  });
}

/**
 * Bir oturum token'ını doğrular. Amaç, algoritma, süre ve kimlik alanları
 * birlikte kontrol edilir; herhangi biri tutmazsa fırlatır.
 */
export function verifySession(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, derivedKey('session'), {
    algorithms: ['HS256'],
    audience: SESSION_AUDIENCE
  }) as AuthTokenPayload & { aud?: unknown };

  // Kimliği olmayan bir oturum olamaz. Bu kontrol ORM'e tanımsız bir koşul
  // ulaşmasını da imza katmanından bağımsız olarak engeller.
  if (!isValidObjectId(decoded.userId)) throw new Error('Session carries no user');
  if (
    decoded.userType !== undefined &&
    decoded.userType !== 'user' &&
    decoded.userType !== 'team'
  ) {
    throw new Error('Session carries an unknown user type');
  }
  if (
    decoded.organizationId !== undefined &&
    decoded.organizationId !== null &&
    !isValidObjectId(decoded.organizationId)
  ) {
    throw new Error('Session carries a malformed organization');
  }
  return decoded;
}

// ---------------------------------------------------------- yükleme kanıtı

export interface UploadProofClaims {
  kind: 'chat-upload';
  siteId: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export function signUploadProof(claims: UploadProofClaims): string {
  return jwt.sign({ ...claims }, derivedKey('upload-proof'), {
    algorithm: 'HS256',
    audience: UPLOAD_AUDIENCE,
    expiresIn: '15m'
  });
}

export function verifyUploadProof(token: string): UploadProofClaims {
  const decoded = jwt.verify(token, derivedKey('upload-proof'), {
    algorithms: ['HS256'],
    audience: UPLOAD_AUDIENCE
  }) as UploadProofClaims;
  if (decoded.kind !== 'chat-upload') throw new Error('Not an upload proof');
  return decoded;
}
