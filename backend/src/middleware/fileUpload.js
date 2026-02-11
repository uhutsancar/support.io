const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

// Güvenli dosya türleri - SADECE bunlara izin verilir
const ALLOWED_FILE_TYPES = {
  // Görseller
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  
  // Dokümanlar
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  
  // Metin dosyaları
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  
  // Arşiv dosyaları
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z']
};

// Maksimum dosya boyutu: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Güvenli dosya adı oluştur
const generateSafeFilename = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const randomName = crypto.randomBytes(16).toString('hex');
  return `${randomName}${ext}`;
};

// Dosya depolama yapılandırması
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/files');
    
    // Klasör yoksa oluştur
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const safeFilename = generateSafeFilename(file.originalname);
    cb(null, safeFilename);
  }
});

// Dosya filtresi - GÜVENLİK KONTROLÜ
const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  
  // Mimetype kontrolü
  if (!ALLOWED_FILE_TYPES[mimeType]) {
    return cb(new Error(`Dosya türü desteklenmiyor: ${file.originalname}. İzin verilen türler: resim, PDF, Office belgeleri, metin dosyaları.`), false);
  }
  
  // Extension kontrolü
  const allowedExts = ALLOWED_FILE_TYPES[mimeType];
  if (!allowedExts.includes(ext)) {
    return cb(new Error(`Dosya uzantısı güvenli değil: ${ext}`), false);
  }
  
  // Dosya adı güvenlik kontrolü - tehlikeli karakterleri engelle
  const filename = file.originalname;
  const dangerousPattern = /[<>:"|?*\x00-\x1f]/g;
  if (dangerousPattern.test(filename)) {
    return cb(new Error('Dosya adı geçersiz karakterler içeriyor'), false);
  }
  
  // Path traversal saldırısını engelle
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return cb(new Error('Dosya adı geçersiz'), false);
  }
  
  cb(null, true);
};

// Multer yapılandırması
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1 // Tek seferde sadece 1 dosya
  }
});

// Dosya türü doğrulama middleware'i (ek güvenlik)
const validateFileContent = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const fileType = require('file-type');
    const buffer = fs.readFileSync(req.file.path);
    const type = await fileType.fromBuffer(buffer);
    
    // Dosya içeriği ile uzantısı uyuşuyor mu kontrol et
    if (type) {
      const declaredMime = req.file.mimetype.toLowerCase();
      const actualMime = type.mime.toLowerCase();
      
      // Bazı mime type'lar farklı olabilir, genel kontrol yap
      const mimeCategory = declaredMime.split('/')[0];
      const actualCategory = actualMime.split('/')[0];
      
      if (mimeCategory !== actualCategory) {
        // Dosyayı sil
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 
          error: 'Dosya içeriği uzantısı ile uyuşmuyor. Güvenlik riski tespit edildi.' 
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('File validation error:', error);
    // Hata durumunda dosyayı sil
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Dosya doğrulama hatası' });
  }
};

// Dosya silme fonksiyonu
const deleteFile = (filename) => {
  const filePath = path.join(__dirname, '../../uploads/files', filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};

// Dosya bilgilerini güvenli şekilde döndür
const getFileInfo = (file) => {
  if (!file) return null;
  
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    url: `/api/files/${file.filename}`
  };
};

module.exports = {
  upload,
  validateFileContent,
  deleteFile,
  getFileInfo,
  ALLOWED_FILE_TYPES,
  MAX_FILE_SIZE
};
