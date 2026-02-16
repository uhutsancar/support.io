const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const Team = require('../models/Team');
const { auth } = require('../middleware/auth');

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

    const user = new User({
      email,
      password,
      name,
      role: 'admin'
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
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
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user._id, userType }, 
      process.env.JWT_SECRET, 
      { expiresIn: '7d' }
    );
    // Update status to online
    user.status = 'online';
    await user.save();

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
      status: req.user.status
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

module.exports = router;
