/**
 * Çeviri ağacı iki parçadan birleşir:
 *
 *   locales/tr.js            panelin çevirisi (1800+ satır, seyrek değişir)
 *   locales/marketing.tr.js  pazarlama sayfalarının metni (sık değişir)
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
import en from './locales/en';
import marketingTr from './locales/marketing.tr';
import marketingEn from './locales/marketing.en';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function deepMerge(base: any, override: any) {
  const out = { ...base };
  for (const key of Object.keys(override)) {
    const next = override[key];
    out[key] = isPlainObject(next) && isPlainObject(base[key])
      ? deepMerge(base[key], next)
      : next;
  }
  return out;
}

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: deepMerge(tr, marketingTr) },
      en: { translation: deepMerge(en, marketingEn) },
    },
    lng: localStorage.getItem('language') || 'tr',
    fallbackLng: 'tr',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
