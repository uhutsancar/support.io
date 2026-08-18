'use strict';

const crypto = require('crypto');

// Primary keys keep the 24-character hexadecimal shape that MongoDB ObjectIds
// used. Every existing identifier therefore migrates unchanged, which keeps
// already-issued JWTs, widget-side cached ids and the admin panel's `_id`
// references working exactly as before.

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

const MACHINE_ID = crypto.randomBytes(5);
let counter = crypto.randomBytes(3).readUIntBE(0, 3);

function generateId() {
  const buf = Buffer.allocUnsafe(12);
  buf.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
  MACHINE_ID.copy(buf, 4);
  counter = (counter + 1) % 0xffffff;
  buf.writeUIntBE(counter, 9, 3);
  return buf.toString('hex');
}

function isValidObjectId(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return OBJECT_ID_RE.test(value);
  if (typeof value === 'object' && typeof value.toString === 'function') {
    return OBJECT_ID_RE.test(value.toString());
  }
  return false;
}

// Accepts anything the old code passed around as an ObjectId: a raw string, a
// populated document, or an object exposing `_id`.
function toId(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (value._id !== undefined && value._id !== null) return toId(value._id);
    if (typeof value.toHexString === 'function') return value.toHexString();
  }
  return String(value);
}

// The timestamp is embedded in the first 4 bytes, mirroring ObjectId#getTimestamp.
function timestampFromId(id) {
  if (!isValidObjectId(id)) return null;
  return new Date(parseInt(String(id).slice(0, 8), 16) * 1000);
}

module.exports = { generateId, isValidObjectId, toId, timestampFromId, OBJECT_ID_RE };
