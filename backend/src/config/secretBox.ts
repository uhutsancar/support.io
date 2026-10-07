// Secrets a tenant's integrations need, sealed before they reach the database.
//
// A site's identity-verification key and an account's authenticator secret
// are what let us vouch for a customer and check a second sign-in step.
// Stored in the clear, a database dump or a read-only SQL bug would hand them
// to whoever held it. They are sealed with AES-256-GCM under a key derived
// from JWT_SECRET for this one purpose (config/tokens.ts), so the dump alone
// is not enough.
//
// Rotation (plan v10 SEC-18): a sealed value names the key it was sealed
// with (`v2.<key id>.…`). While JWT_SECRET_PREVIOUS is set, values sealed
// under the old secret still open; `npm run secrets:rotate` re-seals them all
// under the new one, after which the old secret can go. A value no key opens
// reads as "not configured", and the owner generates a new one in the panel.
// Values from before key ids (`v1.…`) are tried against every key.

import crypto from 'crypto';
import { derivedKey, derivedKeys, keyId } from './tokens';

const VERSION = 'v2';
const IV_BYTES = 12;
const PURPOSE = 'site-secrets';

/** Seals a secret into a self-describing string: version, key id, IV, tag, ciphertext. */
export function seal(plain: string): string {
  const key = derivedKey(PURPOSE);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    VERSION,
    keyId(key),
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url')
  ].join('.');
}

function decrypt(key: Buffer, iv: string, tag: string, ciphertext: string): string | null {
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    // A failed authentication tag is the expected outcome for a tampered
    // value or a key that is not the one it was sealed with.
    return null;
  }
}

/**
 * The secret back, or null when the value is missing, tampered with, or was
 * sealed under a secret this process no longer knows.
 */
export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const parts = sealed.split('.');
  if (parts[0] === 'v2' && parts.length === 5) {
    const [, kid, iv, tag, ciphertext] = parts;
    const key = derivedKeys(PURPOSE).find((candidate) => keyId(candidate) === kid);
    return key ? decrypt(key, iv, tag, ciphertext) : null;
  }
  if (parts[0] === 'v1' && parts.length === 4) {
    const [, iv, tag, ciphertext] = parts;
    for (const key of derivedKeys(PURPOSE)) {
      const plain = decrypt(key, iv, tag, ciphertext);
      if (plain !== null) return plain;
    }
  }
  return null;
}

/** Whether a sealed value is already under the current key. */
export function sealedWithCurrentKey(sealed: string | null | undefined): boolean {
  return Boolean(sealed?.startsWith(`${VERSION}.${keyId(derivedKey(PURPOSE))}.`));
}

/** The value sealed again under the current key, or null if no key opens it. */
export function reseal(sealed: string | null | undefined): string | null {
  const plain = open(sealed);
  return plain === null ? null : seal(plain);
}

/** A new random secret for a tenant to copy into their own server. */
export function newSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
