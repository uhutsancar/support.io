/** The active locale, and the navigations that switch it. */
import { createContext, useContext, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { translatePath } from '../lib/marketingPaths';
import { switchLanguage } from '../i18n';

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
  const location = useLocation();
  const navigate = useNavigate();
  const language: 'tr' | 'en' = location.pathname.startsWith('/en') ? 'en' : 'tr';
  useEffect(() => {
    void switchLanguage(language, location.pathname);
    localStorage.setItem('language', language);
    // `text-transform: uppercase` follows the document language, so leaving
    // this at "tr" turned English table headers into TRİGGER and ACTİON.
    document.documentElement.lang = language;
  }, [language, location.pathname]);
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
