require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
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

const app = express();
const server = http.createServer(app);

// Socket.io setup with proper CORS
const io = new Server(server, {
  cors: {
    origin: process.env.ADMIN_URL || 'http://localhost:3002',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet());

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Rate limiting - prevent brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many login attempts, please try again later.'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

// CORS with specific origin
app.use(cors({
  origin: [process.env.ADMIN_URL, process.env.WIDGET_URL],
  credentials: true
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

// Widget static file
app.get('/widget.js', (req, res) => {
  res.sendFile(__dirname + '/../public/widget.js');
});

console.log('✅ Endpoint\'ler yapılandırıldı');

// Initialize Socket.io handlers
new SocketHandler(io);
console.log('✅ WebSocket handler\'ları başlatıldı');

// Connect to database and start server
const PORT = process.env.PORT || 3000;

connectDB().then(() => {
  server.listen(PORT, () => {
    console.log(`✅ Server started on port ${PORT}`);
  });
}).catch((error) => {
  console.error('❌ Server failed to start:', error.message);
  process.exit(1);
});

// Error handling
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled error:', err.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Server shutting down...');
  server.close(() => {
    process.exit(0);
  });
});
