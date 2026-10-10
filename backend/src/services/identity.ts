// Who the visitor is, when the shop vouches for it.
//
// The widget's `SupportChat.identify({ userId, ... })` is set from the
// customer's page, so on its own it proves nothing: anyone can type any user id
// into a browser console. The shop's server signs the id with a key only it
// and we know —
//
//     v1.<expiry>.<nonce>.HMAC(identityKey, canonical assertion)
//
// — and we accept the id only when that signature checks out. An identity that
// fails is not an error: the visitor simply stays anonymous, and a
// conversation a verified customer had is never reopened for anyone else in
// the same browser (socket/handlers/widget.ts).

import crypto from 'crypto';
import { open } from '../config/secretBox';
import { query } from '../db/pool';
import type { SiteIntegrations } from '../domain';

const MAX_USER_ID = 128;
const IDENTITY_AUDIENCE = 'support.io/widget-identity/v1';
const MAX_ASSERTION_LIFETIME_SECONDS = 10 * 60;

function assertionPayload(siteKey: string, userId: string, expires: number, nonce: string): string {
  return `${IDENTITY_AUDIENCE}\n${siteKey}\n${userId}\n${expires}\n${nonce}`;
}

/** Creates the short-lived value a tenant backend gives to identify(). */
export function identityAssertionFor(
  secret: string,
  siteKey: string,
  userId: string,
  lifetimeSeconds = 5 * 60
): string {
  const lifetime = Math.min(
    Math.max(Math.floor(lifetimeSeconds), 30),
    MAX_ASSERTION_LIFETIME_SECONDS
  );
  const expires = Math.floor(Date.now() / 1000) + lifetime;
  const nonce = crypto.randomBytes(16).toString('hex');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(assertionPayload(siteKey, userId, expires, nonce))
    .digest('hex');
  return `v1.${expires}.${nonce}.${signature}`;
}

export function userHashFor(secret: string, userId: string): string {
  return crypto.createHmac('sha256', secret).update(userId).digest('hex');
}

/**
 * The user id, if the site has identity verification set up and the hash is
 * the one its key produces; null otherwise.
 */
async function bindAssertionNonce(
  siteId: string,
  nonce: string,
  sessionId: string,
  expires: number
): Promise<boolean> {
  try {
    const { rows } = await query<{ nonce: string }>(
      `INSERT INTO identity_assertion_uses (site_id, nonce, session_id, expires_at)
       VALUES ($1, $2, $3, to_timestamp($4))
       ON CONFLICT (site_id, nonce) DO UPDATE SET used_at = now()
         WHERE identity_assertion_uses.session_id = EXCLUDED.session_id
           AND identity_assertion_uses.expires_at >= now()
       RETURNING nonce`,
      [siteId, nonce, sessionId, expires]
    );
    return Boolean(rows[0]);
  } catch {
    // Replay protection is part of the identity proof. If its durable state
    // cannot be checked, leave the visitor anonymous.
    return false;
  }
}

export async function verifiedIdentity(
  integrations: SiteIntegrations | undefined,
  userId: unknown,
  userHash: unknown,
  siteKey?: string,
  binding?: { siteId: string; sessionId: string }
): Promise<string | null> {
  if (typeof userId !== 'string' || typeof userHash !== 'string') return null;
  if (!userId || userId.length > MAX_USER_ID) return null;

  const secret = open(integrations?.identitySecret);
  if (!secret) return null;

  const assertion = /^v1\.(\d{10})\.([0-9a-f]{32})\.([0-9a-f]{64})$/i.exec(userHash);
  if (assertion && siteKey) {
    const expires = Number(assertion[1]);
    const now = Math.floor(Date.now() / 1000);
    if (expires < now - 30 || expires > now + MAX_ASSERTION_LIFETIME_SECONDS) return null;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(assertionPayload(siteKey, userId, expires, assertion[2].toLowerCase()))
      .digest();
    const given = Buffer.from(assertion[3], 'hex');
    if (given.length !== expected.length || !crypto.timingSafeEqual(expected, given)) return null;
    if (!binding?.siteId || !binding.sessionId) return null;
    return (await bindAssertionNonce(
      binding.siteId,
      assertion[2].toLowerCase(),
      binding.sessionId,
      expires
    ))
      ? userId
      : null;
  }

  // A bounded transition is available outside production and only when
  // explicitly enabled in production. New integrations must use v1.
  const legacyAllowed =
    process.env.NODE_ENV !== 'production' || process.env.ALLOW_LEGACY_IDENTITY_HASH === 'true';
  if (!legacyAllowed || !/^[0-9a-f]{64}$/i.test(userHash)) return null;

  const expected = Buffer.from(userHashFor(secret, userId), 'hex');
  const given = Buffer.from(userHash, 'hex');
  // Constant time: a comparison that stops at the first wrong byte tells an
  // attacker, one byte at a time, how much of their guess was right.
  return given.length === expected.length && crypto.timingSafeEqual(expected, given)
    ? userId
    : null;
}
