// A site's knowledge sources (plan v10 PRD-21): pages of its own site and PDF
// documents the assistant may answer from, beside the FAQ. Owners and admins
// (manage_sites), on a plan with the feature, up to the plan's number.
//
//   GET    /api/sites/:siteId/knowledge
//   POST   /api/sites/:siteId/knowledge/pages     { url }
//   POST   /api/sites/:siteId/knowledge/sitemap   { url }
//   POST   /api/sites/:siteId/knowledge/pdf       multipart "file"
//   POST   /api/sites/:siteId/knowledge/:id/refresh
//   DELETE /api/sites/:siteId/knowledge/:id
//
// Reading the list and deleting work on any plan, so a downgrade can be
// tidied up; the assistant uses sources only while the plan includes them.

import express from 'express';
import multer from 'multer';
import { auth } from '../middleware/auth';
import { checkPermission } from '../middleware/rbac';
import { detectType, reserveUploadIngress } from '../middleware/upload';
import { query } from '../db/pool';
import { generateId } from '../db/objectId';
import { hasFeature, limitsFor, PlanLimitError, requireFeature } from '../services/entitlements';
import {
  enqueuePage,
  KnowledgeError,
  onSite,
  readPdf,
  siteDomains,
  sitemapUrls,
  storeText
} from '../services/knowledgeSources';
import {
  asyncHandler,
  asyncMiddleware,
  badRequest,
  HttpError,
  loadOwnedSite,
  notFound,
  orgId,
  requireOrganization
} from '../http';
import type { NextFunction, Request, Response } from 'express';

const router = express.Router();
router.use(auth, requireOrganization);

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PDF_BYTES, files: 1, fields: 0, parts: 1, fieldNameSize: 100 }
});

const knowledgeUploadSite = asyncMiddleware(
  async (req: Request, _res: Response, next: NextFunction) => {
    req.site = await loadOwnedSite(req, req.params.siteId);
    await assertRoom(orgId(req));
    next();
  }
);

interface SourceRow {
  id: string;
  kind: 'page' | 'pdf';
  url: string | null;
  title: string;
  status: 'pending' | 'ready' | 'failed';
  error: string | null;
  chars: number;
  created_at: Date;
  refreshed_at: Date | null;
  approved_for_external_model: boolean;
}

const presentSource = (r: SourceRow) => ({
  _id: r.id,
  kind: r.kind,
  url: r.url,
  title: r.title,
  status: r.status,
  error: r.error,
  chars: r.chars,
  createdAt: r.created_at,
  refreshedAt: r.refreshed_at,
  approvedForExternalModel: r.approved_for_external_model
});

async function allowance(organizationId: string) {
  const [{ limits }, { rows }] = await Promise.all([
    limitsFor(organizationId),
    query<{ n: number }>(
      'SELECT count(*)::int AS n FROM knowledge_sources WHERE organization_id = $1',
      [organizationId]
    )
  ]);
  return { limit: limits.assistant.knowledgeSources, used: rows[0].n };
}

async function assertRoom(organizationId: string, adding = 1) {
  const { limit, used } = await allowance(organizationId);
  if (used + adding > limit) throw new PlanLimitError('knowledgeSources', limit, used);
}

/** An address on the site itself, or a 400 saying what is wrong with it. */
function siteAddress(raw: unknown, domains: string[]): URL {
  let url: URL;
  try {
    url = new URL(String(raw || '').trim());
  } catch {
    throw badRequest('url must be a full address, e.g. https://example.com/shipping');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw badRequest('url must start with https:// or http://');
  }
  if (!onSite(url.hostname, domains)) {
    throw new HttpError(400, 'Only pages of this site can be added', 'NOT_ON_SITE');
  }
  url.hash = '';
  return url;
}

router.get(
  '/:siteId/knowledge',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const [{ rows }, room, allowed] = await Promise.all([
      query<SourceRow>(
        `SELECT id, kind, url, title, status, error, chars, created_at, refreshed_at,
                approved_for_external_model
           FROM knowledge_sources WHERE site_id = $1 ORDER BY created_at DESC`,
        [site._id]
      ),
      allowance(orgId(req)),
      hasFeature(orgId(req), 'knowledge')
    ]);
    res.json({ sources: rows.map(presentSource), allowed, ...room });
  })
);

router.post(
  '/:siteId/knowledge/pages',
  checkPermission('manage_sites'),
  requireFeature('knowledge'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const url = siteAddress(req.body?.url, await siteDomains(String(site._id)));
    await assertRoom(orgId(req));
    const id = generateId();
    const { rows } = await query<SourceRow>(
      `INSERT INTO knowledge_sources
         (id, organization_id, site_id, kind, url, title, created_by, approved_for_external_model)
       VALUES ($1, $2, $3, 'page', $4, $5, $6, $7)
       ON CONFLICT (site_id, url) WHERE url IS NOT NULL DO NOTHING
       RETURNING id, kind, url, title, status, error, chars, created_at, refreshed_at,
                 approved_for_external_model`,
      [
        id,
        orgId(req),
        site._id,
        url.toString(),
        url.pathname,
        String(req.user._id),
        req.body?.approvedForExternalModel === true
      ]
    );
    if (!rows[0]) throw new HttpError(409, 'This page is already added', 'KNOWLEDGE_EXISTS');
    void enqueuePage(id);
    res.status(201).json({ source: presentSource(rows[0]) });
  })
);

router.post(
  '/:siteId/knowledge/sitemap',
  checkPermission('manage_sites'),
  requireFeature('knowledge'),
  asyncHandler(async (req: Request, res: Response) => {
    const site = await loadOwnedSite(req, req.params.siteId);
    const domains = await siteDomains(String(site._id));
    const sitemap = siteAddress(req.body?.url, domains);
    const { limit, used } = await allowance(orgId(req));
    if (used >= limit) throw new PlanLimitError('knowledgeSources', limit, used);
    let urls: string[];
    try {
      urls = await sitemapUrls(sitemap.toString(), domains, limit - used);
    } catch (error) {
      if (error instanceof KnowledgeError) {
        throw new HttpError(422, 'The sitemap could not be read', 'SITEMAP_UNREADABLE', {
          reason: error.code
        });
      }
      throw error;
    }
    const added: string[] = [];
    for (const address of urls) {
      const id = generateId();
      // eslint-disable-next-line no-await-in-loop
      const { rowCount } = await query(
        `INSERT INTO knowledge_sources
           (id, organization_id, site_id, kind, url, title, created_by, approved_for_external_model)
         VALUES ($1, $2, $3, 'page', $4, $5, $6, $7)
         ON CONFLICT (site_id, url) WHERE url IS NOT NULL DO NOTHING`,
        [
          id,
          orgId(req),
          site._id,
          address,
          new URL(address).pathname,
          String(req.user._id),
          req.body?.approvedForExternalModel === true
        ]
      );
      if (rowCount) {
        added.push(id);
        void enqueuePage(id);
      }
    }
    res.status(201).json({ found: urls.length, added: added.length });
  })
);

router.post(
  '/:siteId/knowledge/pdf',
  checkPermission('manage_sites'),
  requireFeature('knowledge'),
  knowledgeUploadSite,
  reserveUploadIngress,
  asyncHandler(async (req: Request, res: Response, next) => {
    // The site and the room are checked before the body is read.
    const site = req.site;
    pdfUpload.single('file')(req, res, (error?: unknown) => {
      if (error) {
        const tooLarge = (error as { code?: string }).code === 'LIMIT_FILE_SIZE';
        next(
          tooLarge
            ? new HttpError(413, 'The PDF is larger than 10 MB', 'FILE_TOO_LARGE')
            : badRequest('Send one PDF as "file"')
        );
        return;
      }
      void (async () => {
        const file = req.file;
        if (!file) throw badRequest('Send one PDF as "file"');
        if (detectType(file.buffer, 'application/pdf')?.mime !== 'application/pdf') {
          throw new HttpError(400, 'That is not a PDF', 'NOT_PDF');
        }
        const name = String(file.originalname || 'document.pdf')
          .replace(/[^\p{L}\p{N} ._()-]+/gu, ' ')
          .trim()
          .slice(0, 120);
        let text: string;
        try {
          text = await readPdf(file.buffer);
        } catch (failure) {
          if (failure instanceof KnowledgeError) {
            throw new HttpError(422, 'The PDF could not be read', 'PDF_UNREADABLE', {
              reason: failure.code
            });
          }
          throw failure;
        }
        const id = generateId();
        await query(
          `INSERT INTO knowledge_sources
             (id, organization_id, site_id, kind, url, title, created_by, approved_for_external_model)
           VALUES ($1, $2, $3, 'pdf', NULL, $4, $5, false)`,
          [id, orgId(req), site._id, name || 'document.pdf', String(req.user._id)]
        );
        await storeText(id, String(site._id), name || 'document.pdf', text);
        const { rows } = await query<SourceRow>(
          `SELECT id, kind, url, title, status, error, chars, created_at, refreshed_at,
                  approved_for_external_model
             FROM knowledge_sources WHERE id = $1`,
          [id]
        );
        res.status(201).json({ source: presentSource(rows[0]) });
      })().catch(next);
    });
  })
);

async function ownedSource(req: Request): Promise<SourceRow & { site_id: string }> {
  const site = await loadOwnedSite(req, req.params.siteId);
  const { rows } = await query<SourceRow & { site_id: string }>(
    `SELECT id, site_id, kind, url, title, status, error, chars, created_at, refreshed_at,
            approved_for_external_model
       FROM knowledge_sources WHERE id = $1 AND site_id = $2`,
    [String(req.params.id), site._id]
  );
  if (!rows[0]) throw notFound('Knowledge source not found');
  return rows[0];
}

router.post(
  '/:siteId/knowledge/:id/refresh',
  checkPermission('manage_sites'),
  requireFeature('knowledge'),
  asyncHandler(async (req: Request, res: Response) => {
    const source = await ownedSource(req);
    if (source.kind !== 'page') throw badRequest('A PDF is refreshed by uploading it again');
    await query(`UPDATE knowledge_sources SET status = 'pending', error = NULL WHERE id = $1`, [
      source.id
    ]);
    void enqueuePage(source.id);
    res.status(202).json({ source: presentSource({ ...source, status: 'pending', error: null }) });
  })
);

router.put(
  '/:siteId/knowledge/:id/external-model',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const source = await ownedSource(req);
    if (typeof req.body?.approved !== 'boolean') {
      throw badRequest('approved must be a boolean');
    }
    const { rows } = await query<SourceRow>(
      `UPDATE knowledge_sources SET approved_for_external_model = $2
        WHERE id = $1
        RETURNING id, kind, url, title, status, error, chars, created_at, refreshed_at,
                  approved_for_external_model`,
      [source.id, req.body.approved]
    );
    res.json({ source: presentSource(rows[0]) });
  })
);

router.delete(
  '/:siteId/knowledge/:id',
  checkPermission('manage_sites'),
  asyncHandler(async (req: Request, res: Response) => {
    const source = await ownedSource(req);
    await query('DELETE FROM knowledge_sources WHERE id = $1', [source.id]);
    res.status(204).end();
  })
);

export default router;
