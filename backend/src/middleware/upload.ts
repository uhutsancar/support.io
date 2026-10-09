// File uploads: chat attachments and site logos (plan v10 SEC-07, SEC-08).
//
// What arrives is held in memory (10 MB at most, a few at a time), checked,
// and only then written to storage:
//
//   1. the declared type must be one we take, and the first bytes must say
//      the same thing (a JPEG starts FF D8 FF, a PDF "%PDF-"…): a program
//      renamed to photo.png is refused with UNSUPPORTED_FILE_TYPE
//   2. JPEG, PNG and WebP are decoded and written again (sharp): EXIF and GPS
//      data go, an image that does not decode is refused, and a file that is
//      an image and something else at once comes out as only the image
//   3. the stored name is ours (a UUID and the extension of the detected
//      type), never the uploader's
//
// Storage, S3-compatible in production and the local disk otherwise:
//
//   attachments  org/<org>/site/<site>/<uuid>.<ext>, private. The message
//                keeps the key; whoever reads the message gets a link signed
//                for twelve hours (signedAttachmentUrl), which answers with a
//                five-minute presigned S3 address or streams the file. A link
//                without a valid signature is refused (routes/files.ts).
//   logos        logos/logo-<uuid>.<ext>, public: a site's logo is shown on
//                its own pages to everyone.
//
// Archives (ZIP, RAR) are the easiest way to carry malware past a person and
// are not taken unless ALLOW_ARCHIVE_UPLOADS=true. SVG is never taken: it is
// a document that can run script.

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
import { isProduction } from '../config/env';
import { derivedKey, derivedKeys } from '../config/tokens';
import { HttpError } from '../http/errors';
import type { FileFilterCallback } from 'multer';
import type { Request } from 'express';

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
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
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
    if (type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return { mime: type, ext: '.docx' };
    }
    if (type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      return { mime: type, ext: '.xlsx' };
    }
    if (
      archivesAllowed() &&
      (type === 'application/zip' || type === 'application/x-zip-compressed')
    ) {
      return { mime: 'application/zip', ext: '.zip' };
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
  // An animated GIF carries no EXIF and would lose its frames; it is kept.
  if (mime === 'image/gif') {
    await sharp(buffer, { failOn: 'error', limitInputPixels: 40_000_000 }).metadata();
    return buffer;
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

const LINK_TTL_SECONDS = 12 * 60 * 60;

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
 * A link to a private attachment that works for twelve hours. The expiry is
 * rounded up to the hour, so a page that renders the same file twice gets
 * the same link (and the browser's cache).
 */
export function signedAttachmentUrl(key: string, base = apiOrigin()): string {
  const hour = 3600;
  const expires = Math.ceil((Date.now() / 1000 + LINK_TTL_SECONDS) / hour) * hour;
  return `${base}${attachmentPath(key)}?e=${expires}&s=${linkSignature(key, expires)}`;
}

/** Whether a signed link's signature and expiry hold. */
export function attachmentLinkValid(key: string, expires: unknown, signature: unknown): boolean {
  const e = Number(expires);
  if (!Number.isInteger(e) || e * 1000 < Date.now()) return false;
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
    limits: { fileSize: maxBytes, files: 1 },
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
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET as string,
          Delete: { Objects: unique.slice(i, i + 1000).map((Key) => ({ Key })), Quiet: true }
        })
      );
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
        await s3.send(
          new DeleteObjectsCommand({
            Bucket: BUCKET as string,
            Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true }
          })
        );
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
