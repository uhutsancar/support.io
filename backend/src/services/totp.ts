// Time-based one-time passwords (RFC 6238 over RFC 4226), for two-step
// sign-in with an authenticator app (plan v10 SEC-04).
//
// Small enough to own instead of adding a dependency: HMAC-SHA1, 30-second
// steps, 6 digits — the parameters every authenticator app defaults to.
// A code is accepted for the current step and one step either side (clock
// drift), and never for a step at or before the last one accepted, so a code
// read over someone's shoulder cannot be used a second time.

import crypto from 'crypto';

export const TOTP_STEP_SECONDS = 30;
export const TOTP_DIGITS = 6;
/** Steps accepted on either side of now. */
export const TOTP_WINDOW = 1;

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  const clean = text.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Not a base32 string');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A new 160-bit secret, base32 as authenticator apps expect it. */
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20));
}

/** The 30-second step a moment falls in. */
export function stepAt(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / TOTP_STEP_SECONDS);
}

/** The code for one step (RFC 4226 HOTP with the step as the counter). */
export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = (hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** TOTP_DIGITS;
  return String(binary).padStart(TOTP_DIGITS, '0');
}

/**
 * The step a code matches, or null. `lastStep` is the step of the last code
 * accepted for this account; that step and every earlier one are refused.
 */
export function verifyTotp(
  secret: string,
  code: unknown,
  { atMs = Date.now(), lastStep = null }: { atMs?: number; lastStep?: number | null } = {}
): number | null {
  if (typeof code !== 'string') return null;
  const digits = code.replace(/\s/g, '');
  if (!/^\d{6}$/.test(digits)) return null;
  const now = stepAt(atMs);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset++) {
    const step = now + offset;
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (crypto.timingSafeEqual(expected, Buffer.from(digits))) return step;
  }
  return null;
}

/** The otpauth:// address an authenticator app reads from the QR code. */
export function otpauthUri({
  secret,
  account,
  issuer
}: {
  secret: string;
  account: string;
  issuer: string;
}): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS)
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
