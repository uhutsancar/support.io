// Loads .env before any module below reads it; see src/config/env.ts.
import { isProduction } from './config/env';
import express from 'express';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { sanitizeInput } from './middleware/sanitize';
import { isOriginAllowed } from './config/origins';
import helmet from 'helmet';
import { contentSecurityPolicy, withNonce } from './middleware/csp';
import compression from 'compression';
import connectDB from './config/database';
import { isConnected } from './config/database';
import SocketHandler from './socket';
import authRoutes from './routes/auth';
import siteRoutes from './routes/sites';
import faqRoutes from './routes/faqs';
import conversationRoutes from './routes/conversations';
import widgetRoutes from './routes/widget';
import filesRoutes from './routes/files';
import departmentRoutes from './routes/departments';
import teamRoutes from './routes/team';
import teamChatRoutes from './routes/teamChat';
import auditRoutes from './routes/audit';
import onboardingRoutes from './routes/onboarding';
import widgetConfigRoutes from './routes/widgetConfig';
import visitorsRoutes from './routes/visitors';
import dealsRoutes from './routes/deals';
import automationRulesRoutes from './routes/automationRules';
import proactiveRulesRoutes from './routes/proactiveRules';
import eventsRoutes from './routes/events';
import analyticsRoutes from './routes/analytics';
import aiRoutes from './routes/ai';
import { initialize as initializeAutomationEngine } from './services/automationEngine';
import { initialize as initializeProactiveEngine } from './services/proactiveEngine';
import { startSlaSweeper } from './services/slaSweeper';
import { closeRedisAdapter } from './socket/adapter';
import { stopAutoReplies } from './services/ai/autoReply';
import {
  loginLimiter,
  loginAccountLimiter,
  registerLimiter,
  apiLimiter
} from './middleware/rateLimit';
import { apiNotFound, errorHandler } from './http';
import { IMAGE_TYPES, UPLOAD_ROOT, UPLOAD_URL_PREFIX, describeStorage } from './middleware/upload';
import './services/auditService';
import { attachRedisAdapter } from './socket/adapter';
import type { Request, Response, NextFunction } from 'express';

// --- Route Tanımları ---

// The rule engines and the SLA sweeper need the socket server, so they are
// started after it is created rather than at import time.

const app = express();
app.set('trust proxy', 1);
// Sorgu dizesi düz ayrıştırılır: `?siteKey[$ne]=x` bir nesneye (ve ORM için
// bir operatöre) dönüşmez. Ayrıntı: middleware/sanitize.ts
app.set('query parser', 'simple'); // Cloudflare üzerinden gelen gerçek IP'leri tanıması için ŞART
const server = http.createServer(app);

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must contain at least 32 characters in production');
  }
  if (!process.env.CORS_ORIGINS) {
    throw new Error('CORS_ORIGINS must be explicitly configured in production');
  }
}

// --- 🛡️ 1. CORS VE GÜVENLİK AYARLARI ---
//
// Köken listesi ve kuralları config/origins.ts'te; yönetici soketi de aynı
// listeye bakıyor.

// Socket.io CORS ayarı
const io = new Server(server, {
  cors: {
    // The engine endpoint is shared by the public /widget and authenticated
    // /admin namespaces. Customer sites must be able to reach /widget from any
    // origin; /admin security is enforced by its mandatory JWT middleware.
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  },
  maxHttpBufferSize: 1024 * 1024,
  pingInterval: 25000,
  pingTimeout: 20000
});

// Public widget APIs are intentionally cross-origin: the one-line embed must
// work on customer domains without redeploying this service for every site.
// Dashboard APIs keep the strict allow-list below.
const PUBLIC_EMBED_PATHS = [
  '/api/widget/',
  '/api/widget-config/public/',
  '/api/faqs/search',
  '/api/files/upload',
  '/api/events/'
];
app.use(
  cors((req, callback) => {
    const isPublicEmbedRequest = PUBLIC_EMBED_PATHS.some((prefix) => req.path.startsWith(prefix));
    callback(null, {
      origin: isPublicEmbedRequest
        ? true
        : (origin, originCallback) => {
            if (isOriginAllowed(origin)) return originCallback(null, true);
            console.warn(`[CORS] Rejected: ${origin}`);
            return originCallback(new Error('CORS origin denied'));
          },
      // Herkese acik uclar her kokeni yansitir; kimlik bilgisi (cerez) tasimalari
      // hem gereksiz (widget credentials: 'omit' kullanir) hem de tehlikeli olurdu:
      // 'her koken + kimlik bilgisi' bir sitenin kullanicinin oturumuyla istek
      // atip yaniti okuyabilmesi demektir. Panel uclari izin listesiyle kalir.
      credentials: !isPublicEmbedRequest,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'x-site-key', 'x-csrf-token']
    });
  })
);

// Helmet Ayarları (S3 resimlerinin engellenmesini çözen kısım)
//
// CSP helmet'in kendi varsayılanı yerine middleware/csp.ts'ten geliyor: panel
// ile /demo'nun ihtiyaçları farklı ve SPA kabuğunun satır içi bloğu için yanıt
// başına nonce üretilmesi gerekiyor. Kapalı bırakıldığında panelde XSS'e karşı
// ikinci bir savunma hattı kalmıyordu.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(contentSecurityPolicy({ isProduction }));

// --- ⚙️ 2. ARA KATMANLAR (MIDDLEWARES) ---
app.use(
  compression({
    filter: (req: Request, res: Response) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
    level: 6
  })
);

app.use((req: Request, res: Response, next: NextFunction) => {
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

// Hiz sinirlari surec disinda (Redis) tutulur ve kimligi dogrulanmis
// istekleri kullaniciya gore sayar; ayrintilar icin middleware/rateLimit.js.

// Oturum httpOnly cerezde tasinir; auth ara katmani onu buradan okur.
app.use(cookieParser());
app.use(express.json({ limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
app.use(express.urlencoded({ extended: false, limit: process.env.REQUEST_BODY_LIMIT || '2mb' }));
// Gövdelerden sorgu operatörlerini ve prototip kirleten anahtarları ayıklar.
app.use(sanitizeInput);

// --- 🛣️ 3. API ROUTELARI ---
// IP başına ve hesap başına iki ayrı sayaç; ayrıntı middleware/rateLimit.ts
app.use('/api/auth/login', loginLimiter, loginAccountLimiter);
app.use('/api/auth/register', registerLimiter);
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

app.use('/api/audit', auditRoutes);

// API callers always receive JSON rather than the SPA shell for an unmatched
// path. Failures inside a route are answered by `errorHandler`, registered
// after the static handlers at the bottom of this file.
app.use('/api', apiNotFound);

// Sağlık Kontrolü
app.get('/health', async (_req: Request, res: Response) => {
  const databaseConnected = await isConnected();
  res.status(databaseConnected ? 200 : 503).json({
    status: databaseConnected ? 'ok' : 'degraded',
    message: 'DestekChat API çalışıyor',
    timestamp: new Date().toISOString(),
    database: databaseConnected ? 'connected' : 'disconnected'
  });
});

app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'DestekChat API',
    version: '1.0.0',
    status: 'running'
  });
});

// --- 📦 4. STATİK DOSYALAR ---
//
// Yollar __dirname'e göre çözülür. Eskiden `express.static('public')` yazıyordu:
// bu ifade sürecin ÇALIŞMA DİZİNİNE görelidir, yani sunucu repo kökünden
// (`node backend/src/server.js`) veya bir servis yöneticisinden başlatıldığında
// widget.js 404 dönerdi. Aynı sorun /demo için de vardı.
const adminPanelPath = path.join(__dirname, '../../admin-panel/dist');
const publicPath = path.join(__dirname, '../public');
const demoPath = path.join(__dirname, '../../demo');

app.use(
  express.static(adminPanelPath, {
    maxAge: '1h',
    etag: true,
    lastModified: true
  })
);

// --- Widget dağıtımı ve sürümleme ---
//
//   /widget.js              → her zaman en güncel sürüm, kısa önbellek
//   /widget/v3/widget.js    → sabitlenmiş sürüm, uzun ve değişmez önbellek
//
// Müşteri sabitlenmiş yolu kullanıyorsa yeni bir dağıtım onun sayfasını
// bozamaz. Kök yolu kullanıyorsa güncellemeleri otomatik alır.
const WIDGET_MAJOR = 'v3';
const widgetFile = path.join(publicPath, 'widget.js');

function serveWidget(immutable: boolean) {
  return (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    // Widget herhangi bir müşteri alan adından yüklenir; bu dosya için * doğru
    // olan tek değerdir. Dosya publictir, kimlik taşımaz.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Cache-Control',
      immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300, must-revalidate'
    );
    res.sendFile(widgetFile);
  };
}

app.get('/widget.js', serveWidget(false));
app.get(`/widget/${WIDGET_MAJOR}/widget.js`, serveWidget(true));
// Yaygın yazım varyantları da aynı dosyaya düşer; kurulum talimatını yanlış
// kopyalayan bir müşteri 404 yerine çalışan bir widget alır.
app.get('/widget/widget.js', serveWidget(false));
app.get('/embed.js', serveWidget(false));

app.use(
  express.static(publicPath, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.js')) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
    }
  })
);

app.use('/demo', express.static(demoPath));

// Locally stored uploads. With S3 configured this directory stays empty and the
// route is simply never hit; see middleware/upload.ts.
//
// These are files strangers uploaded, so they are served defensively: the
// declared type is never re-sniffed, and anything that is not an image
// downloads instead of rendering — an uploaded .html must not be openable as a
// page on our own origin, where it would run with our cookies in scope.
app.use(
  UPLOAD_URL_PREFIX,
  express.static(UPLOAD_ROOT, {
    maxAge: '1y',
    index: false,
    dotfiles: 'deny',
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const type = express.static.mime.lookup(filePath);
      if (!IMAGE_TYPES.has(type)) {
        res.setHeader('Content-Disposition', 'attachment');
      }
      // The widget loads attachments from a customer's own page.
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  })
);

// React SPA fallback
// React SPA fallback
//
// Kabuk sendFile ile degil okunarak gonderiliyor: katı CSP altinda satir ici
// JSON-LD blogunun calismasi icin bu yanitin nonce'u isaretlenmeli.
const shellPath = path.join(adminPanelPath, 'index.html');
let shellCache: string | null = null;
app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/widget') ||
    req.path.startsWith('/demo')
  ) {
    return next();
  }
  try {
    // Uretimde kabuk degismez; gelistirmede her istekte yeniden okunur ki
    // yeniden derlenen panel aninda gorunsun.
    if (!shellCache || !isProduction) shellCache = fs.readFileSync(shellPath, 'utf8');
  } catch {
    // Gelistirmede panel Vite tarafindan sunulur ve dist hic uretilmez. Hatayi
    // yukari birakmak Expressin varsayilan isleyicisine dusup yigin izini
    // istemciye basiyordu; burasi durumu oldugu gibi soyluyor.
    return res
      .status(404)
      .type('text')
      .send(
        isProduction
          ? 'Not found'
          : 'Panel derlemesi yok (admin-panel/dist). Gelistirmede panel Vite tarafindan sunulur: http://localhost'
      );
  }
  res.type('html').send(withNonce(shellCache, res.locals.cspNonce));
});

// The error handler must come after EVERY route and static handler. Declared
// before them, failures while serving a file or the SPA shell never reach it
// and fall through to Express' default handler, which renders the stack trace
// outside production.
//
// What each kind of failure becomes is decided in src/http/errors.ts.
app.use(errorHandler);

// --- 💾 5. VERİTABANI VE BAŞLATMA ---
const PORT = process.env.PORT || 3000;

// How long open connections are given to finish before the process exits.
const SHUTDOWN_GRACE_MS = 3000;

connectDB()
  .then(async () => {
    // Yatay ölçekleme: REDIS_URL varsa olaylar süreçler arasında yayılır.
    // Socket.io başlatılmadan önce bağlanmalı.
    const adapterState = await attachRedisAdapter(io);

    // Socket.io başlat
    new SocketHandler(io);

    // Kural motorları io'ya ihtiyaç duyar, bu yüzden soketten sonra kurulur.
    // Bu çağrı yapılmazsa getEngine() sürekli null döner ve kurallar hiç çalışmaz.
    initializeAutomationEngine(io);
    initializeProactiveEngine(io);

    // SLA sayaçları artık istek yolunda değil burada işlenir; okuma istekleri
    // veritabanına yazmaz.
    //
    // Çok süreçli kurulumda her sürecin süpürmesi gereksiz tekrar üretir.
    // SLA_SWEEPER=off ile kapatılıp yalnızca bir süreçte açık bırakılabilir.
    if (process.env.SLA_SWEEPER !== 'off') {
      startSlaSweeper(io);
    }

    server.listen(PORT, () => {
      console.log(`🚀 Sunucu ${PORT} portunda ve bulutlarda uçuyor!`);
      console.log(
        adapterState.enabled
          ? `   Socket.IO Redis adapter aktif (${adapterState.url}) — çok süreç desteklenir`
          : `   Socket.IO tek süreç modu — ${adapterState.reason}`
      );
      console.log(`   Widget: /widget.js  (sabitlenmiş: /widget/${WIDGET_MAJOR}/widget.js)`);
      console.log(`   Dosya depolama: ${describeStorage()}`);
    });

    // Süreç kapanırken açık bağlantılar düzgün kapatılır. SIGTERM'de anında
    // ölmek, o an açık olan soketlerdeki mesajların kaybolması demektir.
    //
    // Windows'ta tek bir Ctrl+C, npm → nodemon → tsx zinciri boyunca sürece
    // birden fazla SIGINT olarak ulaşıyor; her biri kapatmayı baştan başlatıp
    // "HTTP sunucusu kapandı" satırını tekrar tekrar basıyordu. İlk sinyal
    // kapatmayı başlatır, sonrakiler yok sayılır.
    let shuttingDown = false;
    const shutdown = async (signal: NodeJS.Signals) => {
      if (shuttingDown) return;
      shuttingDown = true;
      console.log(`
${signal} alındı, kapatılıyor...`);
      server.close(() => console.log('   HTTP sunucusu kapandı'));
      // Answers still being written are abandoned, not left holding timers
      // and model slots while the process winds down.
      stopAutoReplies();
      try {
        // Awaited so open sockets are actually flushed before the grace
        // timer below pulls the process down under them.
        await io.close();
        await closeRedisAdapter();
      } catch (error) {
        // Already shutting down: a failure to close cleanly is worth seeing in
        // the log but must not stop the process from exiting.
        console.error('[shutdown] could not close sockets cleanly', error);
      }
      setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
    };
    // `void`: the process is on its way out, and there is nobody left to
    // report a failed shutdown to beyond the log inside `shutdown`.
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  })
  .catch((error) => {
    console.error('Bağlantı hatası:', error);
    process.exit(1);
  });

// Hata Yönetimi
process.on('unhandledRejection', (err) => {
  console.error('Beklenmedik Hata:', err);
});
