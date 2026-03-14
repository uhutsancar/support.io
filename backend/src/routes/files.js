const express = require('express');
const router = express.Router();
const { uploadFile } = require('../middleware/s3Upload');
const { verifySiteKey } = require('../middleware/siteAuth');
const rateLimit = require('express-rate-limit');
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Çok fazla dosya yükleme isteği. Lütfen daha sonra tekrar deneyin.'
});
router.post('/upload', uploadLimiter, verifySiteKey, uploadFile.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi' });
    }
    
    // S3'ten gelen yanıt - Location zaten S3 URL'si
    res.json({
      success: true,
      file: {
        filename: req.file.key,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        url: req.file.location // S3 public URL
      },
      message: 'Dosya başarıyla yüklendi'
    });
  } catch (error) {
    res.status(500).json({ error: 'Dosya yükleme hatası' });
  }
});

module.exports = router;
