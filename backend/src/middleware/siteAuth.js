const Site = require('../models/Site');
const { isValidObjectId } = require('../db/objectId');
const verifySiteKey = async (req, res, next) => {
  try {
    const siteKey = req.header('X-Site-Key') || req.query.siteKey || req.body.siteKey;
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
// Resolves a site the caller's organization actually owns. Admin-panel routes
// use this instead of a bare findById so a rule can never be read or written
// across tenant boundaries. Returns null when the id is malformed or the site
// belongs to another organization; callers answer 404 either way so the
// endpoint does not confirm that a foreign id exists.
const findOwnedSite = async (req, siteId) => {
  if (!isValidObjectId(siteId)) return null;
  const orgId = req.organization?._id || req.user?.organizationId;
  return Site.findOne({
    _id: siteId,
    ...(orgId ? { organizationId: orgId } : {})
  });
};

module.exports = { verifySiteKey, findOwnedSite };

