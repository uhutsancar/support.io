// Secrets a tenant's integrations need, sealed before they reach the database.
//
// A site's identity-verification key and its order-service signing key are
// what let us vouch for a customer and fetch their orders. Stored in the clear,
// a database dump or a read-only SQL bug would hand both to whoever held it.
// They are sealed with AES-256-GCM under a key derived from JWT_SECRET for
// this one purpose (config/tokens.ts), so the dump alone is not enough.
//
// The consequence to know about: rotating JWT_SECRET makes every sealed value
// unreadable. `open` then returns null, the integration behaves as not
// configured, and the site owner generates new keys in the panel.

import crypto from 'crypto';
import { derivedKey } from './tokens';

const VERSION = 'v1';
const IV_BYTES = 12;

function key(): Buffer {
  return derivedKey('site-secrets');
}

/** Seals a secret into a self-describing string: version, IV, tag, ciphertext. */
export function seal(plain: string): string {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [
    VERSION,
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url')
  ].join('.');
}

/**
 * The secret back, or null when the value is missing, tampered with, or was
 * sealed under a different JWT_SECRET.
 */
export function open(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const [version, iv, tag, ciphertext] = sealed.split('.');
  if (version !== VERSION || !iv || !tag || !ciphertext) return null;
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final()
    ]).toString('utf8');
  } catch {
    // A failed authentication tag is the expected outcome for a tampered
    // value or a rotated JWT_SECRET; both mean "not configured".
    return null;
  }
}

/** A new random secret for a tenant to copy into their own server. */
export function newSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}
