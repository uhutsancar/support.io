const Site = require('../models/Site');

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

module.exports = { verifySiteKey };
