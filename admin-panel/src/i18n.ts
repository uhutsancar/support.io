/**
 * Çeviri ağacı iki parçadan birleşir:
 *
 *   locales/tr.js            panelin çevirisi (1800+ satır, seyrek değişir)
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
import tr from './locales/tr';
import marketingTr from './locales/marketing.tr';
import pagesTr from './locales/pages.tr';
import accountTr from './locales/account.tr';

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

// Turkish, the default, ships with the first load. English is its own chunk,
// fetched only by a visitor who reads English (plan v10 PERF-08): half the
// texts were downloaded by every visitor and read by none.
i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: deepMerge(deepMerge(deepMerge(tr, marketingTr), pagesTr), accountTr) }
  },
  partialBundledLanguages: true,
  lng: 'tr',
  fallbackLng: 'tr',
  interpolation: {
    escapeValue: false
  }
});

let englishLoad: Promise<void> | null = null;

/** Makes a language's texts available; Turkish always is. */
export function ensureLanguage(lang: 'tr' | 'en'): Promise<void> {
  if (lang === 'tr' || i18n.hasResourceBundle('en', 'translation')) return Promise.resolve();
  englishLoad ??= Promise.all([
    import('./locales/en'),
    import('./locales/marketing.en'),
    import('./locales/pages.en'),
    import('./locales/account.en')
  ])
    .then(([en, marketing, pages, account]) => {
      i18n.addResourceBundle(
        'en',
        'translation',
        deepMerge(
          deepMerge(deepMerge(en.default, marketing.default), pages.default),
          account.default
        )
      );
    })
    .catch((error) => {
      englishLoad = null;
      throw error;
    });
  return englishLoad;
}

/** Loads a language if needed, then switches to it. */
export async function switchLanguage(lang: 'tr' | 'en'): Promise<void> {
  await ensureLanguage(lang).catch(() => undefined);
  if (i18n.language !== lang) await i18n.changeLanguage(lang);
}

/** The language the address asks for: /en… is English, everything else Turkish. */
export function languageOfPath(pathname: string): 'tr' | 'en' {
  return pathname === '/en' || pathname.startsWith('/en/') ? 'en' : 'tr';
}

export default i18n;
