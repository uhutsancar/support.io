const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');
const Organization = require('../models/Organization');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    let user;
    if (decoded.userType === 'team') {
      user = await Team.findOne({ _id: decoded.userId, isActive: true });
    } else {
      user = await User.findOne({ _id: decoded.userId, isActive: true });
    }

    if (!user) {
      throw new Error('User not found');
    }

    // if user lacks an organization, try to backfill from assignedSites or create one
    if (!user.organizationId) {
      try {
        const Site = require('../models/Site');
        let orgId = null;
        if (user.assignedSites && user.assignedSites.length) {
          // pick first site that has an org
          const sites = await Site.find({ _id: { $in: user.assignedSites } }).select('organizationId');
          for (const s of sites) {
            if (s.organizationId) {
              orgId = s.organizationId;
              break;
            }
          }
        }
        if (!orgId) {
          const Organization = require('../models/Organization');
          const newOrg = new Organization({ name: `${user.name}'s Organization`, planType: 'FREE' });
          await newOrg.save();
          orgId = newOrg._id;
            }
        user.organizationId = orgId;
        await user.save();
      } catch (e) {
        console.error('Auth middleware org migration failed for user', user._id, e.message);
      }
    }

    // Organization isolation: load organization and attach to request
    let organization = null;
    const orgId = decoded.organizationId || user.organizationId;
    if (orgId) {
      organization = await Organization.findOne({ _id: orgId, isActive: true });
      if (!organization) {
        return res.status(403).json({ error: 'Organization not found or inactive' });
      }
    }

    // Ensure user belongs to organization where applicable
    if (organization && user.organizationId && user.organizationId.toString() !== organization._id.toString()) {
      return res.status(403).json({ error: 'User not part of organization' });
    }

    req.user = user;
    req.userType = decoded.userType || 'user';
    req.userId = user._id;
    req.user = user;
    req.user.role = user.role;
    req.userType = decoded.userType || 'user';
    req.organization = organization;
    req.token = token;
    req.tokenPayload = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Please authenticate.' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

module.exports = { auth, isAdmin };
