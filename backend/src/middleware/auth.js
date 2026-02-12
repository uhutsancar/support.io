const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Team = require('../models/Team');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      throw new Error('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check userType to determine which model to use
    let user;
    if (decoded.userType === 'team') {
      user = await Team.findOne({ _id: decoded.userId, isActive: true });
    } else {
      user = await User.findOne({ _id: decoded.userId, isActive: true });
    }

    if (!user) {
      throw new Error('User not found');
    }

    req.user = user;
    req.userType = decoded.userType || 'user';
    req.token = token;
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
