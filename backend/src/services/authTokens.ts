// One-time links sent by e-mail: verify an address, reset a password.
//
// The raw token exists only in the mail. The database keeps its SHA-256, so
// reading the table yields no working link. A token is spent by the same
// UPDATE that checks it (`used_at IS NULL AND expires_at > now()`), which makes
// it single-use even when the link is opened twice at the same moment.

import crypto from 'crypto';
import { query } from '../db/pool';
import { generateId } from '../db/objectId';
import type { UserType } from '../types/auth';

export type AuthTokenPurpose = 'verify' | 'reset';

/** How long each kind of link works. */
export const AUTH_TOKEN_TTL_SECONDS: Record<AuthTokenPurpose, number> = {
  verify: 24 * 60 * 60,
  reset: 60 * 60
};

export interface TokenAccount {
  id: string;
  type: UserType;
}

const hashOf = (token: string): string => crypto.createHash('sha256').update(token).digest('hex');

/**
 * A fresh link token for the account. Any earlier unused one of the same
 * purpose stops working: only the newest mail's link is valid.
 */
export async function issueAuthToken(
  account: TokenAccount,
  purpose: AuthTokenPurpose
): Promise<string> {
  const token = crypto.randomBytes(32).toString('base64url');
  await query(
    `UPDATE auth_tokens SET used_at = now()
      WHERE account_id = $1 AND account_type = $2 AND purpose = $3 AND used_at IS NULL`,
    [account.id, account.type, purpose]
  );
  await query(
    `INSERT INTO auth_tokens (id, account_id, account_type, purpose, token_hash, expires_at)
     VALUES ($1, $2, $3, $4, $5, now() + make_interval(secs => $6))`,
    [generateId(), account.id, account.type, purpose, hashOf(token), AUTH_TOKEN_TTL_SECONDS[purpose]]
  );
  return token;
}

/**
 * Spends a token: the account it was issued to, or null when the token is
 * unknown, of another purpose, expired or already used. Never says which.
 */
export async function consumeAuthToken(
  token: unknown,
  purpose: AuthTokenPurpose
): Promise<TokenAccount | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  const { rows } = await query<{ account_id: string; account_type: UserType }>(
    `UPDATE auth_tokens SET used_at = now()
      WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
      RETURNING account_id, account_type`,
    [hashOf(token), purpose]
  );
  return rows[0] ? { id: rows[0].account_id, type: rows[0].account_type } : null;
}

/** Ends every outstanding link of one purpose, e.g. after a reset succeeded. */
export async function revokeAuthTokens(
  account: TokenAccount,
  purpose: AuthTokenPurpose
): Promise<void> {
  await query(
    `UPDATE auth_tokens SET used_at = now()
      WHERE account_id = $1 AND account_type = $2 AND purpose = $3 AND used_at IS NULL`,
    [account.id, account.type, purpose]
  );
}
