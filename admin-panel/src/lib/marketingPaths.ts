/**
 * Türkçe ve İngilizce pazarlama yollarının eşlemesi.
 *
 * Dil değiştirici eskiden yolun başına yalnızca `/en` ekliyordu. Panel ve
 * giriş sayfaları için bu doğru (`/dashboard` → `/en/dashboard`), ama
 * pazarlama sayfalarının adları dile göre değişiyor: `/ozellikler` sayfasında
 * EN'e geçen kişi `/en/ozellikler` adında olmayan bir rotaya düşüyor ve ana
 * sayfaya atılıyordu. Buradaki tablo iki dilin karşılığını tek yerde tutar.
 */

/** [Türkçe önek, İngilizce önek]. Alt yollar (`/:slug`) olduğu gibi taşınır. */
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['/ozellikler', '/en/features'],
  ['/cozumler', '/en/solutions'],
  ['/yapay-zeka', '/en/ai'],
  ['/fiyatlandirma', '/en/pricing'],
  ['/dokumantasyon', '/en/documentation'],
  ['/hakkimizda', '/en/about']
];

const matches = (path: string, prefix: string) =>
  path === prefix || path.startsWith(prefix + '/');

/** The same page in the other language; unknown paths only swap the `/en` prefix. */
export function translatePath(path: string, to: 'tr' | 'en'): string {
  for (const [tr, en] of PAIRS) {
    if (to === 'en' && matches(path, tr)) return en + path.slice(tr.length);
    if (to === 'tr' && matches(path, en)) return tr + path.slice(en.length);
  }
  if (to === 'en') return path.startsWith('/en') ? path : '/en' + (path === '/' ? '' : path);
  return path.startsWith('/en') ? path.slice(3) || '/' : path;
}

/** Every marketing destination in one language. */
export function marketingRoutes(language: 'tr' | 'en') {
  const en = language === 'en';
  const langPrefix = en ? '/en' : '';
  return {
    langPrefix,
    home: langPrefix || '/',
    features: en ? '/en/features' : '/ozellikler',
    solutions: en ? '/en/solutions' : '/cozumler',
    ai: en ? '/en/ai' : '/yapay-zeka',
    pricing: en ? '/en/pricing' : '/fiyatlandirma',
    docs: en ? '/en/documentation' : '/dokumantasyon',
    about: en ? '/en/about' : '/hakkimizda',
    login: langPrefix + '/login',
    register: langPrefix + '/register',
    dashboard: langPrefix + '/dashboard'
  };
}
