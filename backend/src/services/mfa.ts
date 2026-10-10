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
import { derivedKey, derivedKeys, keyId } from '../config/tokens';
import { generateTotpSecret, otpauthUri, verifyTotp } from './totp';
import { withTransaction } from '../db/pool';
import type { AuthenticatedUser } from '../types/auth';
import type { UserType } from '../types/auth';
import type { PoolClient } from 'pg';

export const RECOVERY_CODE_COUNT = 10;
const ISSUER = 'Support.io';

/** `abcde-fghij`: 50 random bits, no ambiguous characters. */
function newRecoveryCode(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(10);
  const chars = [...bytes].map((b) => alphabet[b % alphabet.length]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

const normalise = (code: string) => code.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * What is stored for a recovery code: the id of the key it was hashed with
 * and a keyed hash, so a database dump alone does not reveal the codes and
 * a JWT_SECRET rotation knows which accounts still hold codes from the old
 * key (SEC-18, npm run secrets:rotate).
 */
function recoveryHash(code: string, key = derivedKey('recovery-codes')): string {
  return `${keyId(key)}:${crypto.createHmac('sha256', key).update(normalise(code)).digest('hex')}`;
}

/** Every stored form a typed code may match: each known key, with and without its id. */
function recoveryCandidates(code: string): string[] {
  return derivedKeys('recovery-codes').flatMap((key) => {
    const stored = recoveryHash(code, key);
    return [stored, stored.slice(stored.indexOf(':') + 1)];
  });
}

/** Whether a stored recovery code was hashed with the current key. */
export function recoveryCodeIsCurrent(stored: string): boolean {
  return stored.startsWith(`${keyId(derivedKey('recovery-codes'))}:`);
}

export function mfaEnabled(account: AuthenticatedUser): boolean {
  return Boolean(account.totpEnabledAt && account.totpSecretEnc);
}

interface LockedMfaRow {
  totp_secret_enc: string | null;
  totp_enabled_at: Date | null;
  totp_last_step: string | number | null;
  recovery_codes: string[] | null;
}

const accountTable = (userType: UserType): 'users' | 'teams' =>
  userType === 'team' ? 'teams' : 'users';

async function lockedMfaRow(
  client: PoolClient,
  account: AuthenticatedUser,
  userType: UserType
): Promise<LockedMfaRow | null> {
  const table = accountTable(userType);
  const { rows } = await client.query<LockedMfaRow>(
    `SELECT totp_secret_enc, totp_enabled_at, totp_last_step, recovery_codes
       FROM ${table} WHERE id = $1 AND is_active = true FOR UPDATE`,
    [account._id]
  );
  return rows[0] ?? null;
}

/** Starts (or restarts) enrolment: a new secret, not yet in force. */
export async function beginEnrollment(
  account: AuthenticatedUser,
  userType: UserType
): Promise<{ secret: string; uri: string }> {
  const secret = generateTotpSecret();
  const sealed = seal(secret);
  await withTransaction(async (client) => {
    if (!(await lockedMfaRow(client, account, userType))) throw new Error('Account not found');
    await client.query(
      `UPDATE ${accountTable(userType)}
          SET totp_secret_enc = $2, totp_enabled_at = NULL,
              totp_last_step = NULL, recovery_codes = '[]'::jsonb, updated_at = now()
        WHERE id = $1`,
      [account._id, sealed]
    );
  });
  account.totpSecretEnc = sealed;
  account.totpEnabledAt = null;
  account.totpLastStep = null;
  account.recoveryCodes = [];
  return { secret, uri: otpauthUri({ secret, account: account.email, issuer: ISSUER }) };
}

/**
 * Switches two-step sign-in on when `code` matches the pending secret.
 * Returns the recovery codes (shown once), or null when the code is wrong.
 */
export async function confirmEnrollment(
  account: AuthenticatedUser,
  userType: UserType,
  code: unknown
): Promise<string[] | null> {
  return withTransaction(async (client) => {
    const row = await lockedMfaRow(client, account, userType);
    if (!row || (row.totp_enabled_at && row.totp_secret_enc)) return null;
    const secret = open(row.totp_secret_enc);
    if (!secret) return null;
    const step = verifyTotp(secret, code);
    if (step === null) return null;
    const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
    const hashes = codes.map((recoveryCode) => recoveryHash(recoveryCode));
    const enabledAt = new Date();
    await client.query(
      `UPDATE ${accountTable(userType)}
          SET totp_enabled_at = $2, totp_last_step = $3,
              recovery_codes = $4::jsonb, updated_at = now()
        WHERE id = $1`,
      [account._id, enabledAt, step, JSON.stringify(hashes)]
    );
    account.totpEnabledAt = enabledAt;
    account.totpLastStep = step;
    account.recoveryCodes = hashes;
    return codes;
  });
}

/** Fresh recovery codes; the old ones stop working. */
export async function regenerateRecoveryCodes(
  account: AuthenticatedUser,
  userType: UserType
): Promise<string[]> {
  const codes = Array.from({ length: RECOVERY_CODE_COUNT }, newRecoveryCode);
  const hashes = codes.map((code) => recoveryHash(code));
  await withTransaction(async (client) => {
    if (!(await lockedMfaRow(client, account, userType))) throw new Error('Account not found');
    await client.query(
      `UPDATE ${accountTable(userType)} SET recovery_codes = $2::jsonb, updated_at = now()
        WHERE id = $1`,
      [account._id, JSON.stringify(hashes)]
    );
  });
  account.recoveryCodes = hashes;
  return codes;
}

export async function disableMfa(account: AuthenticatedUser, userType: UserType): Promise<void> {
  await withTransaction(async (client) => {
    if (!(await lockedMfaRow(client, account, userType))) throw new Error('Account not found');
    await client.query(
      `UPDATE ${accountTable(userType)}
          SET totp_secret_enc = NULL, totp_enabled_at = NULL,
              totp_last_step = NULL, recovery_codes = '[]'::jsonb, updated_at = now()
        WHERE id = $1`,
      [account._id]
    );
  });
  account.totpSecretEnc = null;
  account.totpEnabledAt = null;
  account.totpLastStep = null;
  account.recoveryCodes = [];
}

/**
 * Checks the second step: an authenticator code, or a recovery code (which
 * is then spent). Says which one matched, or null.
 */
export async function verifySecondStep(
  account: AuthenticatedUser,
  userType: UserType,
  { code, recoveryCode }: { code?: unknown; recoveryCode?: unknown }
): Promise<'totp' | 'recovery' | null> {
  return withTransaction(async (client) => {
    const row = await lockedMfaRow(client, account, userType);
    if (!row || !(row.totp_enabled_at && row.totp_secret_enc)) return null;
    if (typeof code === 'string' && code) {
      const secret = open(row.totp_secret_enc);
      if (!secret) return null;
      const lastStep = row.totp_last_step === null ? null : Number(row.totp_last_step);
      const step = verifyTotp(secret, code, { lastStep });
      if (step === null) return null;
      await client.query(
        `UPDATE ${accountTable(userType)} SET totp_last_step = $2, updated_at = now()
          WHERE id = $1`,
        [account._id, step]
      );
      account.totpLastStep = step;
      return 'totp';
    }
    if (typeof recoveryCode === 'string' && recoveryCode && recoveryCode.length <= 32) {
      const hashes = recoveryCandidates(recoveryCode);
      const stored = Array.isArray(row.recovery_codes) ? row.recovery_codes : [];
      const index = stored.findIndex((candidate) =>
        hashes.some((hash) => {
          const candidateBytes = Buffer.from(candidate, 'utf8');
          const hashBytes = Buffer.from(hash, 'utf8');
          return (
            candidateBytes.length === hashBytes.length &&
            crypto.timingSafeEqual(candidateBytes, hashBytes)
          );
        })
      );
      if (index < 0) return null;
      const remaining = stored.filter((_, i) => i !== index);
      await client.query(
        `UPDATE ${accountTable(userType)} SET recovery_codes = $2::jsonb, updated_at = now()
          WHERE id = $1`,
        [account._id, JSON.stringify(remaining)]
      );
      account.recoveryCodes = remaining;
      return 'recovery';
    }
    return null;
  });
}

/** How many unused recovery codes the account still has. */
export function recoveryCodesLeft(account: AuthenticatedUser): number {
  return Array.isArray(account.recoveryCodes) ? account.recoveryCodes.length : 0;
}
