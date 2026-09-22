// Primary keys keep the 24-character hexadecimal shape that MongoDB ObjectIds
// used. Every existing identifier therefore migrates unchanged, which keeps
// already-issued JWTs, widget-side cached ids and the admin panel's `_id`
// references working exactly as before.

import crypto from 'crypto';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const MACHINE_ID = crypto.randomBytes(5);
let counter = crypto.randomBytes(3).readUIntBE(0, 3);

/** Anything the code passes around where an identifier is expected. */
export type IdLike = string | null | undefined | { _id?: unknown; toHexString?: () => string };

export function generateId(): string {
  const buf = Buffer.allocUnsafe(12);
  buf.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
  MACHINE_ID.copy(buf, 4);
  counter = (counter + 1) % 0xffffff;
  buf.writeUIntBE(counter, 9, 3);
  return buf.toString('hex');
}

export function isValidObjectId(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return OBJECT_ID_RE.test(value);
  if (typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    return OBJECT_ID_RE.test(String(value));
  }
  return false;
}

// Accepts anything the old code passed around as an ObjectId: a raw string, a
// populated document, or an object exposing `_id`.
export function toId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    const candidate = value as { _id?: unknown; toHexString?: () => string };
    if (candidate._id !== undefined && candidate._id !== null) return toId(candidate._id);
    if (typeof candidate.toHexString === 'function') return candidate.toHexString();
  }
  return String(value);
}

// The timestamp is embedded in the first 4 bytes, mirroring ObjectId#getTimestamp.
export function timestampFromId(id: unknown): Date | null {
  if (!isValidObjectId(id)) return null;
  return new Date(parseInt(String(id).slice(0, 8), 16) * 1000);
}

export { OBJECT_ID_RE };
