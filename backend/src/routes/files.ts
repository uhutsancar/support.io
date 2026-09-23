// Chat attachments.
//
// This endpoint is public by design: a visitor on a customer's page uploads
// before any conversation exists, so the only credential is the site key. That
// makes the returned URL unauthenticated too, which is why the response carries
// a short-lived signed proof. When the URL later arrives over the socket as
// part of a message, the socket handler verifies that proof rather than
// trusting the client's word that we stored the file. See config/tokens.ts for
// why that proof is signed with its own derived key.

import express from 'express';
import rateLimit from 'express-rate-limit';
import { signUploadProof } from '../config/tokens';
import { describeUpload, uploadFile } from '../middleware/upload';
import { verifySiteKey } from '../middleware/siteAuth';
import { asyncHandler, badRequest, unavailable } from '../http';
import type { Request, Response } from 'express';

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Çok fazla dosya yükleme isteği. Lütfen daha sonra tekrar deneyin.' }
});

router.post(
  '/upload',
  uploadLimiter,
  verifySiteKey,
  uploadFile.single('file'),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw badRequest('Dosya yüklenemedi');

    // Nothing stored means no file to vouch for. Signing a proof for an
    // undefined URL would hand the client a token pointing at nothing, so this
    // fails loudly instead.
    const stored = describeUpload(req, req.file);
    if (!stored) {
      console.error('[files] storage returned no key/url for an upload');
      throw unavailable('File storage is unavailable', 'STORAGE_UNAVAILABLE');
    }

    const file = {
      filename: stored.key,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: stored.url
    };

    res.json({
      success: true,
      file: {
        ...file,
        uploadToken: signUploadProof({
          kind: 'chat-upload',
          siteId: String(req.site._id),
          filename: file.filename,
          url: file.url,
          size: file.size,
          mimeType: file.mimeType
        })
      },
      message: 'Dosya başarıyla yüklendi'
    });
  })
);

export default router;
