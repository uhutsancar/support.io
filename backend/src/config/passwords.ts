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
//   politika   en az 8 karakter (NIST SP 800-63B). bcrypt 72 bayttan
//              sonrasını sessizce yok sayar: 100 karakterlik bir parolanın
//              son 28 karakteri hiçbir şey korumaz. Bu yüzden üst sınır
//              karakter değil bayt olarak 72.
//   zamanlama  kullanıcı bulunamadığında da gerçek hash'lerle AYNI maliyette
//              bir bcrypt karşılaştırması yapılır. Aksi halde "kayıtlı değil"
//              yanıtı milisaniyeler içinde, "yanlış parola" yanıtı yüzlerce
//              ms sonra döner ve aynı hata mesajına rağmen hangi e-postaların
//              kayıtlı olduğu yanıt süresinden okunur. Kukla hash farklı
//              maliyette olursa fark bu sefer ters yönde açılır.

import bcrypt from 'bcryptjs';

export const BCRYPT_COST = 10;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

/** Politikaya uymayan parola için kullanıcıya gösterilecek mesaj; uyuyorsa null. */
export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string') return 'Password is required';
  if (password.length < PASSWORD_MIN_LENGTH) return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
  if (Buffer.byteLength(password, 'utf8') > PASSWORD_MAX_BYTES) return `Password must be at most ${PASSWORD_MAX_BYTES} bytes`;
  return null;
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
