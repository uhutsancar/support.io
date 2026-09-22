import express from 'express';
import { signUploadProof } from '../config/tokens';
import { uploadFile } from '../middleware/s3Upload';
import { verifySiteKey } from '../middleware/siteAuth';
import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';

const router = express.Router();
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Çok fazla dosya yükleme isteği. Lütfen daha sonra tekrar deneyin.'
});
router.post('/upload', uploadLimiter, verifySiteKey, uploadFile.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Dosya yüklenemedi' });
    }
    // Depolama bir anahtar ve adres döndürmediyse kaydedilmiş bir dosya yoktur;
    // tanımsız bir URL için kanıt imzalamak yerine açıkça başarısız olunur.
    if (!req.file.key || !req.file.location) {
      console.error('[files] storage returned no key/location for an upload');
      return res.status(502).json({ error: 'File storage is unavailable', code: 'STORAGE_UNAVAILABLE' });
    }

    // S3'ten gelen yanıt - Location zaten S3 URL'si
    // `uploadToken` is filled in just below, so the shape is declared here
    // rather than grown by assignment.
    const publicFile: {
      filename?: string;
      originalName: string;
      mimeType: string;
      size: number;
      url?: string;
      uploadToken?: string;
    } = {
      filename: req.file.key,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: req.file.location
    };
    // The site key is public by design, so a file URL supplied later over the
    // socket needs its own short-lived proof that our upload route created it.
    // Kendi türetilmiş anahtarı ve amacı (aud) olan ayrı bir token türü:
    // oturum yerine kullanılamaz. Ayrıntı: config/tokens.ts
    publicFile.uploadToken = signUploadProof({
      kind: 'chat-upload',
      siteId: String(req.site._id),
      filename: req.file.key,
      url: req.file.location,
      size: publicFile.size,
      mimeType: publicFile.mimeType
    });

    res.json({
      success: true,
      file: publicFile,
      message: 'Dosya başarıyla yüklendi'
    });
  } catch (error) {
    res.status(500).json({ error: 'Dosya yükleme hatası' });
  }
});

export default router;