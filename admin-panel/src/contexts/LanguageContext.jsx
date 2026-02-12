import { createContext, useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';

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
  const location = useLocation();
  const navigate = useNavigate();
  
  // URL'den dili belirle
  const getLanguageFromPath = () => {
    return location.pathname.startsWith('/en') ? 'en' : 'tr';
  };

  const [language, setLanguage] = useState(getLanguageFromPath);

  useEffect(() => {
    // URL değiştiğinde dili güncelle
    const newLang = getLanguageFromPath();
    if (newLang !== language) {
      setLanguage(newLang);
      i18n.changeLanguage(newLang);
      localStorage.setItem('language', newLang);
    }
  }, [location.pathname]);

  useEffect(() => {
    // Dil değiştiğinde i18next'i güncelle
    i18n.changeLanguage(language);
    localStorage.setItem('language', language);
  }, [language, i18n]);

  const toggleLanguage = () => {
    const newLang = language === 'tr' ? 'en' : 'tr';
    const currentPath = location.pathname;
    
    if (newLang === 'en') {
      // TR'den EN'e geçiş: /en prefix ekle
      if (!currentPath.startsWith('/en')) {
        navigate('/en' + currentPath);
      }
    } else {
      // EN'den TR'ye geçiş: /en prefix kaldır
      if (currentPath.startsWith('/en')) {
        navigate(currentPath.replace('/en', '') || '/');
      }
    }
  };

  const setTurkish = () => {
    if (language !== 'tr') {
      const currentPath = location.pathname;
      if (currentPath.startsWith('/en')) {
        navigate(currentPath.replace('/en', '') || '/');
      }
    }
  };

  const setEnglish = () => {
    if (language !== 'en') {
      const currentPath = location.pathname;
      if (!currentPath.startsWith('/en')) {
        navigate('/en' + currentPath);
      }
    }
  };

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
