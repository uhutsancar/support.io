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
const automationRulesRoutes = require('./routes/automationRules');
const proactiveRulesRoutes = require('./routes/proactiveRules');
const eventsRoutes = require('./routes/events');
const analyticsRoutes = require('./routes/analytics');
const aiRoutes = require('./routes/ai');

const app = express();
app.set('trust proxy', 1); // Cloudflare üzerinden gelen gerçek IP'leri tanıması için ŞART
const server = http.createServer(app);

// --- 🛡️ 1. CORS VE GÜVENLİK AYARLARI ---
//
// İzinli origin listesi ortamdan gelir; dağıtım adresi kaynak kodda gömülü
// durmaz. CORS_ORIGINS virgülle ayrılmış tam origin listesidir, örneğin:
//   CORS_ORIGINS=https://panel.ornek.com,https://www.ornek.com
//
// Tanımlı değilse bugünkü davranış korunur: mevcut dağıtım adresi listede
// kalır, böylece bu değişiklik çalışan bir kurulumu bozmaz.
const FALLBACK_PRODUCTION_ORIGINS = ['https://main.d3gdzskzc1itkc.amplifyapp.com'];

// Geliştirme portları yalnızca production dışında açılır. Üretimde localhost'a
// izin vermek, geliştiricinin makinesindeki bir sayfanın canlı API'ye
// istek atabilmesi demektir.
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',  // demo sayfası (npx serve)
  'http://localhost:3002',  // admin panel (vite dev)
  'http://localhost:3004',
  'http://localhost:5173'   // docker compose'daki admin servisi
];

const isProduction = process.env.NODE_ENV === 'production';

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...(configuredOrigins.length ? configuredOrigins : FALLBACK_PRODUCTION_ORIGINS),
  ...(isProduction ? [] : DEVELOPMENT_ORIGINS)
];

// Geliştirmede portlar sürekli değişir (vite 3002, demo 3001, docker 5173,
// `serve` rastgele port seçebilir) ve 127.0.0.1 ile localhost ayrı origin
// sayılır. Her birini listeye elle eklemek yerine, production DIŞINDA tüm
// yerel adresler kabul edilir. Üretimde bu kapı tamamen kapalıdır.
const LOCAL_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/;

// Gerçek telefondan test ederken sayfa makinenin LAN adresinden açılır
// (ör. http://192.168.1.20:3001). Yalnızca özel ağ aralıkları, yalnızca
// geliştirmede.
const PRIVATE_LAN_ORIGIN =
  /^https?:\/\/(10\.\d{1,3}|172\.(1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}(:\d+)?$/;

function isOriginAllowed(origin) {
  // Tarayıcı dışı istemciler (curl, mobil, sunucu-sunucu) origin göndermez.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin.includes('trycloudflare.com')) return true;
  if (!isProduction && (LOCAL_ORIGIN.test(origin) || PRIVATE_LAN_ORIGIN.test(origin))) return true;
  return false;
}

// Socket.io CORS ayarı
const io = new Server(server, {
  cors: {
    // HTTP ile aynı kural: widget farklı bir portta çalıştığında socket
    // bağlantısı da engellenmemeli.
    origin: (origin, callback) => callback(null, isOriginAllowed(origin)),
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Express CORS ayarı
app.use(cors({
  origin: function (origin, callback) {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      // Reddedilen origin'i yaz: eski mesaj hangi adresin engellendiğini
      // söylemediği için hata ayıklanamıyordu.
      console.warn(`[CORS] Reddedildi: ${origin} — izinli liste: ${allowedOrigins.join(', ')}`);
      callback(new Error(`CORS Policy: ${origin} adresine izin yok`));
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

// Limitler.
//
// Sayaç süreç belleğindedir: backend birden fazla sürece çıkarıldığında her
// sürecin kendi sayacı olur ve efektif limit sürec sayısıyla çarpılır. Tek
// paylaşımlı limit gerekiyorsa rate-limit-redis store'u eklenmelidir; bugünkü
// tek süreç kurulumunda gerek yok.
//
// Yoğun bir destek ekibi 15 dakikada 1000 istegi kolayca aşar (gelen kutusu
// yenileme + realtime tetiklenen çağrılar), bu yüzden ortamdan ayarlanabilir.
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_MAX) || 100,
  message: 'Too many login attempts, please try again later.'
});
const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.API_RATE_MAX) || 1000
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
app.use('/api/automation-rules', automationRulesRoutes);
app.use('/api/proactive-rules', proactiveRulesRoutes);
// Visitor behaviour ingestion from the widget's tracking SDK. Authenticated by
// site key inside the route rather than by a bearer token.
app.use('/api/events', eventsRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/ai', aiRoutes);

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
  // Yatay ölçekleme: REDIS_URL varsa olaylar süreçler arasında yayılır.
  // Socket.io başlatılmadan önce bağlanmalı.
  const { attachRedisAdapter } = require('./socket/adapter');
  const adapterState = await attachRedisAdapter(io);

  // Socket.io başlat
  new SocketHandler(io);

  // Kural motorları io'ya ihtiyaç duyar, bu yüzden soketten sonra kurulur.
  // Bu çağrı yapılmazsa getEngine() sürekli null döner ve kurallar hiç çalışmaz.
  require('./services/automationEngine').initialize(io);
  require('./services/proactiveEngine').initialize(io);

  // SLA sayaçları artık istek yolunda değil burada işlenir; okuma istekleri
  // veritabanına yazmaz.
  //
  // Çok süreçli kurulumda her sürecin süpürmesi gereksiz tekrar üretir.
  // SLA_SWEEPER=off ile kapatılıp yalnızca bir süreçte açık bırakılabilir.
  if (process.env.SLA_SWEEPER !== 'off') {
    require('./services/slaSweeper').startSlaSweeper(io);
  }

  server.listen(PORT, () => {
    console.log(`🚀 Sunucu ${PORT} portunda ve bulutlarda uçuyor!`);
    console.log(
      adapterState.enabled
        ? `   Socket.IO Redis adapter aktif (${adapterState.url}) — çok süreç desteklenir`
        : `   Socket.IO tek süreç modu — ${adapterState.reason}`
    );
  });
}).catch((error) => {
  console.error('Bağlantı hatası:', error);
  process.exit(1);
});

// Hata Yönetimi
process.on('unhandledRejection', (err) => {
  console.error('Beklenmedik Hata:', err);
});
