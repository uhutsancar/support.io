// Chat attachments.
//
// Two ways in, one storage:
//
//   POST /upload               a visitor, from the widget, with the widget
//                              session (middleware/widgetSession.ts); the site
//                              is the session's, never one the request names
//   POST /agent-upload?siteId  an agent, from the panel, with their session;
//                              the site must be one they may work on
//
// The stored URL is not secret, which is why the response carries a
// short-lived signed proof. When the URL later arrives over the socket as part
// of a message, the socket handler verifies that proof rather than trusting the
// client's word that we stored the file. See config/tokens.ts for why that
// proof is signed with its own derived key.

import express from 'express';
import rateLimit from 'express-rate-limit';
import { signUploadProof } from '../config/tokens';
import { describeUpload, uploadFile } from '../middleware/upload';
import { requireWidgetSession } from '../middleware/widgetSession';
import { auth } from '../middleware/auth';
import {
  asyncHandler,
  asyncMiddleware,
  badRequest,
  loadOwnedSite,
  mayAccessSite,
  notFound,
  requireOrganization,
  unavailable
} from '../http';
import type { NextFunction, Request, Response } from 'express';

const router = express.Router();

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Çok fazla dosya yükleme isteği. Lütfen daha sonra tekrar deneyin.' }
});

/** Stores the file and answers with it and its signed proof for `req.site`. */
const storeAndProve = asyncHandler(async (req: Request, res: Response) => {
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
});

router.post('/upload', uploadLimiter, requireWidgetSession, uploadFile.single('file'), storeAndProve);

/**
 * The site an agent uploads for, checked before multer touches the body: the
 * same organization *and* a site the agent's role and assignment reach — the
 * rule the inbox itself uses (http/guards.ts).
 */
const agentSite = asyncMiddleware(async (req: Request, _res: Response, next: NextFunction) => {
  const site = await loadOwnedSite(req, req.query.siteId);
  if (!mayAccessSite(req.user.role, req.user.assignedSites, site._id)) throw notFound('Site');
  req.site = site;
  next();
});

router.post(
  '/agent-upload',
  uploadLimiter,
  auth,
  requireOrganization,
  agentSite,
  uploadFile.single('file'),
  storeAndProve
);

export default router;
