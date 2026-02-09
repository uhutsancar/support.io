require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
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

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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
