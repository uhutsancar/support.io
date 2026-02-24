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
app.use('/api/widget-config', require('./routes/widgetConfig'));
// initialize audit service (event listeners)
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

// Serve logo uploads
app.use('/uploads/logos', express.static(path.join(__dirname, '../uploads/logos')));
app.use('/api/widget-config/logo', express.static(path.join(__dirname, '../uploads/logos')));

app.use('/demo', express.static('../demo'));

// debug: log every API request with user/org info


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

    // existing migration: mark open -> unassigned
    await Conversation.updateMany(
      { status: 'open' },
      { $set: { status: 'unassigned' } }
    );

    const missingSiteOrgs = await Site.find({ organizationId: { $exists: false } });
    if (missingSiteOrgs.length) {
      console.warn(`[Migration] found ${missingSiteOrgs.length} sites without organizationId - assigning default organizations`);
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
            console.log(`[Migration] created new organization ${orgId} for site ${site._id}`);
          }
          site.organizationId = orgId;
          await site.save();
        } catch (e) {
          console.error('Migration error assigning org to site', site._id, e.message);
        }
      }
    }

    // new migration: backfill missing organizationId using site reference
    const missingOrgs = await Conversation.find({ organizationId: { $exists: false } }).limit(1000);
    if (missingOrgs.length) {
      console.log(`[Migration] fixing ${missingOrgs.length} conversations without organizationId`);
      for (const conv of missingOrgs) {
        try {
          if (conv.siteId) {
            const site = await Site.findById(conv.siteId).select('organizationId');
            if (site && site.organizationId) {
              conv.organizationId = site.organizationId;
              await conv.save();
            } else {
              console.warn('Conversation has siteId but site missing orgId, skipping:', conv._id);
            }
          } else {
            console.warn('Conversation missing siteId, cannot populate orgId:', conv._id);
          }
        } catch (e) {
          console.error('Migration conversation fix error', conv._id, e.message);
        }
      }
    }

    // migration: ensure all conversations have a valid createdAt timestamp
    const missingCreatedAt = await Conversation.find({
      $or: [
        { createdAt: { $exists: false } },
        { createdAt: null },
        { createdAt: { $type: 2 } } // string values
      ]
    }).limit(1000);
    if (missingCreatedAt.length) {
      console.log(`[Migration] fixing ${missingCreatedAt.length} conversations without valid createdAt`);
      for (const conv of missingCreatedAt) {
        try {
          // if the field exists but is a string/invalid, coerce or overwrite
          let dt = conv.createdAt;
          if (!dt || isNaN(new Date(dt).getTime())) {
            dt = new Date();
          } else {
            dt = new Date(dt);
          }
          conv.createdAt = dt;
          await conv.save();
        } catch (e) {
          console.error('Migration createdAt fix error', conv._id, e.message);
        }
      }
    }

    // migration: backfill organizationId for any users or teams missing it
    try {
      const User = require('./models/User');
      const Team = require('./models/Team');
      const Organization = require('./models/Organization');
      const Site = require('./models/Site');

      const usersNoOrg = await User.find({ organizationId: { $in: [null, undefined] } });
      if (usersNoOrg.length) {
        console.log(`[Migration] fixing ${usersNoOrg.length} users without organizationId`);
        for (const user of usersNoOrg) {
          try {
            let orgId = null;
            // first try owner relationship (site.userId)
            const owned = await Site.findOne({ userId: user._id }).select('organizationId');
            if (owned && owned.organizationId) {
              orgId = owned.organizationId;
            }
            // fallback to assignedSites array
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
            console.error('Migration user org fix error', user._id, e.message);
          }
        }
      }

      const teamsNoOrg = await Team.find({ organizationId: { $in: [null, undefined] } });
      if (teamsNoOrg.length) {
        console.log(`[Migration] fixing ${teamsNoOrg.length} teams without organizationId`);
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
            console.error('Migration team org fix error', team._id, e.message);
          }
        }
      }

      // additionally sync existing sites with their owner users/orgs
      const allSites = await Site.find().limit(1000);
      for (const site of allSites) {
        if (site.userId) {
          const owner = await User.findById(site.userId).select('organizationId');
          if (owner && owner.organizationId) {
            if (!site.organizationId.equals(owner.organizationId)) {
              site.organizationId = owner.organizationId;
              await site.save();
              console.log('[Migration] updated site org to match owner', site._id);
            }
          } else if (owner && !owner.organizationId) {
            owner.organizationId = site.organizationId;
            await owner.save();
            console.log('[Migration] updated owner org to match site', owner._id);
          }
        }
      }
    } catch (migrationErr) {
      console.error('Migration user/team org error:', migrationErr.message);
    }

  } catch (error) {
    console.error('Migration error:', error.message);
  }

  server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
  });
}).catch((error) => {
  console.error('Server failed to start:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled error:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('Server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
