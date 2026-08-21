#!/usr/bin/env node
'use strict';

/**
 * Marka ikonlarini uretir: favicon.svg + favicon.ico + PNG turevleri.
 *
 * Neden elle rasterizer:
 * Depoda sharp / canvas / resvg gibi bir raster kutuphanesi yok ve bir ikon
 * ureticisi icin agir bir bagimlilik eklemek istemedik. Mark tamamen geometrik
 * (yuvarlatilmis dikdortgenler + bir kuyruk ucgeni) oldugu icin isaretli mesafe
 * alani (SDF) ile dogrudan piksel uzayinda cizilebiliyor; kenar yumusatma 4x4
 * supersampling ile yapiliyor. Cikti SVG ile ayni geometriyi paylasir.
 *
 * Kullanim:  node scripts/build-icons.js
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT = path.join(__dirname, '..', 'public');
const BRAND = [0x4f, 0x46, 0xe5];

// --- geometri (Logo.jsx ile ayni 40x40 koordinat sistemi) -------------------

/** Yuvarlatilmis dikdortgen icin isaretli mesafe. Negatif = ic taraf. */
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/** Ucgen icin isaretli mesafe (kuyruk). */
function sdTriangle(px, py, a, b, c) {
  const sign = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
  const d1 = sign([px, py], a, b);
  const d2 = sign([px, py], b, c);
  const d3 = sign([px, py], c, a);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return hasNeg && hasPos ? 1 : -1;   // sadece ic/dis; kenarlar supersampling ile yumusar
}

/**
 * (x, y) noktasinin rengini dondurur. Koordinatlar 0..40 araligindadir.
 * Donen deger [r, g, b, a] (0..255).
 */
function shade(x, y, opaqueBackground) {
  const inBadge = sdRoundRect(x, y, 0, 0, 40, 40, 11) <= 0;
  if (!inBadge) return [0, 0, 0, 0];

  let color = BRAND.slice();
  let alpha = 255;

  // arka balon: %45 beyaz
  if (sdRoundRect(x, y, 7, 6.5, 19, 14, 5.5) <= 0) {
    color = color.map((c) => Math.round(c + (255 - c) * 0.45));
  }
  // ayirici bosluk: marka rengine geri doner
  if (sdRoundRect(x, y, 12.2, 12.3, 21.6, 17, 7) <= 0) {
    color = BRAND.slice();
  }
  // on balon govdesi + kuyruk: dolu beyaz
  const body = sdRoundRect(x, y, 13.5, 13.5, 19, 14.5, 5.5) <= 0;
  const tail = sdTriangle(x, y, [18.5, 24], [15.6, 33.2], [24.5, 26]) <= 0;
  if (body || tail) {
    color = [255, 255, 255];
  }

  if (!opaqueBackground) return [color[0], color[1], color[2], alpha];
  return [color[0], color[1], color[2], 255];
}

/** 4x4 supersampling ile RGBA tampon uretir. */
function render(size) {
  const S = 4;
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const x = ((px + (sx + 0.5) / S) / size) * 40;
          const y = ((py + (sy + 0.5) / S) / size) * 40;
          const c = shade(x, y, false);
          // alfa on-carpimli toplanir, aksi halde kenarlarda koyu hale olusur
          const w = c[3] / 255;
          r += c[0] * w; g += c[1] * w; b += c[2] * w; a += c[3];
        }
      }
      const n = S * S;
      const alpha = a / n;
      const wsum = a / 255 || 1;
      const i = (py * size + px) * 4;
      buf[i] = Math.round(r / wsum);
      buf[i + 1] = Math.round(g / wsum);
      buf[i + 2] = Math.round(b / wsum);
      buf[i + 3] = Math.round(alpha);
    }
  }
  return buf;
}

// --- PNG kodlayici ----------------------------------------------------------

function crc32(buf) {
  let c;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c;
    }
    return t;
  })());
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: None
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;    // bit depth
  ihdr[9] = 6;    // colour type: RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/** PNG gomulu .ico. Tum modern tarayicilar ve Windows bunu okur. */
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);           // type: icon
  header.writeUInt16LE(entries.length, 4);

  const dir = Buffer.alloc(16 * entries.length);
  let offset = header.length + dir.length;
  entries.forEach((entry, i) => {
    const o = i * 16;
    dir[o] = entry.size >= 256 ? 0 : entry.size;
    dir[o + 1] = entry.size >= 256 ? 0 : entry.size;
    dir[o + 2] = 0;
    dir[o + 3] = 0;
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(entry.png.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}

// --- SVG --------------------------------------------------------------------

const SVG_MARK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <rect width="40" height="40" rx="11" fill="#4F46E5"/>
  <rect x="7" y="6.5" width="19" height="14" rx="5.5" fill="#fff" fill-opacity=".45"/>
  <rect x="12.2" y="12.3" width="21.6" height="17" rx="7" fill="#4F46E5"/>
  <path d="M19 13.5h8a5.5 5.5 0 0 1 5.5 5.5v3.5a5.5 5.5 0 0 1-5.5 5.5h-4.3l-6.5 4.8a.6.6 0 0 1-.95-.6l1.2-4.35A5.5 5.5 0 0 1 13.5 22.5V19a5.5 5.5 0 0 1 5.5-5.5z" fill="#fff"/>
</svg>
`;

// og:image — 1200x630, marka + kelime markasi. Sosyal onizleme icin.
const SVG_OG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <rect width="1200" height="630" fill="#0B0D17"/>
  <g transform="translate(392 232) scale(4.4)">
    <rect width="40" height="40" rx="11" fill="#4F46E5"/>
    <rect x="7" y="6.5" width="19" height="14" rx="5.5" fill="#fff" fill-opacity=".45"/>
    <rect x="12.2" y="12.3" width="21.6" height="17" rx="7" fill="#4F46E5"/>
    <path d="M19 13.5h8a5.5 5.5 0 0 1 5.5 5.5v3.5a5.5 5.5 0 0 1-5.5 5.5h-4.3l-6.5 4.8a.6.6 0 0 1-.95-.6l1.2-4.35A5.5 5.5 0 0 1 13.5 22.5V19a5.5 5.5 0 0 1 5.5-5.5z" fill="#fff"/>
  </g>
  <text x="600" y="470" text-anchor="middle" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="72" font-weight="650" letter-spacing="-2" fill="#fff">Support<tspan fill="#818CF8">.io</tspan></text>
  <text x="600" y="528" text-anchor="middle" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        font-size="26" font-weight="400" fill="#9CA3AF">Canli destek, tek satir kodla</text>
</svg>
`;

// --- calistir ---------------------------------------------------------------

fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, 'favicon.svg'), SVG_MARK);
fs.writeFileSync(path.join(OUT, 'logo-mark.svg'), SVG_MARK);
fs.writeFileSync(path.join(OUT, 'og-image.svg'), SVG_OG);

const sizes = [16, 32, 48, 180, 192, 512];
const rendered = {};
for (const size of sizes) {
  rendered[size] = encodePng(render(size), size);
}

fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), rendered[180]);
fs.writeFileSync(path.join(OUT, 'icon-192.png'), rendered[192]);
fs.writeFileSync(path.join(OUT, 'icon-512.png'), rendered[512]);
fs.writeFileSync(
  path.join(OUT, 'favicon.ico'),
  encodeIco([16, 32, 48].map((size) => ({ size, png: rendered[size] })))
);

fs.writeFileSync(
  path.join(OUT, 'site.webmanifest'),
  JSON.stringify(
    {
      name: 'Support.io',
      short_name: 'Support.io',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ],
      theme_color: '#4F46E5',
      background_color: '#ffffff',
      display: 'standalone',
      start_url: '/dashboard'
    },
    null,
    2
  ) + '\n'
);

console.log('Ikonlar uretildi:');
for (const file of fs.readdirSync(OUT).sort()) {
  const stat = fs.statSync(path.join(OUT, file));
  if (stat.isFile()) console.log('  ' + file.padEnd(24) + (stat.size / 1024).toFixed(1) + ' KB');
}
