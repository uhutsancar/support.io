import Site from '../models/Site';
import { isValidObjectId } from '../db/objectId';
import { plainString } from './sanitize';
import type { Request, Response, NextFunction } from 'express';

const verifySiteKey = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Başlık, sorgu ya da gövde: hangisinden gelirse gelsin düz metin olmalı.
    // Nesne olarak gelen bir değer ({ $ne: … }) rastgele bir siteyle eşleşiyordu.
    const siteKey = plainString(req.header('X-Site-Key'), 128)
      || plainString(req.query.siteKey, 128)
      || plainString(req.body?.siteKey, 128);
    if (!siteKey) {
      return res.status(401).json({ error: 'Site key required' });
    }
    const site = await Site.findOne({ siteKey, isActive: true });
    if (!site) {
      return res.status(401).json({ error: 'Invalid site key' });
    }
    req.site = site;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Site verification failed' });
  }
};
/**
 * The organization the caller acts for, or null when they belong to none.
 *
 * Every tenant-scoped query filters on this. It used to be spread in
 * conditionally — `...(orgId ? { organizationId: orgId } : {})` — so a caller
 * without an organization searched *every* tenant's rows instead of none.
 * Authorization has to fail closed: callers treat null as "refuse", never as
 * "no filter".
 */
const callerOrgId = (req: Request): string | null => {
  const orgId = req.organization?._id || req.user?.organizationId;
  return orgId ? String(orgId) : null;
};

/** Answers a request made without an organization. Nothing is tenant-scoped
 *  for such a caller, so there is nothing they may legitimately read. */
const requireOrgId = (req: Request, res: Response): string | null => {
  const orgId = callerOrgId(req);
  if (!orgId) {
    res.status(403).json({ error: 'No organization for this account', code: 'NO_ORGANIZATION' });
    return null;
  }
  return orgId;
};

// Resolves a site the caller's organization actually owns. Admin-panel routes
// use this instead of a bare findById so a rule can never be read or written
// across tenant boundaries. Returns null when the id is malformed, the caller
// has no organization, or the site belongs to another one; callers answer 404
// either way so the endpoint does not confirm that a foreign id exists.
const findOwnedSite = async (req: Request, siteId: unknown) => {
  if (!isValidObjectId(siteId)) return null;
  const orgId = callerOrgId(req);
  if (!orgId) return null;
  return Site.findOne({ _id: siteId, organizationId: orgId });
};

export { verifySiteKey, findOwnedSite, callerOrgId, requireOrgId };