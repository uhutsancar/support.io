const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const { upload, validateFileContent, getFileInfo, ALLOWED_FILE_TYPES, MAX_FILE_SIZE } = require('../middleware/fileUpload');
const { verifySiteKey } = require('../middleware/siteAuth');
const rateLimit = require('express-rate-limit');

// Rate limiting - dosya yükleme için
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 20, // 15 dakikada maksimum 20 dosya
  message: 'Çok fazla dosya yükleme isteği. Lütfen daha sonra tekrar deneyin.'
});

// Dosya yükleme endpoint'i - WIDGET için
router.post('/upload', uploadLimiter, verifySiteKey, upload.single('file'), validateFileContent, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi' });
    }

    const fileInfo = getFileInfo(req.file);
    
    res.json({
      success: true,
      file: fileInfo,
      message: 'Dosya başarıyla yüklendi'
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ error: 'Dosya yükleme hatası' });
  }
});

// Dosya indirme/görüntüleme endpoint'i
router.get('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    // Güvenlik: dosya adı kontrolü
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Geçersiz dosya adı' });
    }
    
    const filePath = path.join(__dirname, '../../uploads/files', filename);
    
    // Dosya var mı kontrol et
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Dosya bulunamadı' });
    }
    
    // Dosya bilgilerini al
    const stat = fs.statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    // MIME type belirle
    let mimeType = 'application/octet-stream';
    for (const [mime, exts] of Object.entries(ALLOWED_FILE_TYPES)) {
      if (exts.includes(ext)) {
        mimeType = mime;
        break;
      }
    }
    
    // Güvenlik başlıkları
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff'); // MIME sniffing'i engelle
    res.setHeader('Content-Security-Policy', "default-src 'none'"); // XSS koruması
    
    // Dosyayı stream olarak gönder
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({ error: 'Dosya indirme hatası' });
  }
});

// İzin verilen dosya türlerini listele
router.get('/info/allowed-types', (req, res) => {
  const types = Object.entries(ALLOWED_FILE_TYPES).map(([mime, exts]) => ({
    mimeType: mime,
    extensions: exts
  }));
  
  res.json({
    allowedTypes: types,
    maxFileSize: MAX_FILE_SIZE,
    maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024)
  });
});

module.exports = router;
