'use strict';

// Parola saklama ve doğrulama.
//
// Tek yerde toplanan dört karar:
//
//   maliyet    Yeni parolalar node:crypto scrypt (N=2^17, r=8, p=1) ile
//              libuv işçi havuzunda türetilir. 11 Ekim 2026 ölçümünde beş
//              paralel bcryptjs/10 ana döngüyü 495,5 ms geciktirirken scrypt
//              15,3 ms geciktirdi. Eski bcrypt hash'leri doğrulanır ve başarılı
//              girişte needsRehash ile kendiliğinden scrypt'e taşınır.
//   politika   en az 10 karakter ve en yaygın 10.000 paroladan biri değil
//              (NIST SP 800-63B: uzunluk ve bilinen-parola listesi, zorunlu
//              karakter sınıfı yok). Liste depoda (config/data); dış servise
//              parola ya da hash'i gitmez. Yalnızca yeni belirlenen parolalara
//              uygulanır: eski parolalar girişte reddedilmez. bcrypt 72
//              bayttan sonrasını sessizce yok sayar: 100 karakterlik bir
//              parolanın son 28 karakteri hiçbir şey korumaz. Bu yüzden üst
//              sınır karakter değil bayt olarak 72.
//   zamanlama  kullanıcı bulunamadığında da güncel scrypt parametreleriyle
//              gerçek bir türetme yapılır. Aksi halde "kayıtlı değil"
//              yanıtı milisaniyeler içinde, "yanlış parola" yanıtı yüzlerce
//              ms sonra döner ve aynı hata mesajına rağmen hangi e-postaların
//              kayıtlı olduğu yanıt süresinden okunur. Kukla hash farklı
//              maliyette olursa fark bu sefer ters yönde açılır.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { HttpError } from '../http/errors';

// Only used to verify legacy hashes during the gradual migration.
export const BCRYPT_COST = 10;
export const SCRYPT_LOG_N = 17;
export const SCRYPT_R = 8;
export const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 64;
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;
const SCRYPT_PREFIX = '$scrypt$';
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_BYTES = 72;

let common: Set<string> | null = null;

/** The common-password list, read once (src/config/data, copied into dist). */
function commonPasswords(): Set<string> {
  if (!common) {
    const file = path.join(__dirname, 'data', 'common-passwords.txt');
    common = new Set(
      fs
        .readFileSync(file, 'utf8')
        .split(/\r?\n/)
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.toLowerCase())
    );
  }
  return common;
}

/** Why a new password is refused, as a code the panel translates. */
export type PasswordProblemCode =
  | 'PASSWORD_REQUIRED'
  | 'PASSWORD_TOO_SHORT'
  | 'PASSWORD_TOO_LONG'
  | 'PASSWORD_TOO_COMMON'
  | 'PASSWORD_CONTAINS_EMAIL';

const MESSAGES: Record<PasswordProblemCode, string> = {
  PASSWORD_REQUIRED: 'Password is required',
  PASSWORD_TOO_SHORT: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  PASSWORD_TOO_LONG: `Password must be at most ${PASSWORD_MAX_BYTES} bytes`,
  PASSWORD_TOO_COMMON: 'This password is too common; choose one that is harder to guess',
  PASSWORD_CONTAINS_EMAIL: 'The password must not contain your e-mail address'
};

/**
 * Why a password chosen now (sign-up, reset, change) is refused, or null.
 * `email`, when given, may not appear in the password.
 */
export function passwordProblemCode(
  password: unknown,
  { email }: { email?: string } = {}
): PasswordProblemCode | null {
  if (typeof password !== 'string' || !password) return 'PASSWORD_REQUIRED';
  if (password.length < PASSWORD_MIN_LENGTH) return 'PASSWORD_TOO_SHORT';
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return 'PASSWORD_TOO_LONG';
  const lower = password.toLowerCase();
  if (commonPasswords().has(lower)) return 'PASSWORD_TOO_COMMON';
  const local = String(email || '')
    .toLowerCase()
    .split('@')[0];
  if (local.length >= 4 && lower.includes(local)) return 'PASSWORD_CONTAINS_EMAIL';
  return null;
}

/** Politikaya uymayan parola için kullanıcıya gösterilecek mesaj; uyuyorsa null. */
export function passwordProblem(
  password: unknown,
  context: { email?: string } = {}
): string | null {
  const code = passwordProblemCode(password, context);
  return code ? MESSAGES[code] : null;
}

/** Throws a 400 carrying the policy code when the password is refused. */
export function assertPasswordAllowed(password: unknown, context: { email?: string } = {}): void {
  const code = passwordProblemCode(password, context);
  if (code) throw new HttpError(400, MESSAGES[code], code);
}

interface ScryptHash {
  logN: number;
  r: number;
  p: number;
  salt: Buffer;
  key: Buffer;
}

function parseScryptHash(hash: string): ScryptHash | null {
  const match = /^\$scrypt\$ln=(\d+),r=(\d+),p=(\d+)\$([A-Za-z0-9_-]+)\$([A-Za-z0-9_-]+)$/.exec(
    hash
  );
  if (!match) return null;
  const logN = Number(match[1]);
  const r = Number(match[2]);
  const p = Number(match[3]);
  const salt = Buffer.from(match[4], 'base64url');
  const key = Buffer.from(match[5], 'base64url');
  // Never let a corrupt database value request unbounded CPU or memory.
  if (logN < 14 || logN > 18 || r < 1 || r > 16 || p < 1 || p > 4) return null;
  if (salt.length < 16 || salt.length > 64 || key.length !== SCRYPT_KEY_BYTES) return null;
  return { logN, r, p, salt, key };
}

function deriveScrypt(password: string, hash: Pick<ScryptHash, 'logN' | 'r' | 'p' | 'salt'>) {
  return new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(
      password,
      hash.salt,
      SCRYPT_KEY_BYTES,
      { N: 2 ** hash.logN, r: hash.r, p: hash.p, maxmem: SCRYPT_MAX_MEMORY },
      (error, key) => (error ? reject(error) : resolve(key))
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const params = {
    logN: SCRYPT_LOG_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    salt: crypto.randomBytes(16)
  };
  const key = await deriveScrypt(password, params);
  return `${SCRYPT_PREFIX}ln=${params.logN},r=${params.r},p=${params.p}$${params.salt.toString('base64url')}$${key.toString('base64url')}`;
}

export async function verifyPassword(candidate: string, hash: string): Promise<boolean> {
  const parsed = parseScryptHash(hash);
  if (parsed) {
    const actual = await deriveScrypt(String(candidate), parsed);
    return crypto.timingSafeEqual(actual, parsed.key);
  }
  if (/^\$2[aby]\$/.test(hash)) return bcrypt.compare(String(candidate), hash);
  return false;
}

/**
 * Hash standart maliyette değilse true; giriş başarılı olduğunda yenilenir.
 *
 * Yalnızca düşük maliyeti değil her sapmayı yakalar: kukla karşılaştırma tek
 * bir maliyetle çalışır, dolayısıyla farklı maliyetli bir hash (daha yüksek
 * olsa bile) o hesabın yanıt süresini ötekilerden ayırır ve varlığını ele
 * verir.
 */
export function needsRehash(hash: string): boolean {
  const parsed = parseScryptHash(hash);
  if (parsed) {
    return parsed.logN !== SCRYPT_LOG_N || parsed.r !== SCRYPT_R || parsed.p !== SCRYPT_P;
  }
  return /^\$2[aby]\$/.test(hash);
}

// Güncel bir hash ile aynı maliyette, hiçbir parolaya karşılık gelmeyen sabit.
// İlk kullanımda bir kez üretilir; her kontrolde türetme yeniden yapılır.
let dummyHash: Promise<string> | null = null;

/** Kullanıcı yokken de gerçek bir doğrulama kadar zaman harcar. */
export async function burnVerification(candidate: unknown): Promise<false> {
  if (!dummyHash) dummyHash = hashPassword('support-chat-timing-equaliser');
  await verifyPassword(String(candidate ?? ''), await dummyHash);
  return false;
}
