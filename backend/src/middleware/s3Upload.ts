import { S3Client } from '@aws-sdk/client-s3';
import multer from 'multer';
import type { FileFilterCallback } from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

const BUCKET = process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;

if (!BUCKET || !REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.warn('[s3] Eksik S3 ayarı: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / S3_BUCKET .env dosyasında tanımlı olmalı');
}

// .env'den aldığımız anahtarlarla S3 hattını bağlıyoruz
// The keys are read as-is: a missing one is reported by the warning above and
// then fails at the first upload, which is where it is diagnosable.
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  },
});

// Bucket'ta "Object Ownership: Bucket owner enforced" açıksa ACL gönderilemez
// (AccessControlListNotSupported hatası verir). Bu yüzden ACL yalnızca
// S3_ACL tanımlıysa gönderilir; erişim bucket policy ile yönetilir.
const aclOption = process.env.S3_ACL ? { acl: process.env.S3_ACL } : {};

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

/** multer passes `code` through to the route's error handler. */
interface UploadError extends Error {
  code?: string;
}

const chatFileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (CHAT_TYPES.has(String(file.mimetype || '').toLowerCase())) return cb(null, true);
  const error: UploadError = new Error('Unsupported file type');
  error.code = 'UNSUPPORTED_FILE_TYPE';
  return cb(error);
};

const logoFileFilter = (req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
  if (IMAGE_TYPES.has(String(file.mimetype || '').toLowerCase())) return cb(null, true);
  const error: UploadError = new Error('Unsupported image type');
  error.code = 'UNSUPPORTED_FILE_TYPE';
  return cb(error);
};

const makeStorage = (prefix: string, namePrefix = '') => multerS3({
  s3: s3,
  bucket: BUCKET as string,
  ...aclOption,
  contentType: multerS3.AUTO_CONTENT_TYPE, // Dosya tipini otomatik anla
  cacheControl: 'public, max-age=31536000',
  contentDisposition: (req: Request, file: Express.Multer.File, cb: (error: Error | null, value?: string) => void) => {
    cb(null, IMAGE_TYPES.has(file.mimetype) ? 'inline' : 'attachment');
  },
  key: (req: Request, file: Express.Multer.File, cb: (error: Error | null, value?: string) => void) => {
    const extension = path.extname(file.originalname).toLowerCase().replace(/[^.a-z0-9]/g, '').slice(0, 10);
    cb(null, `${prefix}/${namePrefix}${randomUUID()}${extension}`);
  }
});

const S3_CONFIGURED = Boolean(BUCKET && REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

// S3 yapılandırılmamışsa multer-s3 modül yüklenirken "bucket is required" ile
// PATLIYORDU; yani eksik bir S3 anahtarı tüm sunucuyu ayağa kaldırılamaz hale
// getiriyordu. Dosya yükleme, uygulamanın geri kalanının çalışmasını
// engellememeli: yükleyici yerine 503 döndüren bir vekil konur.
const unavailable = () => ({
  single: () => (req: Request, res: Response) => res.status(503).json({
    error: 'File storage is not configured on this server',
    code: 'STORAGE_UNAVAILABLE'
  }),
  array: () => (req: Request, res: Response) => res.status(503).json({
    error: 'File storage is not configured on this server',
    code: 'STORAGE_UNAVAILABLE'
  })
});

// Logolar için özel S3 yükleyici
const uploadLogo = S3_CONFIGURED
  ? multer({
      storage: makeStorage('logos', 'logo-'),
      limits: { fileSize: 5 * 1024 * 1024, files: 1 },
      fileFilter: logoFileFilter
    })
  : unavailable();

// Genel chat dosyaları için S3 yükleyici
const uploadFile = S3_CONFIGURED
  ? multer({
      storage: makeStorage('files'),
      limits: { fileSize: 10 * 1024 * 1024, files: 1 },
      fileFilter: chatFileFilter
    })
  : unavailable();

export { uploadLogo, uploadFile, s3, BUCKET, REGION, S3_CONFIGURED };