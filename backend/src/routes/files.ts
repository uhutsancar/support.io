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
// and one way out:
//
//   GET /a/org/<org>/site/<site>/<file>?e=&s=   a link signed for twelve
//                              hours (middleware/upload.ts#signedAttachmentUrl),
//                              which every message carries when it is read.
//                              Without a valid signature: 403. With one: a
//                              five-minute presigned S3 address, or the file.
//
// The stable address in the upload answer opens nothing by itself, which is
// why the answer also carries a short-lived signed proof. When the address
// later arrives over the socket as part of a message, the socket handler
// verifies that proof rather than trusting the client's word that we stored
// the file. See config/tokens.ts for why that proof is signed with its own
// derived key.

import express from 'express';
import { createLimiter } from '../middleware/rateLimit';
import { signUploadProof } from '../config/tokens';
import {
  IMAGE_TYPES,
  PRIVATE_KEY,
  apiOrigin,
  attachmentLinkValid,
  openAttachment,
  signedAttachmentUrl,
  storeUpload,
  uploadFile
} from '../middleware/upload';
import { requireWidgetSession } from '../middleware/widgetSession';
import { auth } from '../middleware/auth';
import {
  asyncHandler,
  asyncMiddleware,
  badRequest,
  forbidden,
  loadOwnedSite,
  mayAccessSite,
  notFound,
  requireOrganization
} from '../http';
import type { NextFunction, Request, Response } from 'express';

const router = express.Router();

// Per widget session or user (rateLimit.ts#identifyClient), shared across
// processes through Redis.
const uploadLimiter = createLimiter({
  name: 'upload',
  code: 'TOO_MANY_UPLOADS',
  message: 'Too many uploads, please try again later.',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.UPLOAD_RATE_MAX) || 20
});

/** Stores the file and answers with it and its signed proof for `req.site`. */
const storeAndProve = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw badRequest('No file was received');

  const stored = await storeUpload(req, req.file, {
    kind: 'attachment',
    organizationId: String(req.site.organizationId),
    siteId: String(req.site._id)
  });

  const file = {
    filename: stored.key,
    originalName: req.file.originalname,
    mimeType: stored.mimeType,
    size: stored.size,
    url: stored.url
  };

  res.json({
    success: true,
    file: {
      ...file,
      // Shows the file to the one who uploaded it until the message is sent;
      // the stable `url` opens nothing on its own.
      previewUrl: signedAttachmentUrl(stored.key, apiOrigin(req)),
      uploadToken: signUploadProof({
        kind: 'chat-upload',
        siteId: String(req.site._id),
        filename: file.filename,
        url: file.url,
        size: file.size,
        mimeType: file.mimeType
      })
    }
  });
});

router.post(
  '/upload',
  uploadLimiter,
  requireWidgetSession,
  uploadFile.single('file'),
  storeAndProve
);

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

router.get(
  /^\/a\/(.+)$/,
  asyncHandler(async (req: Request, res: Response) => {
    const key = String((req.params as Record<string, string>)[0] || '');
    if (!PRIVATE_KEY.test(key)) throw notFound('File');
    if (!attachmentLinkValid(key, req.query.e, req.query.s)) {
      throw forbidden('This link has expired; reopen the conversation', 'LINK_EXPIRED');
    }
    const opened = await openAttachment(key);
    if (!opened) throw notFound('File');
    // The signed link is per file and expires; caches may keep the answer
    // only briefly and only for this browser.
    res.set('Cache-Control', 'private, max-age=60');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    if ('redirect' in opened) {
      res.redirect(302, opened.redirect);
      return;
    }
    res.type(opened.mime);
    res.set(
      'Content-Disposition',
      IMAGE_TYPES.has(opened.mime.split(';')[0]) ? 'inline' : 'attachment'
    );
    // The widget shows attachments on the customer's own page.
    res.set('Access-Control-Allow-Origin', '*');
    res.sendFile(opened.file);
  })
);

export default router;
