import { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const LanguageProvider = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguage] = useState(() => {
    // LocalStorage'dan dil tercihini al, yoksa 'tr' kullan
    const savedLanguage = localStorage.getItem('language');
    return savedLanguage || 'tr';
  });

  useEffect(() => {
    // LocalStorage'a kaydet ve i18next'i güncelle
    localStorage.setItem('language', language);
    i18n.changeLanguage(language);
  }, [language, i18n]);

  const toggleLanguage = () => {
    setLanguage(prevLang => prevLang === 'tr' ? 'en' : 'tr');
  };

  const setTurkish = () => setLanguage('tr');
  const setEnglish = () => setLanguage('en');

  return (
    <LanguageContext.Provider value={{ 
      language, 
      toggleLanguage, 
      setTurkish, 
      setEnglish,
      isTurkish: language === 'tr',
      isEnglish: language === 'en'
    }}>
      {children}
    </LanguageContext.Provider>
  );
};
