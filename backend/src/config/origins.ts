'use strict';

// İzinli kökenler (CORS ve yönetici soketi).
//
// server.ts'ten taşındı: panel oturumu artık httpOnly çerezde ve soket el
// sıkışması da o çerezle kimlik doğruluyor. Tarayıcı çerezi bir WebSocket
// isteğine, isteği başlatan sayfa hangi siteden olursa olsun ekleyebilir
// (Cross-Site WebSocket Hijacking). Yönetici soketi bu yüzden aynı köken
// listesine bakmak zorunda; kaynağı tek olsun diye burada duruyor.

//
// İzinli origin listesi ortamdan gelir; dağıtım adresi kaynak kodda gömülü
// durmaz. CORS_ORIGINS virgülle ayrılmış tam origin listesidir, örneğin:
//   CORS_ORIGINS=https://panel.ornek.com,https://www.ornek.com
//
// Tanımlı değilse bugünkü davranış korunur: mevcut dağıtım adresi listede
// kalır, böylece bu değişiklik çalışan bir kurulumu bozmaz.
// From config/env, which loads .env first. Computed here, it ran before the
// environment existed and was therefore always false.
import { isProduction } from './env';

const FALLBACK_PRODUCTION_ORIGINS = ['https://main.d3gdzskzc1itkc.amplifyapp.com'];

// Geliştirme portları yalnızca production dışında açılır. Üretimde localhost'a
// izin vermek, geliştiricinin makinesindeki bir sayfanın canlı API'ye
// istek atabilmesi demektir.
const DEVELOPMENT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001', // demo sayfası (npx serve)
  'http://localhost:3002', // admin panel (vite dev)
  'http://localhost:3004',
  'http://localhost:5173' // docker compose'daki admin servisi
];


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

function isOriginAllowed(origin: string | undefined): boolean {
  // Tarayıcı dışı istemciler (curl, mobil, sunucu-sunucu) origin göndermez.
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (!isProduction) {
    try {
      if (new URL(origin).hostname.endsWith('.trycloudflare.com')) return true;
    } catch {
      return false;
    }
  }
  if (!isProduction && (LOCAL_ORIGIN.test(origin) || PRIVATE_LAN_ORIGIN.test(origin))) return true;
  return false;
}

export { isOriginAllowed, allowedOrigins };
