require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const SocketHandler = require('./socket/socketHandler');

// Import routes
const authRoutes = require('./routes/auth');
const siteRoutes = require('./routes/sites');
const faqRoutes = require('./routes/faqs');
const conversationRoutes = require('./routes/conversations');
const widgetRoutes = require('./routes/widget');
const filesRoutes = require('./routes/files');
const departmentRoutes = require('./routes/departments');
const teamRoutes = require('./routes/team');

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS for widget
const io = new Server(server, {
  cors: {
    origin: '*', // Widget her yerden bağlanabilir (demo için)
    methods: ['GET', 'POST'],
    credentials: false
  }
});

// Security middleware - with exceptions for widget
app.use(helmet({
  contentSecurityPolicy: false, // Widget için CSP devre dışı
  crossOriginResourcePolicy: false // Widget dosyası için
}));

// Compression middleware - gzip compression for responses
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9)
}));

// Cache control middleware
app.use((req, res, next) => {
  // Static files için cache
  if (req.url.includes('/widget.js')) {
    res.set('Cache-Control', 'public, max-age=3600'); // 1 saat
  } else if (req.url.startsWith('/api')) {
    // API responses için no-cache (her zaman fresh data)
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
  }
  next();
});

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Set socket.io instance for use in routes
app.set('io', io);

// Rate limiting - prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs (development için daha esnek)
  message: 'Too many login attempts, please try again later.'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500 // Development için daha yüksek limit
});

// CORS - development için herkese açık
app.use('/api', cors({
  origin: '*',
  credentials: true
}));

// Widget files için herkese açık CORS
app.use('/widget.js', cors({
  origin: '*',
  credentials: false
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', siteRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/widget', widgetRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/team', teamRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'DestekChat API çalışıyor',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Root endpoint
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

// Widget static file - public folder serve et
app.use(express.static('public', {
  setHeaders: (res, path) => {
    if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

// Demo page serve et
app.use('/demo', express.static('../demo'));

// Initialize Socket.io handlers
new SocketHandler(io);

// Connect to database and start server
const PORT = process.env.PORT || 3000;

connectDB().then(async () => {
  // Migration: Update old 'open' status to 'unassigned'
  try {
    const Conversation = require('./models/Conversation');
    await Conversation.updateMany(
      { status: 'open' },
      { $set: { status: 'unassigned' } }
    );
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

// Error handling
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
