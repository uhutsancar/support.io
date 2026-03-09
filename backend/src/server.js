require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const SocketHandler = require('./socket/socketHandler');
const authRoutes = require('./routes/auth');
const siteRoutes = require('./routes/sites');
const faqRoutes = require('./routes/faqs');
const conversationRoutes = require('./routes/conversations');
const widgetRoutes = require('./routes/widget');
const filesRoutes = require('./routes/files');
const departmentRoutes = require('./routes/departments');
const teamRoutes = require('./routes/team');
const teamChatRoutes = require('./routes/teamChat');
const auditRoutes = require('./routes/audit');
const onboardingRoutes = require('./routes/onboarding');
const widgetConfigRoutes = require('./routes/widgetConfig');
const visitorsRoutes = require('./routes/visitors');
const dealsRoutes = require('./routes/deals');
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: false
  }
});
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false
}));
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6,
}));
app.use((req, res, next) => {
  if (req.url.includes('/widget.js')) {
    res.set('Cache-Control', 'public, max-age=3600');
  } else if (req.url.startsWith('/api')) {
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});
app.use(mongoSanitize());
app.set('io', io);
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many login attempts, please try again later.'
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500
});
app.use('/api', cors({
  origin: '*',
  credentials: true
}));
app.use('/widget.js', cors({
  origin: '*',
  credentials: false
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/team-chat', teamChatRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/widget-config', widgetConfigRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/deals', dealsRoutes);
require('./services/auditService');
app.use('/api/audit', auditRoutes);
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'DestekChat API çalışıyor',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});
app.get('/', (req, res) => {
  res.json({
    name: 'DestekChat API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      sites: '/api/sites',
      conversations: '/api/conversations',
      faqs: '/api/faqs'
    }
  });
});
const adminPanelPath = path.join(__dirname, '../../admin-panel/dist');
app.use(express.static(adminPanelPath, {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));
app.use('/uploads/logos', express.static(path.join(__dirname, '../uploads/logos')));
app.use('/api/widget-config/logo', express.static(path.join(__dirname, '../uploads/logos')));
app.use('/demo', express.static('../demo'));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/widget.js') || req.path.startsWith('/demo')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../admin-panel/dist/index.html'));
});
new SocketHandler(io);
const PORT = process.env.PORT || 3000;
connectDB().then(async () => {
  try {
    const Conversation = require('./models/Conversation');
    const Site = require('./models/Site');
    await Conversation.updateMany(
      { status: 'open' },
      { $set: { status: 'unassigned' } }
    );
    const missingSiteOrgs = await Site.find({ organizationId: { $exists: false } });
    if (missingSiteOrgs.length) {
      for (const site of missingSiteOrgs) {
        try {
          let orgId = null;
          if (site.userId) {
            const User = require('./models/User');
            const user = await User.findById(site.userId).select('organizationId');
            if (user && user.organizationId) {
              orgId = user.organizationId;
            }
          }
          if (!orgId) {
            const Organization = require('./models/Organization');
            const newOrg = new Organization({
              name: `${site.name} Org`,
              planType: 'FREE'
            });
            await newOrg.save();
            orgId = newOrg._id;
          }
          site.organizationId = orgId;
          await site.save();
        } catch (e) {
        }
      }
    }
    const missingOrgs = await Conversation.find({ organizationId: { $exists: false } }).limit(1000);
    if (missingOrgs.length) {
      for (const conv of missingOrgs) {
        try {
          if (conv.siteId) {
            const site = await Site.findById(conv.siteId).select('organizationId');
            if (site && site.organizationId) {
              conv.organizationId = site.organizationId;
              await conv.save();
            } else {
            }
          } else {
          }
        } catch (e) {
        }
      }
    }
    const missingCreatedAt = await Conversation.find({
      $or: [
        { createdAt: { $exists: false } },
        { createdAt: null },
        { createdAt: { $type: 2 } }
      ]
    }).limit(1000);
    if (missingCreatedAt.length) {
      for (const conv of missingCreatedAt) {
        try {
          let dt = conv.createdAt;
          if (!dt || isNaN(new Date(dt).getTime())) {
            dt = new Date();
          } else {
            dt = new Date(dt);
          }
          conv.createdAt = dt;
          await conv.save();
        } catch (e) {
        }
      }
    }
    try {
      const User = require('./models/User');
      const Team = require('./models/Team');
      const Organization = require('./models/Organization');
      const Site = require('./models/Site');
      const usersNoOrg = await User.find({ organizationId: { $in: [null, undefined] } });
      if (usersNoOrg.length) {
        for (const user of usersNoOrg) {
          try {
            let orgId = null;
            const owned = await Site.findOne({ userId: user._id }).select('organizationId');
            if (owned && owned.organizationId) {
              orgId = owned.organizationId;
            }
            if (!orgId && user.assignedSites && user.assignedSites.length) {
              const sites = await Site.find({ _id: { $in: user.assignedSites } }).select('organizationId');
              for (const s of sites) {
                if (s.organizationId) {
                  orgId = s.organizationId;
                  break;
                }
              }
            }
            if (!orgId) {
              const newOrg = new Organization({ name: `${user.name}'s Organization`, planType: 'FREE' });
              await newOrg.save();
              orgId = newOrg._id;
            }
            user.organizationId = orgId;
            await user.save();
          } catch (e) {
          }
        }
      }
      const teamsNoOrg = await Team.find({ organizationId: { $in: [null, undefined] } });
      if (teamsNoOrg.length) {
        for (const team of teamsNoOrg) {
          try {
            let orgId = null;
            if (team.assignedSites && team.assignedSites.length) {
              const sites = await Site.find({ _id: { $in: team.assignedSites } }).select('organizationId');
              for (const s of sites) {
                if (s.organizationId) {
                  orgId = s.organizationId;
                  break;
                }
              }
            }
            if (!orgId) {
              const newOrg = new Organization({ name: `${team.name}'s Organization`, planType: 'FREE' });
              await newOrg.save();
              orgId = newOrg._id;
            }
            team.organizationId = orgId;
            await team.save();
          } catch (e) {
          }
        }
      }
      const allSites = await Site.find().limit(1000);
      for (const site of allSites) {
        if (site.userId) {
          const owner = await User.findById(site.userId).select('organizationId');
          if (owner && owner.organizationId) {
            if (!site.organizationId.equals(owner.organizationId)) {
              site.organizationId = owner.organizationId;
              await site.save();
            }
          } else if (owner && !owner.organizationId) {
            owner.organizationId = site.organizationId;
            await owner.save();
          }
        }
      }
    } catch (migrationErr) {
    }
  } catch (error) {
  }
  server.listen(PORT, () => {
  });
}).catch((error) => {
  process.exit(1);
});
process.on('unhandledRejection', (err) => {
  process.exit(1);
});
process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
