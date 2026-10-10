// File uploads: chat attachments and site logos (plan v10 SEC-07, SEC-08).
//
// What arrives is held in memory (10 MB at most, a few at a time), checked,
// and only then written to storage:
//
//   1. the declared type must be one we take, and the first bytes must say
//      the same thing (a JPEG starts FF D8 FF, a PDF "%PDF-"…): a program
//      renamed to photo.png is refused with UNSUPPORTED_FILE_TYPE
//   2. Images are decoded and written again (sharp): EXIF and GPS data go,
//      animated GIFs become one bounded frame, an image that does not decode
//      is refused, and an image/polyglot comes out as only the image
//   3. the stored name is ours (a UUID and the extension of the detected
//      type), never the uploader's
//
// Storage, S3-compatible in production and the local disk otherwise:
//
//   attachments  org/<org>/site/<site>/<uuid>.<ext>, private. The message
//                keeps the key; whoever reads the message gets a link signed
//                for fifteen minutes (signedAttachmentUrl), which answers with a
//                five-minute presigned S3 address or streams the file. A link
//                without a valid signature is refused (routes/files.ts).
//   logos        logos/logo-<uuid>.<ext>, public: a site's logo is shown on
//                its own pages to everyone.
//
// Archives (ZIP, RAR) are the easiest way to carry malware past a person and
// are not taken unless ALLOW_ARCHIVE_UPLOADS=true. Legacy binary Office files
// (.doc/.xls) are refused because this service has no AV/CDR engine. SVG is
// never taken: it is a document that can run script.

import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto, { randomUUID } from 'crypto';
import zlib from 'zlib';
import { isProduction } from '../config/env';
import { derivedKey, derivedKeys } from '../config/tokens';
import { HttpError } from '../http/errors';
import type { FileFilterCallback } from 'multer';
import type { NextFunction, Request, Response } from 'express';

// ---------------------------------------------------------------- what we take

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const ARCHIVE_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed'
]);

const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);

const archivesAllowed = () => process.env.ALLOW_ARCHIVE_UPLOADS === 'true';

function chatTypes(): Set<string> {
  return new Set([...IMAGE_TYPES, ...DOCUMENT_TYPES, ...(archivesAllowed() ? ARCHIVE_TYPES : [])]);
}

const MAX_CHAT_BYTES = 10 * 1024 * 1024;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
/** Images are scaled down to fit this box; nobody needs more in a chat. */
const MAX_IMAGE_EDGE = 2560;

/** multer passes `code` through to the error handler, which maps it to a 400. */
function unsupported(what = 'file'): HttpError {
  return new HttpError(400, `Unsupported ${what} type`, 'UNSUPPORTED_FILE_TYPE');
}

function filterFor(kind: 'chat' | 'logo') {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = kind === 'logo' ? IMAGE_TYPES : chatTypes();
    if (allowed.has(String(file.mimetype || '').toLowerCase())) return cb(null, true);
    return cb(unsupported(kind === 'logo' ? 'image' : 'file'));
  };
}

// ------------------------------------------------------------ content signature

const startsWith = (buf: Buffer, bytes: number[], at = 0) =>
  buf.length >= at + bytes.length && bytes.every((b, i) => buf[at + i] === b);
const ascii = (s: string) => [...s].map((c) => c.charCodeAt(0));

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

interface ZipEntry {
  name: string;
  compressed: number;
  uncompressed: number;
  method: number;
  localOffset: number;
}

/** Bounded central-directory inspection; nothing is extracted to disk. */
function inspectZip(buffer: Buffer): { entries: ZipEntry[]; contentTypes: string } | null {
  const eocdSignature = 0x06054b50;
  const minimum = 22;
  const start = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let i = buffer.length - minimum; i >= start; i -= 1) {
    if (buffer.readUInt32LE(i) === eocdSignature) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0 || eocd + minimum > buffer.length) return null;
  if (buffer.readUInt16LE(eocd + 4) !== 0 || buffer.readUInt16LE(eocd + 6) !== 0) return null;
  const count = buffer.readUInt16LE(eocd + 10);
  const directorySize = buffer.readUInt32LE(eocd + 12);
  const directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (count < 1 || count > 256 || directoryOffset + directorySize > eocd) return null;

  const entries: ZipEntry[] = [];
  const names = new Set<string>();
  let cursor = directoryOffset;
  let total = 0;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > eocd || buffer.readUInt32LE(cursor) !== 0x02014b50) return null;
    const flags = buffer.readUInt16LE(cursor + 8);
    const method = buffer.readUInt16LE(cursor + 10);
    const compressed = buffer.readUInt32LE(cursor + 20);
    const uncompressed = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localOffset = buffer.readUInt32LE(cursor + 42);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > eocd || nameLength < 1 || nameLength > 1024) return null;
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const canonical = name.replace(/\\/g, '/').toLowerCase();
    if (
      name.includes('\0') ||
      name.includes('\ufffd') ||
      canonical.startsWith('/') ||
      /^[a-z]:\//i.test(canonical) ||
      canonical.split('/').includes('..') ||
      names.has(canonical) ||
      flags & 1 ||
      ![0, 8].includes(method) ||
      ((externalAttributes >>> 16) & 0o170000) === 0o120000
    ) {
      return null;
    }
    names.add(canonical);
    if (uncompressed > 20 * 1024 * 1024 || compressed > 10 * 1024 * 1024) return null;
    if (uncompressed > 0 && (compressed === 0 || uncompressed / compressed > 100)) return null;
    total += uncompressed;
    if (total > 50 * 1024 * 1024) return null;
    entries.push({ name: canonical, compressed, uncompressed, method, localOffset });
    cursor = end;
  }
  if (cursor !== directoryOffset + directorySize) return null;

  const contentEntry = entries.find((entry) => entry.name === '[content_types].xml');
  if (!contentEntry || contentEntry.uncompressed > 512 * 1024) return null;
  const offset = contentEntry.localOffset;
  if (offset + 30 > buffer.length || buffer.readUInt32LE(offset) !== 0x04034b50) return null;
  const localNameLength = buffer.readUInt16LE(offset + 26);
  const localExtraLength = buffer.readUInt16LE(offset + 28);
  const dataStart = offset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataStart + contentEntry.compressed;
  if (dataEnd > directoryOffset) return null;
  try {
    const raw = buffer.subarray(dataStart, dataEnd);
    const xml =
      contentEntry.method === 0
        ? raw
        : zlib.inflateRawSync(raw, { maxOutputLength: contentEntry.uncompressed + 1 });
    if (xml.length !== contentEntry.uncompressed) return null;
    return { entries, contentTypes: xml.toString('utf8').toLowerCase() };
  } catch {
    return null;
  }
}

function officeZipType(buffer: Buffer): 'docx' | 'xlsx' | null {
  const inspected = inspectZip(buffer);
  if (!inspected) return null;
  const names = new Set(inspected.entries.map((entry) => entry.name));
  const forbidden = inspected.entries.some((entry) =>
    /(^|\/)(vbaproject\.bin|activex\/|embeddings\/|externalLinks\/)/i.test(entry.name)
  );
  if (
    forbidden ||
    /macroenabled|vnd\.ms-office\.vbaproject|oleobject|activex/.test(inspected.contentTypes)
  ) {
    return null;
  }
  if (
    names.has('word/document.xml') &&
    inspected.contentTypes.includes(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
    )
  ) {
    return 'docx';
  }
  if (
    names.has('xl/workbook.xml') &&
    inspected.contentTypes.includes(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml'
    )
  ) {
    return 'xlsx';
  }
  return null;
}

/** What the bytes say, as the canonical type and its extension. */
export function detectType(buffer: Buffer, declared: string): { mime: string; ext: string } | null {
  const type = declared.toLowerCase();
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) {
    return type === 'image/jpeg' ? { mime: 'image/jpeg', ext: '.jpg' } : null;
  }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return type === 'image/png' ? { mime: 'image/png', ext: '.png' } : null;
  }
  if (startsWith(buffer, ascii('GIF87a')) || startsWith(buffer, ascii('GIF89a'))) {
    return type === 'image/gif' ? { mime: 'image/gif', ext: '.gif' } : null;
  }
  if (startsWith(buffer, ascii('RIFF')) && startsWith(buffer, ascii('WEBP'), 8)) {
    return type === 'image/webp' ? { mime: 'image/webp', ext: '.webp' } : null;
  }
  if (startsWith(buffer, ascii('%PDF-'))) {
    return type === 'application/pdf' ? { mime: 'application/pdf', ext: '.pdf' } : null;
  }
  if (startsWith(buffer, ZIP)) {
    const office = officeZipType(buffer);
    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return office === 'docx' ? { mime: type, ext: '.docx' } : null;
    }
    if (type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return office === 'xlsx' ? { mime: type, ext: '.xlsx' } : null;
    }
    if (
      archivesAllowed() &&
      (type === 'application/zip' || type === 'application/x-zip-compressed')
    ) {
      return inspectZip(buffer) ? { mime: 'application/zip', ext: '.zip' } : null;
    }
    return null;
  }
  if (startsWith(buffer, OLE)) {
    if (type === 'application/msword') return { mime: type, ext: '.doc' };
    if (type === 'application/vnd.ms-excel') return { mime: type, ext: '.xls' };
    return null;
  }
  if (startsWith(buffer, ascii('Rar!\x1a\x07'))) {
    return archivesAllowed() && ARCHIVE_TYPES.has(type)
      ? { mime: 'application/vnd.rar', ext: '.rar' }
      : null;
  }
  if (type === 'text/plain') {
    // Text has no signature: it must be UTF-8 with no NUL bytes, which is
    // what every binary format (executables included) contains.
    if (buffer.includes(0)) return null;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch {
      return null;
    }
    return { mime: 'text/plain', ext: '.txt' };
  }
  return null;
}

/** Decodes and re-encodes an image; metadata (EXIF, GPS) does not survive. */
async function cleanImage(buffer: Buffer, mime: string): Promise<Buffer> {
  if (mime === 'image/gif') {
    const metadata = await sharp(buffer, {
      failOn: 'error',
      limitInputPixels: 40_000_000,
      animated: true
    }).metadata();
    const frames = metadata.pages ?? 1;
    if (
      frames > 100 ||
      (metadata.width ?? 0) * (metadata.pageHeight ?? metadata.height ?? 0) * frames > 40_000_000
    ) {
      throw unsupported('image');
    }
    // A controlled single-frame re-encode removes trailing/polyglot data and
    // gives GIF the same sanitisation guarantee as the other image formats.
    return sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000, pages: 1 })
      .resize({
        width: MAX_IMAGE_EDGE,
        height: MAX_IMAGE_EDGE,
        fit: 'inside',
        withoutEnlargement: true
      })
      .gif()
      .toBuffer();
  }
  const image = sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 })
    // Apply the EXIF orientation before the EXIF goes.
    .rotate()
    .resize({
      width: MAX_IMAGE_EDGE,
      height: MAX_IMAGE_EDGE,
      fit: 'inside',
      withoutEnlargement: true
    });
  if (mime === 'image/jpeg') return image.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
  if (mime === 'image/png') return image.png({ compressionLevel: 9 }).toBuffer();
  return image.webp({ quality: 82 }).toBuffer();
}

// ------------------------------------------------------- a few at a time, please

const MAX_CONCURRENT = Number(process.env.UPLOAD_CONCURRENCY) || 8;
const MAX_WAITING = 64;
let running = 0;
const waiting: Array<() => void> = [];

/** Runs `work` with at most MAX_CONCURRENT uploads being processed at once. */
async function oneAtATime<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT) {
    if (waiting.length >= MAX_WAITING) {
      throw new HttpError(503, 'Too many uploads right now, try again', 'UPLOADS_BUSY');
    }
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  running += 1;
  try {
    return await work();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

const MAX_INGRESS = Number(process.env.UPLOAD_INGRESS_CONCURRENCY) || 32;
let ingress = 0;

/** Reserves bounded buffering capacity before multer reads the request body. */
export function reserveUploadIngress(req: Request, res: Response, next: NextFunction): void {
  if (ingress >= MAX_INGRESS) {
    next(new HttpError(503, 'Too many uploads right now, try again', 'UPLOADS_BUSY'));
    return;
  }
  ingress += 1;
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    ingress = Math.max(0, ingress - 1);
  };
  res.once('finish', release);
  res.once('close', release);
  req.once('aborted', release);
  next();
}

// ------------------------------------------------------------------------- S3

const BUCKET = process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME;
/**
 * Any S3-compatible store: Amazon S3 by default, or Cloudflare R2 / Hetzner
 * Object Storage / MinIO through S3_ENDPOINT (plan §12, decision A). Those use
 * path-style addresses and a region of "auto" unless told otherwise.
 */
const ENDPOINT = process.env.S3_ENDPOINT || undefined;
const REGION = process.env.AWS_REGION || process.env.S3_REGION || (ENDPOINT ? 'auto' : undefined);
/**
 * The public address logos are served from, when it is not the bucket's own
 * (an R2 public bucket, a CDN in front of the bucket).
 */
const PUBLIC_URL = (process.env.S3_PUBLIC_URL || '').replace(/\/+$/, '');

// UPLOAD_STORAGE=local keeps files on the disk even where S3 keys exist (the
// development Docker stack, whose test suite must never write to a real
// bucket).
export const S3_CONFIGURED =
  process.env.UPLOAD_STORAGE !== 'local' &&
  Boolean(BUCKET && REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

export const s3 = S3_CONFIGURED
  ? new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string
      },
      ...(ENDPOINT
        ? { endpoint: ENDPOINT, forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false' }
        : {})
    })
  : null;

// A bucket with "Object Ownership: Bucket owner enforced" rejects an ACL
// outright (AccessControlListNotSupported), so one is sent only when asked for
// and only on public objects; access is otherwise a bucket-policy matter.
const PUBLIC_ACL = process.env.S3_ACL || undefined;

function publicObjectUrl(key: string): string {
  if (PUBLIC_URL) return `${PUBLIC_URL}/${key}`;
  if (ENDPOINT) return `${ENDPOINT.replace(/\/+$/, '')}/${BUCKET}/${key}`;
  return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${key}`;
}

// ------------------------------------------------------------------- the disk

/** Where local uploads live. Resolved from this file, not the process's cwd. */
export const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

/** The path `/uploads` is mounted at; only logos (and older files) are there. */
export const UPLOAD_URL_PREFIX = '/uploads';

// ------------------------------------------------------------- keys and links

/** Every key this server writes, old and new. */
const STORED_KEY =
  /(?:^|\/)((?:files|logos)\/[A-Za-z0-9._-]+|org\/[0-9a-f]{24}\/site\/[0-9a-f]{24}\/[A-Za-z0-9._-]+)(?:[?#]|$)/;
/** A private attachment's key. */
export const PRIVATE_KEY = /^org\/[0-9a-f]{24}\/site\/[0-9a-f]{24}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

/** The storage key inside a URL this server handed out, or null. */
export function storedKeyFromUrl(url: unknown): string | null {
  const match = STORED_KEY.exec(typeof url === 'string' ? url.split('?')[0] : '');
  return match ? match[1] : null;
}

/** Where attachment links point: the API's own public address. */
export function apiOrigin(req?: Request): string {
  const configured = (process.env.PUBLIC_BASE_URL || process.env.APP_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (configured) return configured;
  return req ? `${req.protocol}://${req.get('host')}` : '';
}

/** The stable address of a private attachment; it opens only when signed. */
export function attachmentPath(key: string): string {
  return `/api/files/a/${key}`;
}

const LINK_TTL_SECONDS = Number(process.env.ATTACHMENT_LINK_TTL_SECONDS) || 15 * 60;

function linkSignature(
  key: string,
  expires: number,
  secret = derivedKey('attachment-link')
): string {
  return crypto
    .createHmac('sha256', secret)
    .update(`${key}\n${expires}`)
    .digest('base64url')
    .slice(0, 32);
}

/**
 * A short bearer link to a private attachment. A fresh link is rendered when
 * an authorised conversation is read; it is not rounded into a longer window.
 */
export function signedAttachmentUrl(key: string, base = apiOrigin()): string {
  const expires = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  return `${base}${attachmentPath(key)}?e=${expires}&s=${linkSignature(key, expires)}`;
}

/** Whether a signed link's signature and expiry hold. */
export function attachmentLinkValid(key: string, expires: unknown, signature: unknown): boolean {
  const e = Number(expires);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(e) || e < now || e > now + LINK_TTL_SECONDS + 5) return false;
  if (typeof signature !== 'string' || signature.length !== 32) return false;
  // A link signed before a JWT_SECRET rotation still opens (SEC-18).
  return derivedKeys('attachment-link').some((secret) =>
    crypto.timingSafeEqual(Buffer.from(linkSignature(key, e, secret)), Buffer.from(signature))
  );
}

// ----------------------------------------------------------------- storing

export interface StoredFile {
  /** The object key (S3) or the path below `uploads/` (disk). */
  key: string;
  /** For attachments the stable, unsigned address; for logos the public one. */
  url: string;
  /** What the bytes are, which is what is stored and served. */
  mimeType: string;
  size: number;
}

async function writeObject(key: string, body: Buffer, mime: string, isPublic: boolean) {
  const inline = IMAGE_TYPES.has(mime);
  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET as string,
        Key: key,
        Body: body,
        ContentType: mime,
        ContentDisposition: inline ? 'inline' : 'attachment',
        CacheControl: isPublic ? 'public, max-age=31536000, immutable' : 'private, max-age=0',
        ...(isPublic && PUBLIC_ACL ? { ACL: PUBLIC_ACL as 'public-read' } : {})
      })
    );
    return;
  }
  const target = path.join(UPLOAD_ROOT, key);
  await fs.promises.mkdir(path.dirname(target), { recursive: true });
  await fs.promises.writeFile(target, body);
}

/**
 * Checks, cleans and stores what multer held in memory. `kind` decides the
 * key and whether the object is private.
 */
export async function storeUpload(
  req: Request,
  file: Express.Multer.File,
  target: { kind: 'attachment'; organizationId: string; siteId: string } | { kind: 'logo' }
): Promise<StoredFile> {
  return oneAtATime(async () => {
    const detected = detectType(file.buffer, String(file.mimetype || ''));
    if (!detected) throw unsupported(target.kind === 'logo' ? 'image' : 'file');
    let body = file.buffer;
    if (IMAGE_TYPES.has(detected.mime)) {
      try {
        body = await cleanImage(file.buffer, detected.mime);
      } catch {
        throw unsupported('image');
      }
    }
    const name = `${randomUUID()}${detected.ext}`;
    if (target.kind === 'logo') {
      const key = `logos/logo-${name}`;
      await writeObject(key, body, detected.mime, true);
      const url = s3 ? publicObjectUrl(key) : `${apiOrigin(req)}${UPLOAD_URL_PREFIX}/${key}`;
      return { key, url, mimeType: detected.mime, size: body.length };
    }
    const key = `org/${target.organizationId}/site/${target.siteId}/${name}`;
    await writeObject(key, body, detected.mime, false);
    return {
      key,
      url: `${apiOrigin(req)}${attachmentPath(key)}`,
      mimeType: detected.mime,
      size: body.length
    };
  });
}

/**
 * How a private attachment is handed to a browser: a five-minute presigned
 * S3 address, or the bytes from the disk.
 */
export async function openAttachment(
  key: string
): Promise<{ redirect: string } | { file: string; mime: string } | null> {
  if (!PRIVATE_KEY.test(key)) return null;
  const mime = mimeOf(key);
  if (s3) {
    const redirect = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: BUCKET as string,
        Key: key,
        ResponseContentType: mime,
        ResponseContentDisposition: IMAGE_TYPES.has(mime) ? 'inline' : 'attachment'
      }),
      { expiresIn: 300 }
    );
    return { redirect };
  }
  const file = path.join(UPLOAD_ROOT, key);
  // The key pattern allows no "..", but the resolved path is checked anyway.
  if (!file.startsWith(UPLOAD_ROOT + path.sep)) return null;
  try {
    await fs.promises.access(file);
  } catch {
    return null;
  }
  return { file, mime };
}

const MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.txt': 'text/plain; charset=utf-8',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.zip': 'application/zip',
  '.rar': 'application/vnd.rar'
};

export function mimeOf(key: string): string {
  return MIME_BY_EXT[path.extname(key).toLowerCase()] || 'application/octet-stream';
}

// --------------------------------------------------------------- the uploaders

function uploader(maxBytes: number, kind: 'chat' | 'logo') {
  return multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxBytes,
      files: 1,
      fields: 0,
      parts: 1,
      fieldNameSize: 100,
      fieldSize: 1024
    },
    fileFilter: filterFor(kind)
  });
}

export const uploadFile = uploader(MAX_CHAT_BYTES, 'chat');
export const uploadLogo = uploader(MAX_LOGO_BYTES, 'logo');

// ------------------------------------------------------------- deleting files

/**
 * Removes stored files by key, from S3 or from the disk. Keys that are not
 * ones this server writes are skipped. Returns how many were asked for.
 */
export async function deleteStoredFiles(keys: Array<string | null>): Promise<number> {
  const unique = [...new Set(keys.filter((k): k is string => Boolean(k && STORED_KEY.test(k))))];
  if (!unique.length) return 0;
  if (s3) {
    for (let i = 0; i < unique.length; i += 1000) {
      // eslint-disable-next-line no-await-in-loop
      const deleted = await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET as string,
          Delete: { Objects: unique.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true }
        })
      );
      if (deleted.Errors?.length) {
        throw new Error(`Object storage refused ${deleted.Errors.length} attachment deletion(s)`);
      }
    }
  } else {
    await Promise.all(
      unique.map((key) => fs.promises.unlink(path.join(UPLOAD_ROOT, key)).catch(() => undefined))
    );
  }
  return unique.length;
}

/**
 * Removes everything stored under an organization's prefix (the workspace is
 * being deleted): every attachment of every site, whatever the messages say.
 */
export async function deleteOrganizationFiles(organizationId: string): Promise<number> {
  if (!/^[0-9a-f]{24}$/.test(organizationId)) return 0;
  const prefix = `org/${organizationId}/`;
  if (s3) {
    let removed = 0;
    let token: string | undefined;
    do {
      // eslint-disable-next-line no-await-in-loop
      const page = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET as string,
          Prefix: prefix,
          ContinuationToken: token
        })
      );
      const keys = (page.Contents || []).map((o) => o.Key).filter((k): k is string => Boolean(k));
      if (keys.length) {
        // eslint-disable-next-line no-await-in-loop
        const deleted = await s3.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET as string,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true }
          })
        );
        if (deleted.Errors?.length) {
          throw new Error(`Object storage refused ${deleted.Errors.length} attachment deletion(s)`);
        }
        removed += keys.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return removed;
  }
  const directory = path.join(UPLOAD_ROOT, 'org', organizationId);
  let count = 0;
  try {
    const walk = async (dir: string): Promise<void> => {
      for (const entry of await fs.promises.readdir(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) await walk(path.join(dir, entry.name));
        else count += 1;
      }
    };
    await walk(directory);
    await fs.promises.rm(directory, { recursive: true, force: true });
  } catch {
    /* nothing stored for this organization */
  }
  return count;
}

/** Reported at boot so the chosen backend is never a surprise. */
export function describeStorage(): string {
  return S3_CONFIGURED
    ? `S3 (${BUCKET} @ ${ENDPOINT ? new URL(ENDPOINT).host : REGION}), attachments private`
    : `local disk (${UPLOAD_ROOT}), attachments private, logos at ${UPLOAD_URL_PREFIX}`;
}

if (!S3_CONFIGURED && isProduction && process.env.UPLOAD_STORAGE !== 'local') {
  // Local disk does not survive a container restart and is not shared between
  // instances, so in production it is a misconfiguration rather than a choice.
  console.warn(
    '[upload] S3 is not configured; falling back to local disk. ' +
      'In production set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_BUCKET and AWS_REGION or S3_ENDPOINT.'
  );
}

export { BUCKET, REGION, IMAGE_TYPES };
