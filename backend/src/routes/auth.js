const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Team = require('../models/Team');
const Organization = require('../models/Organization');
const { auth } = require('../middleware/auth');
const events = require('../events');
const validateRegistration = [
  body('email').isEmail().normalizeEmail().withMessage('Invalid email address'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be between 2-50 characters')
];
const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }
    const { email, password, name } = req.body;
    const existingUser = await User.findOne({ email, isActive: true });
    if (existingUser) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kayıtlı' });
    }
    const organization = new Organization({
      name: `${name}'s Organization`,
      planType: 'FREE'
    });
    await organization.save();
    const user = new User({
      email,
      password,
      name,
      role: 'owner',
      organizationId: organization._id
    });
    await user.save();
    organization.ownerUserId = user._id;
    await organization.save();
    const token = jwt.sign({ userId: user._id, organizationId: organization._id, role: user.role, userType: 'user' }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });
    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        organizationId: user.organizationId
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Invalid input' });
    }
    const { email, password } = req.body;
    let user = await User.findOne({ email, isActive: true });
    let userType = 'user';
    if (!user) {
      user = await Team.findOne({ email, isActive: true });
      userType = 'team';
    }
    if (!user) {
      const host = req.get('host');
      let orgId = null;
      try {
        const Site = require('../models/Site');
        const site = await Site.findOne({ domain: host }).select('organizationId');
        if (site && site.organizationId) orgId = site.organizationId;
      } catch (e) {
      }
      events.emit('auth.login.failure', { organizationId: orgId, userId: null, metadata: { email }, ip: req.ip, ua: req.get('user-agent') });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      events.emit('auth.login.failure', { organizationId: user.organizationId, userId: user._id, metadata: { reason: 'invalid_password' }, ip: req.ip, ua: req.get('user-agent') });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if (!user.organizationId) {
      const Organization = require('../models/Organization');
      const newOrg = new Organization({
        name: `${user.name}'s Organization`,
        planType: 'FREE'
      });
      await newOrg.save();
      user.organizationId = newOrg._id;
    }
    const tokenPayload = { userId: user._id, userType, role: user.role };
    if (user.organizationId) tokenPayload.organizationId = user.organizationId;
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '7d' });
    user.status = 'online';
    await user.save();
    events.emit('auth.login.success', { organizationId: user.organizationId, userId: user._id, metadata: { userType }, ip: req.ip, ua: req.get('user-agent') });
    res.json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatar: user.avatar,
        userType
      },
      token
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.get('/me', auth, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
      avatar: req.user.avatar,
      status: req.user.status,
      isOnboarded: req.user.isOnboarded,
      organization: req.organization ? {
        id: req.organization._id,
        name: req.organization.name,
        planType: req.organization.planType
      } : null
    }
  });
});
router.post('/logout', auth, async (req, res) => {
  try {
    req.user.status = 'offline';
    await req.user.save();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.put('/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    if (!['online', 'offline', 'busy', 'away'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    req.user.status = status;
    await req.user.save();
    res.json({ message: 'Status updated successfully', status: req.user.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.delete('/account', auth, async (req, res) => {
  try {
    req.user.email = `deleted_${Date.now()}@deleted.com`;
    req.user.isActive = false;
    req.user.name = 'Deleted User';
    req.user.status = 'offline';
    await req.user.save();
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
module.exports = router;
