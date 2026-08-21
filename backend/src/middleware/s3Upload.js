const { S3Client } = require('@aws-sdk/client-s3');
const multer = require('multer');
const multerS3 = require('multer-s3');
const path = require('path');

const BUCKET = process.env.S3_BUCKET || process.env.AWS_BUCKET_NAME;
const REGION = process.env.AWS_REGION;

if (!BUCKET || !REGION || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
  console.warn('[s3] Eksik S3 ayarı: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / S3_BUCKET .env dosyasında tanımlı olmalı');
}

// .env'den aldığımız anahtarlarla S3 hattını bağlıyoruz
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Bucket'ta "Object Ownership: Bucket owner enforced" açıksa ACL gönderilemez
// (AccessControlListNotSupported hatası verir). Bu yüzden ACL yalnızca
// S3_ACL tanımlıysa gönderilir; erişim bucket policy ile yönetilir.
const aclOption = process.env.S3_ACL ? { acl: process.env.S3_ACL } : {};

const makeStorage = (prefix, namePrefix = '') => multerS3({
  s3: s3,
  bucket: BUCKET,
  ...aclOption,
  contentType: multerS3.AUTO_CONTENT_TYPE, // Dosya tipini otomatik anla
  cacheControl: 'public, max-age=31536000',
  key: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${prefix}/${namePrefix}${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const S3_CONFIGURED = Boolean(BUCKET && REGION && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

// S3 yapılandırılmamışsa multer-s3 modül yüklenirken "bucket is required" ile
// PATLIYORDU; yani eksik bir S3 anahtarı tüm sunucuyu ayağa kaldırılamaz hale
// getiriyordu. Dosya yükleme, uygulamanın geri kalanının çalışmasını
// engellememeli: yükleyici yerine 503 döndüren bir vekil konur.
const unavailable = () => ({
  single: () => (req, res) => res.status(503).json({
    error: 'File storage is not configured on this server',
    code: 'STORAGE_UNAVAILABLE'
  }),
  array: () => (req, res) => res.status(503).json({
    error: 'File storage is not configured on this server',
    code: 'STORAGE_UNAVAILABLE'
  })
});

// Logolar için özel S3 yükleyici
const uploadLogo = S3_CONFIGURED
  ? multer({ storage: makeStorage('logos', 'logo-'), limits: { fileSize: 5 * 1024 * 1024 } })
  : unavailable();

// Genel chat dosyaları için S3 yükleyici
const uploadFile = S3_CONFIGURED
  ? multer({ storage: makeStorage('files'), limits: { fileSize: 10 * 1024 * 1024 } })
  : unavailable();

module.exports = { uploadLogo, uploadFile, s3, BUCKET, REGION, S3_CONFIGURED };
