// File uploads: chat attachments and site logos.
//
// Two storage backends behind one interface.
//
//   S3    when AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION and a
//         bucket are all configured. This is what production uses.
//   disk  otherwise: files land in `backend/uploads/` and the server serves
//         them from `/uploads`. This is what local development uses.
//
// The disk backend exists because there was no reason to need an AWS account to
// run the project on a laptop. Before it, an unconfigured deployment got a
// `unavailable()` stub that answered 503 to every upload, so the whole chat
// attachment feature was untestable locally — and the boot warning said the
// keys were missing while they sat in `.env`, because the environment had not
// been loaded yet (see config/env.ts).
//
// The file this replaces was called `s3Upload.ts`, which is no longer the whole
// truth about what it does.

import { S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { isProduction } from '../config/env';
import type { FileFilterCallback } from 'multer';
import type { Request } from 'express';

// ---------------------------------------------------------------- what we take

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const DOCUMENT_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'application/vnd.rar',
  'application/x-rar-compressed'
]);

const CHAT_TYPES = new Set([...IMAGE_TYPES, ...DOCUMENT_TYPES]);

const MAX_CHAT_BYTES = 10 * 1024 * 1024;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

/** multer passes `code` through to the error handler, which maps it to a 400. */
interface UploadError extends Error {
  code?: string;
}

function rejecting(message: string) {
  return (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = message === 'image' ? IMAGE_TYPES : CHAT_TYPES;
    if (allowed.has(String(file.mimetype || '').toLowerCase())) return cb(null, true);
    const error: UploadError = new Error(`Unsupported ${message} type`);
    error.code = 'UNSUPPORTED_FILE_TYPE';
    return cb(error);
  };
}

const chatFileFilter = rejecting('file');
const logoFileFilter = rejecting('image');

/**
 * The stored name for an upload.
 *
 * The original name never becomes a path: it is attacker-controlled and would
 * otherwise allow `../` traversal and collisions. Only a sanitised extension is
 * carried over, for the sake of the content type the browser infers.
 */
function storedName(file: Express.Multer.File, namePrefix: string): string {
  const extension = path
    .extname(file.originalname)
    .toLowerCase()
    .replace(/[^.a-z0-9]/g, '')
    .slice(0, 10);
  return `${namePrefix}${randomUUID()}${extension}`;
}

// ------------------------------------------------------------------------- S3

const BUCKET = process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;

export const S3_CONFIGURED = Boolean(
  BUCKET && REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);

export const s3 = S3_CONFIGURED
  ? new S3Client({
      region: REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string
      }
    })
  : null;

// A bucket with "Object Ownership: Bucket owner enforced" rejects an ACL
// outright (AccessControlListNotSupported), so one is sent only when asked for;
// access is otherwise a bucket-policy matter.
const aclOption = process.env.S3_ACL ? { acl: process.env.S3_ACL } : {};

function s3Storage(prefix: string, namePrefix: string) {
  return multerS3({
    s3: s3 as S3Client,
    bucket: BUCKET as string,
    ...aclOption,
    contentType: multerS3.AUTO_CONTENT_TYPE,
    cacheControl: 'public, max-age=31536000',
    contentDisposition: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, value?: string) => void
    ) => {
      // Anything that is not an image downloads rather than renders, so an
      // uploaded document cannot be opened as a page in our own origin.
      cb(null, IMAGE_TYPES.has(file.mimetype) ? 'inline' : 'attachment');
    },
    key: (
      _req: Request,
      file: Express.Multer.File,
      cb: (error: Error | null, value?: string) => void
    ) => {
      cb(null, `${prefix}/${storedName(file, namePrefix)}`);
    }
  });
}

// ------------------------------------------------------------------- the disk

/** Where local uploads live. Resolved from this file, not the process's cwd. */
export const UPLOAD_ROOT = path.join(__dirname, '../../uploads');

/** The path `/uploads` is mounted at, so the URL and the directory agree. */
export const UPLOAD_URL_PREFIX = '/uploads';

function diskStorage(prefix: string, namePrefix: string) {
  const directory = path.join(UPLOAD_ROOT, prefix);
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      // Created on demand: a fresh clone has no `uploads/files` directory and
      // multer does not make one, so the first upload would fail with ENOENT.
      fs.mkdir(directory, { recursive: true }, (error) => cb(error, directory));
    },
    filename: (_req, file, cb) => cb(null, storedName(file, namePrefix))
  });
}

// --------------------------------------------------------------- the uploaders

function uploader(prefix: string, namePrefix: string, maxBytes: number, filter: typeof chatFileFilter) {
  return multer({
    storage: S3_CONFIGURED ? s3Storage(prefix, namePrefix) : diskStorage(prefix, namePrefix),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: filter
  });
}

export const uploadFile = uploader('files', '', MAX_CHAT_BYTES, chatFileFilter);
export const uploadLogo = uploader('logos', 'logo-', MAX_LOGO_BYTES, logoFileFilter);

// ----------------------------------------------------------- describing a file

export interface StoredFile {
  /** The object key (S3) or the path below `uploads/` (disk). */
  key: string;
  /** Where a browser can fetch it. Absolute in both backends. */
  url: string;
}

/**
 * Where an upload ended up, whichever backend took it.
 *
 * multer-s3 sets `key` and `location`; disk storage sets `filename` and `path`
 * and no URL at all. Routes used to read `req.file.location` directly, which is
 * why they could only ever work with S3.
 *
 * The local URL is absolute because it is handed to the widget on a customer's
 * page and signed into an upload proof — a relative path would resolve against
 * their site, not ours.
 */
export function describeUpload(req: Request, file: Express.Multer.File): StoredFile | null {
  const s3File = file as Express.Multer.File & { key?: string; location?: string };
  if (S3_CONFIGURED) {
    if (!s3File.key || !s3File.location) return null;
    return { key: s3File.key, url: s3File.location };
  }

  if (!file.filename) return null;
  // `destination` is the absolute directory; the segment below `uploads/` is
  // what the URL needs.
  const prefix = path.relative(UPLOAD_ROOT, file.destination).split(path.sep).join('/');
  const key = prefix ? `${prefix}/${file.filename}` : file.filename;
  return { key, url: `${publicOrigin(req)}${UPLOAD_URL_PREFIX}/${key}` };
}

/**
 * This server's own address, as a browser elsewhere would reach it.
 *
 * `PUBLIC_BASE_URL` wins when set, because behind a proxy the request's own
 * host header is the proxy's, not the address the widget was served from.
 */
export function publicOrigin(req: Request): string {
  const configured = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/+$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

/** Reported at boot so the chosen backend is never a surprise. */
export function describeStorage(): string {
  return S3_CONFIGURED
    ? `S3 (${BUCKET} @ ${REGION})`
    : `local disk (${UPLOAD_ROOT}, served at ${UPLOAD_URL_PREFIX})`;
}

if (!S3_CONFIGURED && isProduction) {
  // Local disk does not survive a container restart and is not shared between
  // instances, so in production it is a misconfiguration rather than a choice.
  console.warn(
    '[upload] S3 is not configured; falling back to local disk. '
      + 'In production set AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / S3_BUCKET.'
  );
}

export { BUCKET, REGION, IMAGE_TYPES };
