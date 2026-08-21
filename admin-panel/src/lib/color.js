/**
 * Widget stüdyosunun renk matematiği.
 *
 * Buradaki tek amaç: kullanıcının okunmayan bir widget üretmesini engellemek.
 * Eski ekranda sekiz tane çıplak `<input type="color">` vardı; beyaz üstüne
 * beyaz metin seçmek serbestti ve sonucu ancak canlı sitede görüyordunuz.
 * Artık her renk seçimi WCAG kontrast oranıyla birlikte gösteriliyor ve
 * paletin tamamı tek bir ana renkten türetilebiliyor.
 */

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function normalizeHex(input) {
  let hex = String(input || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  return /^[0-9a-f]{6}$/i.test(hex) ? '#' + hex.toUpperCase() : null;
}

export function hexToRgb(hex) {
  const normalized = normalizeHex(hex) || '#000000';
  return {
    r: parseInt(normalized.slice(1, 3), 16),
    g: parseInt(normalized.slice(3, 5), 16),
    b: parseInt(normalized.slice(5, 7), 16)
  };
}

export const rgbToHex = ({ r, g, b }) =>
  '#' + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();

export function rgbToHsl({ r, g, b }) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslToRgb({ h, s, l }) {
  const hn = (((h % 360) + 360) % 360) / 360;
  const sn = clamp(s, 0, 100) / 100;
  const ln = clamp(l, 0, 100) / 100;
  if (sn === 0) {
    const v = Math.round(ln * 255);
    return { r: v, g: v, b: v };
  }
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return {
    r: Math.round(channel(hn + 1 / 3) * 255),
    g: Math.round(channel(hn) * 255),
    b: Math.round(channel(hn - 1 / 3) * 255)
  };
}

export const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));
export const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

/** Rengi verilen kadar açar (pozitif) veya koyulaştırır (negatif). */
export function shift(hex, amount) {
  const hsl = hexToHsl(hex);
  return hslToHex({ ...hsl, l: clamp(hsl.l + amount, 0, 100) });
}

/** WCAG bağıl parlaklık. */
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const channel = (v) => {
    const n = v / 255;
    return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** İki renk arasındaki WCAG kontrast oranı (1–21). */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Bir zeminin üstünde okunacak metin rengi. */
export const readableOn = (hex) => (contrast(hex, '#FFFFFF') >= 3.2 ? '#FFFFFF' : '#111827');

/**
 * Kontrast oranını insan diline çevirir.
 * AA normal metin için 4.5, büyük metin/arayüz için 3.0 eşiğini kullanır.
 */
export function contrastVerdict(fg, bg, { large = false } = {}) {
  const ratio = contrast(fg, bg);
  const threshold = large ? 3 : 4.5;
  const aaa = large ? 4.5 : 7;
  return {
    ratio: Math.round(ratio * 10) / 10,
    level: ratio >= aaa ? 'AAA' : ratio >= threshold ? 'AA' : 'fail',
    passes: ratio >= threshold
  };
}

/**
 * Tek bir ana renkten tutarlı bir widget paleti türetir.
 *
 * Kural: yüzeyler ana rengin tonundan çok az doygunluk alır (nötr kalır ama
 * "aynı ailedendir"), metin renkleri kontrast eşiğini geçecek şekilde seçilir.
 * Bu, "her alanı ayrı ayrı ayarla" işini tek tıka indirir.
 */
export function derivePalette(primaryHex, { dark = false } = {}) {
  const primary = normalizeHex(primaryHex) || '#4F46E5';
  const { h, s } = hexToHsl(primary);

  if (dark) {
    return {
      primary,
      header: shift(primary, -6),
      background: hslToHex({ h, s: Math.min(s * 0.14, 12), l: 11 }),
      text: hslToHex({ h, s: Math.min(s * 0.1, 8), l: 96 }),
      textSecondary: hslToHex({ h, s: Math.min(s * 0.12, 10), l: 66 }),
      border: hslToHex({ h, s: Math.min(s * 0.14, 12), l: 20 }),
      visitorMessageBg: primary,
      agentMessageBg: hslToHex({ h, s: Math.min(s * 0.14, 12), l: 18 })
    };
  }

  return {
    primary,
    header: primary,
    background: '#FFFFFF',
    text: hslToHex({ h, s: Math.min(s * 0.16, 14), l: 12 }),
    textSecondary: hslToHex({ h, s: Math.min(s * 0.12, 10), l: 46 }),
    border: hslToHex({ h, s: Math.min(s * 0.18, 16), l: 91 }),
    visitorMessageBg: primary,
    agentMessageBg: hslToHex({ h, s: Math.min(s * 0.2, 18), l: 96 })
  };
}

/** Renk seçicideki hazır tonlar. Rastgele değil; her biri AA geçen bir ana renk. */
export const SWATCHES = [
  '#4F46E5', '#2563EB', '#0EA5E9', '#0D9488', '#059669',
  '#65A30D', '#CA8A04', '#EA580C', '#DC2626', '#DB2777',
  '#9333EA', '#7C3AED', '#475569', '#111827'
];
