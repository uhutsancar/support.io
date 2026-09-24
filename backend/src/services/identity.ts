// Who the visitor is, when the shop vouches for it.
//
// The widget's `SupportChat.identify({ userId, ... })` is set from the
// customer's page, so on its own it proves nothing: anyone can type any user id
// into a browser console. The shop's server signs the id with a key only it
// and we know —
//
//     userHash = HMAC_SHA256(identityKey, userId)   (hex)
//
// — and we accept the id only when that signature checks out. An identity that
// fails is not an error: the visitor simply stays anonymous. Only a verified id
// is ever used to fetch orders (services/orderLookup.ts).

import crypto from 'crypto';
import { open } from '../config/secretBox';
import type { SiteIntegrations } from '../domain';

const MAX_USER_ID = 128;

export function userHashFor(secret: string, userId: string): string {
  return crypto.createHmac('sha256', secret).update(userId).digest('hex');
}

/**
 * The user id, if the site has identity verification set up and the hash is
 * the one its key produces; null otherwise.
 */
export function verifiedIdentity(
  integrations: SiteIntegrations | undefined,
  userId: unknown,
  userHash: unknown
): string | null {
  if (typeof userId !== 'string' || typeof userHash !== 'string') return null;
  if (!userId || userId.length > MAX_USER_ID || !/^[0-9a-f]{64}$/i.test(userHash)) return null;

  const secret = open(integrations?.identitySecret);
  if (!secret) return null;

  const expected = Buffer.from(userHashFor(secret, userId), 'hex');
  const given = Buffer.from(userHash, 'hex');
  // Constant time: a comparison that stops at the first wrong byte tells an
  // attacker, one byte at a time, how much of their guess was right.
  return crypto.timingSafeEqual(expected, given) ? userId : null;
}
