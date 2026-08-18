require('dotenv').config();
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { isConnected } = require('./config/database');
const SocketHandler = require('./socket/socketHandler');

// --- Route Tanımları ---
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
app.set('trust proxy', 1); // Cloudflare üzerinden gelen gerçek IP'leri tanıması için ŞART
const server = http.createServer(app);

// --- 🛡️ 1. CORS VE GÜVENLİK AYARLARI ---
const allowedOrigins = [
  'https://main.d3gdzskzc1itkc.amplifyapp.com', // Senin Amplify Frontend'in
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3004'
];

// Socket.io CORS ayarı
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Express CORS ayarı (CORS Hatasını çözen kısım)
app.use(cors({
  origin: function (origin, callback) {
    // origin yoksa (mobil/curl) veya listedeyse veya trycloudflare tüneliyse izin ver
    if (!origin || allowedOrigins.indexOf(origin) !== -1 || origin.includes('trycloudflare.com')) {
      callback(null, true);
    } else {
      callback(new Error('CORS Policy: Bu adresten erişim izni yok!'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-site-key']
}));

// Helmet Ayarları (S3 resimlerinin engellenmesini çözen kısım)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginEmbedderPolicy: false
}));

// --- ⚙️ 2. ARA KATMANLAR (MIDDLEWARES) ---
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
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

app.set('io', io);

// Limitler
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100, // Kayıt için biraz esnettik kanka
  message: 'Too many login attempts, please try again later.'
});
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- 🛣️ 3. API ROUTELARI ---
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

// Sağlık Kontrolü
app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    message: 'DestekChat API çalışıyor',
    timestamp: new Date().toISOString(),
    database: (await isConnected()) ? 'connected' : 'disconnected'
  });
});

app.get('/', (req, res) => {
  res.json({
    name: 'DestekChat API',
    version: '1.0.0',
    status: 'running'
  });
});

// --- 📦 4. STATİK DOSYALAR ---
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

app.use('/demo', express.static('../demo'));

// React SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/widget.js') || req.path.startsWith('/demo')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../admin-panel/dist/index.html'));
});

// --- 💾 5. VERİTABANI VE BAŞLATMA ---
const PORT = process.env.PORT || 3000;

connectDB().then(async () => {
  // Socket.io başlat
  new SocketHandler(io);

  // Açık konuşmaları unassigned yap
  try {
    const Conversation = require('./models/Conversation');
    await Conversation.updateMany({ status: 'open' }, { $set: { status: 'unassigned' } });
  } catch (err) {
    console.error('Başlangıç düzeltmesi hatası:', err.message);
  }

  server.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda ve bulutlarda uçuyor!`);
  });
}).catch((error) => {
  console.error('Bağlantı hatası:', error);
  process.exit(1);
});

// Hata Yönetimi
process.on('unhandledRejection', (err) => {
  console.error('Beklenmedik Hata:', err);
});
