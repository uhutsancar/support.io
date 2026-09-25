/** The active locale, and the navigations that switch it. */
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { translatePath } from '../lib/marketingPaths';

export interface LanguageContextValue {
  language: 'tr' | 'en';
  toggleLanguage(): void;
  setTurkish(): void;
  setEnglish(): void;
  isTurkish: boolean;
  isEnglish: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);
export const useLanguage = (): LanguageContextValue => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const { i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const getLanguageFromPath = (): 'tr' | 'en' => {
    return location.pathname.startsWith('/en') ? 'en' : 'tr';
  };
  const [language, setLanguage] = useState(getLanguageFromPath);
  useEffect(() => {
    const newLang = getLanguageFromPath();
    if (newLang !== language) {
      setLanguage(newLang);
      i18n.changeLanguage(newLang);
      localStorage.setItem('language', newLang);
    }
  }, [location.pathname]);
  useEffect(() => {
    i18n.changeLanguage(language);
    localStorage.setItem('language', language);
    // `text-transform: uppercase` follows the document language, so leaving
    // this at "tr" turned English table headers into TRİGGER and ACTİON.
    document.documentElement.lang = language;
  }, [language, i18n]);
  // Pazarlama sayfalarının adı dile göre değiştiği için yol, önek eklenerek
  // değil eşleme tablosundan çevrilir (bkz. lib/marketingPaths).
  const switchTo = (next: 'tr' | 'en') => {
    const target = translatePath(location.pathname, next);
    if (target !== location.pathname) navigate(target + location.search + location.hash);
  };
  const toggleLanguage = () => switchTo(language === 'tr' ? 'en' : 'tr');
  const setTurkish = () => {
    if (language !== 'tr') switchTo('tr');
  };
  const setEnglish = () => {
    if (language !== 'en') switchTo('en');
  };
  return (
    <LanguageContext.Provider
      value={{
        language,
        toggleLanguage,
        setTurkish,
        setEnglish,
        isTurkish: language === 'tr',
        isEnglish: language === 'en'
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};
