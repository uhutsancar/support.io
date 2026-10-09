// Blocking a visitor (plan v10 SEC-09).
//
// An agent blocks the visitor of a conversation for 30 days (or another
// period): by the server-minted visitor id, and by a keyed hash of the IP
// address they were last seen from, so clearing the browser's storage is
// not enough to come back. The IP itself is not stored here — only the hash,
// and only to compare. A blocked visitor's widget gets no socket, no upload
// and a polite line instead of the chat.

import crypto from 'crypto';
import { ipKeyGenerator } from 'express-rate-limit';
import { query } from '../db/pool';
import { generateId } from '../db/objectId';
import { derivedKeys } from '../config/tokens';

/**
 * The keyed hash a block compares. An IPv6 address counts by its /56, as the
 * rate limits do: one home connection hands out a whole range of them.
 */
export function ipHash(ip: string | null | undefined): string | null {
  return ipHashes(ip)[0] ?? null;
}

/**
 * The address's hash under the current secret, and during a JWT_SECRET
 * rotation under the previous one too, so blocks made before it still hold
 * (SEC-18). The first is the one new blocks store.
 */
function ipHashes(ip: string | null | undefined): string[] {
  const value = String(ip || '')
    .replace(/^::ffff:/, '')
    .trim();
  if (!value) return [];
  const network = ipKeyGenerator(value);
  return derivedKeys('visitor-ip').map((key) =>
    crypto.createHmac('sha256', key).update(network).digest('hex').slice(0, 32)
  );
}

/** The refusal a blocked visitor's widget turns into its polite line. */
export const VISITOR_BLOCKED = 'VISITOR_BLOCKED';

export async function isBlocked({
  siteId,
  visitorId,
  ip
}: {
  siteId: string;
  visitorId?: string | null;
  ip?: string | null;
}): Promise<boolean> {
  const hashes = ipHashes(ip);
  if (!visitorId && !hashes.length) return false;
  const { rows } = await query(
    `SELECT 1 FROM visitor_blocks
      WHERE site_id = $1 AND expires_at > now()
        AND ((visitor_id IS NOT NULL AND visitor_id = $2) OR (ip_hash IS NOT NULL AND ip_hash = ANY($3)))
      LIMIT 1`,
    [siteId, visitorId || null, hashes]
  );
  return rows.length > 0;
}

export async function blockVisitor({
  organizationId,
  siteId,
  visitorId,
  ip,
  reason,
  days = 30,
  blockedBy
}: {
  organizationId: string;
  siteId: string;
  visitorId: string;
  ip: string | null;
  reason: string | null;
  days?: number;
  blockedBy: string;
}): Promise<string> {
  const id = generateId();
  const span = Math.min(Math.max(Math.round(days), 1), 365);
  await query(
    `INSERT INTO visitor_blocks (id, organization_id, site_id, visitor_id, ip_hash, reason, blocked_by, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, now() + make_interval(days => $8))`,
    [id, organizationId, siteId, visitorId, ipHash(ip), reason, blockedBy, span]
  );
  return id;
}

export async function unblockVisitor(organizationId: string, id: string): Promise<boolean> {
  const { rowCount } = await query(
    'DELETE FROM visitor_blocks WHERE id = $1 AND organization_id = $2',
    [id, organizationId]
  );
  return Boolean(rowCount);
}

export async function listBlocks(organizationId: string, siteId: string) {
  const { rows } = await query<{
    id: string;
    visitor_id: string | null;
    reason: string | null;
    expires_at: Date;
    created_at: Date;
  }>(
    `SELECT id, visitor_id, reason, expires_at, created_at FROM visitor_blocks
      WHERE organization_id = $1 AND site_id = $2 AND expires_at > now()
      ORDER BY created_at DESC LIMIT 500`,
    [organizationId, siteId]
  );
  return rows.map((r) => ({
    _id: r.id,
    visitorId: r.visitor_id,
    reason: r.reason,
    expiresAt: r.expires_at,
    createdAt: r.created_at
  }));
}

const URL_RX = /\b(?:https?:\/\/|www\.)\S+/gi;

/**
 * Whether a visitor message looks like spam: more than three links, or the
 * same text a third time in a row (SEC-09).
 */
export function looksLikeSpam(content: string, previous: string[]): boolean {
  if ((content.match(URL_RX) || []).length > 3) return true;
  const same = previous.slice(-2).filter((p) => p.trim() === content.trim());
  return same.length >= 2;
}

export function hasLink(content: string): boolean {
  return new RegExp(URL_RX.source, 'i').test(content);
}
