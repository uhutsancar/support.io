/**
 * Çeviri ağacı iki parçadan birleşir:
 *
 *   locales/tr.js            panelin çevirisi (yalnız uygulama yollarında yüklenir)
 *   locales/marketing.tr.js  pazarlama sayfalarının metni (sık değişir)
 *   locales/pages.tr.js      sektör çözümleri ve yapay zekâ sayfası
 *
 * İkincisi birincinin ÜZERİNE yazılır. Böylece ana sayfa başlığını
 * değiştirmek için panelin tamamını taşıyan dosyayı açmak gerekmez ve iki
 * içerik birbirinin çakışmasına yol açmaz.
 *
 * Diziler birleştirilmez, DEĞİŞTİRİLİR. Birleştirme yapılsaydı pazarlama
 * dosyasındaki üç maddelik yeni bir liste, temel dosyadaki dört maddelik eski
 * listenin ilk üçünü ezip dördüncüsünü ayakta bırakırdı — yani kimsenin
 * yazmadığı karma bir liste çıkardı.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import marketingTr from './locales/marketing.tr';
import pagesTr from './locales/pages.tr';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function deepMerge(base: any, override: any) {
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const next = override[key];
    out[key] = isPlainObject(next) && isPlainObject(base[key]) ? deepMerge(base[key], next) : next;
  }
  return out;
}

// The Turkish public-site texts are the only locale in the first load.
// English and the much larger panel/account trees are route-level chunks.
i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: deepMerge(marketingTr, pagesTr) }
  },
  partialBundledLanguages: true,
  lng: 'tr',
  fallbackLng: 'tr',
  interpolation: {
    escapeValue: false
  }
});

const publicLoads: Partial<Record<'tr' | 'en', Promise<void>>> = {};
const appLoads: Partial<Record<'tr' | 'en', Promise<void>>> = {};

export function isApplicationPath(pathname: string): boolean {
  const path = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return /^\/(?:dashboard(?:\/|$)|onboarding(?:\/|$)|login\/?$|register\/?$|forgot-password\/?$|reset-password\/?$|verify-email\/?$|confirm-email\/?$|rate\/?$|invite\/accept\/?$)/.test(
    path
  );
}

async function ensurePublicLanguage(lang: 'tr' | 'en'): Promise<void> {
  if (lang === 'tr' || i18n.hasResourceBundle('en', 'translation')) return;
  publicLoads.en ??= Promise.all([
    import('./locales/marketing.en'),
    import('./locales/pages.en')
  ]).then(([marketing, pages]) => {
    i18n.addResourceBundle('en', 'translation', deepMerge(marketing.default, pages.default));
  });
  try {
    await publicLoads.en;
  } catch (error) {
    delete publicLoads.en;
    throw error;
  }
}

/** Makes the public texts, and only when needed the panel texts, available. */
export async function ensureLanguage(lang: 'tr' | 'en', pathname = '/'): Promise<void> {
  await ensurePublicLanguage(lang);
  if (!isApplicationPath(pathname) || appLoads[lang]) return appLoads[lang];

  appLoads[lang] = (
    lang === 'tr'
      ? Promise.all([import('./locales/tr'), import('./locales/account.tr')])
      : Promise.all([import('./locales/en'), import('./locales/account.en')])
  )
    .then(([panel, account]) => {
      const publicTree = i18n.getResourceBundle(lang, 'translation') ?? {};
      i18n.addResourceBundle(
        lang,
        'translation',
        deepMerge(deepMerge(panel.default, publicTree), account.default),
        true,
        true
      );
    })
    .catch((error) => {
      delete appLoads[lang];
      throw error;
    });
  return appLoads[lang];
}

/** Loads a language if needed, then switches to it. */
export async function switchLanguage(
  lang: 'tr' | 'en',
  pathname = window.location.pathname
): Promise<void> {
  await ensureLanguage(lang, pathname).catch(() => undefined);
  if (i18n.language !== lang) await i18n.changeLanguage(lang);
}

/** The language the address asks for: /en… is English, everything else Turkish. */
export function languageOfPath(pathname: string): 'tr' | 'en' {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'tr';
}

export default i18n;
