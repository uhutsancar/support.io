'use strict';

// Parola saklama ve doğrulama.
//
// Tek yerde toplanan dört karar:
//
//   maliyet    bcrypt 10 (OWASP: "10 veya üstü"). bcryptjs saf JavaScript;
//              maliyet 12'de bir karşılaştırma ölçümde ~900 ms CPU tuttu,
//              yani eşzamanlı birkaç giriş denemesi bütün API'yi
//              yavaşlatabilirdi. Maliyet yükseltilirse needsRehash eski
//              hash'leri başarılı girişte kendiliğinden yeniler.
//   politika   en az 10 karakter ve en yaygın 10.000 paroladan biri değil
//              (NIST SP 800-63B: uzunluk ve bilinen-parola listesi, zorunlu
//              karakter sınıfı yok). Liste depoda (config/data); dış servise
//              parola ya da hash'i gitmez. Yalnızca yeni belirlenen parolalara
//              uygulanır: eski parolalar girişte reddedilmez. bcrypt 72
//              bayttan sonrasını sessizce yok sayar: 100 karakterlik bir
//              parolanın son 28 karakteri hiçbir şey korumaz. Bu yüzden üst
//              sınır karakter değil bayt olarak 72.
//   zamanlama  kullanıcı bulunamadığında da gerçek hash'lerle AYNI maliyette
//              bir bcrypt karşılaştırması yapılır. Aksi halde "kayıtlı değil"
//              yanıtı milisaniyeler içinde, "yanlış parola" yanıtı yüzlerce
//              ms sonra döner ve aynı hata mesajına rağmen hangi e-postaların
//              kayıtlı olduğu yanıt süresinden okunur. Kukla hash farklı
//              maliyette olursa fark bu sefer ters yönde açılır.

import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { HttpError } from '../http/errors';

export const BCRYPT_COST = 10;
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

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(candidate: string, hash: string): Promise<boolean> {
  return bcrypt.compare(String(candidate), hash);
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
  try {
    return bcrypt.getRounds(hash) !== BCRYPT_COST;
  } catch {
    return false;
  }
}

// Gerçek bir hash ile aynı maliyette, hiçbir parolaya karşılık gelmeyen sabit.
// İlk kullanımda bir kez üretilir.
let dummyHash: Promise<string> | null = null;

/** Kullanıcı yokken de gerçek bir doğrulama kadar zaman harcar. */
export async function burnVerification(candidate: unknown): Promise<false> {
  if (!dummyHash) dummyHash = bcrypt.hash('support-chat-timing-equaliser', BCRYPT_COST);
  await bcrypt.compare(String(candidate ?? ''), await dummyHash);
  return false;
}
