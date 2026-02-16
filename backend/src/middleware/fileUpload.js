const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const ALLOWED_FILE_TYPES = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'text/plain': ['.txt'],
  'text/csv': ['.csv'],
  'application/zip': ['.zip'],
  'application/x-rar-compressed': ['.rar'],
  'application/x-7z-compressed': ['.7z']
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const generateSafeFilename = (originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  const randomName = crypto.randomBytes(16).toString('hex');
  return `${randomName}${ext}`;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/files');
    
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

const fileFilter = (req, file, cb) => {
  const mimeType = file.mimetype.toLowerCase();
  const ext = path.extname(file.originalname).toLowerCase();
  // Mimetype kontrolü
  if (!ALLOWED_FILE_TYPES[mimeType]) {
    return cb(new Error(`Dosya türü desteklenmiyor: ${file.originalname}. İzin verilen türler: resim, PDF, Office belgeleri, metin dosyaları.`), false);
  }
  
  const allowedExts = ALLOWED_FILE_TYPES[mimeType];
  if (!allowedExts.includes(ext)) {
    return cb(new Error(`Dosya uzantısı güvenli değil: ${ext}`), false);
  }
  
  const filename = file.originalname;
  const dangerousPattern = /[<>:"|?*\x00-\x1f]/g;
  if (dangerousPattern.test(filename)) {
    return cb(new Error('Dosya adı geçersiz karakterler içeriyor'), false);
  }
  
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return cb(new Error('Dosya adı geçersiz'), false);
  }
  
  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1
  }
});

const validateFileContent = async (req, res, next) => {
  if (!req.file) {
    return next();
  }

  try {
    const fileType = require('file-type');
    const buffer = fs.readFileSync(req.file.path);
    const type = await fileType.fromBuffer(buffer);
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
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Dosya doğrulama hatası' });
  }
};

const deleteFile = (filename) => {
  const filePath = path.join(__dirname, '../../uploads/files', filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
};

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
