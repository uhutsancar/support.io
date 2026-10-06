// Two-step sign-in for panel accounts (plan v10 SEC-04).
//
// Enrolment is two calls so a secret is never switched on unseen: `begin`
// stores a fresh sealed secret and returns the otpauth address for the QR
// code; `confirm` switches it on only once a code from the app matches, and
// hands out ten recovery codes exactly once. Recovery codes are kept as
// keyed hashes (HMAC under a key derived from JWT_SECRET), so a copy of the
// database alone does not let anyone try them offline; each works once.

import crypto from 'crypto';
import { seal, open } from '../config/secretBox';
import { derivedKey } from '../config/tokens';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';
import type { AuthenticatedUser } from '../types/auth';

export const RECOVERY_CODE_COUNT = 10;
const ISSUER = 'Support.io';

/** `abcde-fghij`: 50 random bits, no ambiguous characters. */
function newRecoveryCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

function recoveryHash(code: string): string {
  const normalised = code.toLowerCase().replace(/[^a-z0-9]/g, '');
  return crypto.createHmac('sha256', derivedKey('recovery-codes')).update(normalised).digest('hex');
}

export function mfaEnabled(account: AuthenticatedUser): boolean {
  return Boolean(account.totpEnabledAt && account.totpSecretEnc);
}

/** Starts (or restarts) enrolment: a new secret, not yet in force. */
export async function beginEnrollment(
  account: AuthenticatedUser
): Promise<{ secret: string; uri: string }> {
  const secret = generateTotpSecret();
  account.totpSecretEnc = seal(secret);
  account.totpEnabledAt = null;
  account.totpLastStep = null;
  await account.save();
  return { secret, uri: otpauthUri({ secret, account: account.email, issuer: ISSUER }) };
}

/**
 * Switches two-step sign-in on when `code` matches the pending secret.
 * Returns the recovery codes (shown once), or null when the code is wrong.
 */
export async function confirmEnrollment(
  account: AuthenticatedUser,
  code: unknown
): Promise<string[] | null> {
  if (mfaEnabled(account)) return null;
  const secret = open(account.totpSecretEnc);
  if (!secret) return null;
  const step = verifyTotp(secret, code);
  if (step === null) return null;
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  account.totpEnabledAt = new Date();
  account.totpLastStep = step;
  account.recoveryCodes = codes.map(recoveryHash);
  await account.save();
  return codes;
}

/** Fresh recovery codes; the old ones stop working. */
export async function regenerateRecoveryCodes(account: AuthenticatedUser): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  account.recoveryCodes = codes.map(recoveryHash);
  await account.save();
  return codes;
}

export async function disableMfa(account: AuthenticatedUser): Promise<void> {
  account.totpSecretEnc = null;
  account.totpEnabledAt = null;
  account.totpLastStep = null;
  account.recoveryCodes = [];
  await account.save();
}

/**
 * Checks the second step: an authenticator code, or a recovery code (which
 * is then spent). Says which one matched, or null.
 */
export async function verifySecondStep(
  account: AuthenticatedUser,
  { code, recoveryCode }: { code?: unknown; recoveryCode?: unknown }
): Promise<'totp' | 'recovery' | null> {
  if (!mfaEnabled(account)) return null;
  if (typeof code === 'string' && code) {
    const secret = open(account.totpSecretEnc);
    if (!secret) return null;
    const step = verifyTotp(secret, code, { lastStep: account.totpLastStep });
    if (step === null) return null;
    account.totpLastStep = step;
    await account.save();
    return 'totp';
  }
  if (typeof recoveryCode === 'string' && recoveryCode && recoveryCode.length <= 32) {
    const hash = recoveryHash(recoveryCode);
    const stored = Array.isArray(account.recoveryCodes) ? account.recoveryCodes : [];
    const index = stored.findIndex(
      (candidate) =>
        candidate.length === hash.length &&
        crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash))
    );
    if (index < 0) return null;
    account.recoveryCodes = stored.filter((_, i) => i !== index);
    await account.save();
    return 'recovery';
  }
  return null;
}

/** How many unused recovery codes the account still has. */
export function recoveryCodesLeft(account: AuthenticatedUser): number {
  return Array.isArray(account.recoveryCodes) ? account.recoveryCodes.length : 0;
}
