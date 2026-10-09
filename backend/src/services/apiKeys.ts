// Keys for the public API (plan v10 PRD-12).
//
//   sk_live_<40 characters>    shown once; the database keeps its SHA-256
//
// A key belongs to a workspace and carries scopes: read (GET) and write
// (everything else). It works only while the workspace's plan includes the
// API; a revoked key answers 401 like an unknown one.

import crypto from 'crypto';
import { query } from '../db/pool';
import { generateId } from '../db/objectId';

export const API_SCOPES = ['read', 'write'] as const;
export type ApiScope = (typeof API_SCOPES)[number];

const PREFIX = 'sk_live_';
const KEY = /^sk_live_[A-Za-z0-9_-]{40}$/;

export const hashKey = (key: string) => crypto.createHash('sha256').update(key).digest('hex');

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  created_at: Date;
  last_used_at: Date | null;
  revoked_at: Date | null;
}

export const presentKey = (row: ApiKeyRow) => ({
  _id: row.id,
  name: row.name,
  prefix: row.prefix,
  scopes: row.scopes,
  createdAt: row.created_at,
  lastUsedAt: row.last_used_at,
  revokedAt: row.revoked_at
});

/** Makes a key; the whole key is in the answer and nowhere else, ever. */
export async function createApiKey(
  organizationId: string,
  name: string,
  scopes: ApiScope[],
  createdBy: string
): Promise<{ key: string; row: ApiKeyRow }> {
  const key = PREFIX + crypto.randomBytes(30).toString('base64url');
  const { rows } = await query<ApiKeyRow>(
    `INSERT INTO api_keys (id, organization_id, name, prefix, key_hash, scopes, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, prefix, scopes, created_at, last_used_at, revoked_at`,
    [
      generateId(),
      organizationId,
      name,
      key.slice(0, PREFIX.length + 6),
      hashKey(key),
      scopes,
      createdBy
    ]
  );
  return { key, row: rows[0] };
}

export interface ApiCaller {
  keyId: string;
  name: string;
  organizationId: string;
  scopes: ApiScope[];
}

/**
 * The workspace behind a key, or null when it is unknown or revoked. The
 * plan is checked by the caller, so it can say so. The last use is written
 * at most once a minute.
 */
export async function callerForKey(key: string): Promise<ApiCaller | null> {
  if (!KEY.test(key)) return null;
  const { rows } = await query<{
    id: string;
    name: string;
    organization_id: string;
    scopes: ApiScope[];
    last_used_at: Date | null;
  }>(
    `SELECT id, name, organization_id, scopes, last_used_at FROM api_keys
      WHERE key_hash = $1 AND revoked_at IS NULL`,
    [hashKey(key)]
  );
  const row = rows[0];
  if (!row) return null;
  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    await query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [row.id]);
  }
  return { keyId: row.id, name: row.name, organizationId: row.organization_id, scopes: row.scopes };
}
