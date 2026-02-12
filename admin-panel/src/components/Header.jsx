import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, X, Globe } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTranslation } from 'react-i18next';
import logo from '../public/support.io_logo.webp';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { isAuthenticated, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate(routes.home);
  };

  // Dile göre URL prefix
  const langPrefix = language === 'en' ? '/en' : '';
  
  // Dile göre route'lar
  const routes = {
    home: langPrefix || '/',
    features: language === 'en' ? '/en/features' : '/ozellikler',
    pricing: language === 'en' ? '/en/pricing' : '/fiyatlandirma',
    docs: language === 'en' ? '/en/documentation' : '/dokumantasyon',
    about: language === 'en' ? '/en/about' : '/hakkimizda',
    login: `${langPrefix}/login`,
    register: `${langPrefix}/register`,
    dashboard: `${langPrefix}/dashboard`
  };

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-50 transition-colors duration-200" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to={routes.home} className="flex items-center" aria-label={t('header.goToHome')}>
            <img src={logo} alt="Support.io Logo" style={{ height: '9rem', width: 'auto', maxWidth: '100%' }} />
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8" aria-label={t('header.mainNavigation')}>
            <Link to={routes.features} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200">
              {t('header.features')}
            </Link>
            <Link to={routes.pricing} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200">
              {t('header.pricing')}
            </Link>
            <Link to={routes.docs} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200">
              {t('header.docs')}
            </Link>
            <Link to={routes.about} className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200">
              {t('header.about')}
            </Link>
            
            {/* Language Toggle */}
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
              aria-label={t('header.switchLanguage')}
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm font-semibold">{language.toUpperCase()}</span>
            </button>
            
            {isAuthenticated ? (
              <>
                <Link 
                  to={routes.dashboard} 
                  className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
                  aria-label={t('header.goToDashboard')}
                >
                  {t('header.panel')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200"
                  aria-label={t('header.logoutAccount')}
                >
                  {t('header.logout')}
                </button>
              </>
            ) : (
              <>
                <Link 
                  to={routes.login} 
                  className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
                  aria-label={t('header.loginAccount')}
                >
                  {t('header.login')}
                </Link>
                <Link 
                  to={routes.register} 
                  className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors duration-200"
                  aria-label={t('header.createAccount')}
                >
                  {t('header.register')}
                </Link>
              </>
            )}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
            aria-label={isMenuOpen ? t('header.closeMenu') : t('header.openMenu')}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" aria-hidden="true" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700 dark:text-gray-300" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div id="mobile-menu" className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700 transition-colors duration-200">
            <nav className="flex flex-col space-y-4" aria-label={t('header.mobileMenu')}>
              <Link 
                to={routes.features} 
                className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('header.features')}
              </Link>
              <Link 
                to={routes.pricing} 
                className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('header.pricing')}
              </Link>
              <Link 
                to={routes.docs} 
                className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('header.docs')}
              </Link>
              <Link 
                to={routes.about} 
                className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
                onClick={() => setIsMenuOpen(false)}
              >
                {t('header.about')}
              </Link>
              
              {/* Language Toggle Mobile */}
              <button
                onClick={() => {
                  toggleLanguage();
                  setIsMenuOpen(false);
                }}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200 text-left"
              >
                <Globe className="w-4 h-4" />
                <span>{language === 'tr' ? 'Switch to English' : 'Türkçe\'ye Geç'}</span>
              </button>
              
              {isAuthenticated ? (
                <>
                  <Link 
                    to={routes.dashboard} 
                    className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('header.panel')}
                  </Link>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 px-4 py-2 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors duration-200 text-left"
                  >
                    {t('header.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link 
                    to={routes.login} 
                    className="text-gray-700 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors duration-200"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('header.login')}
                  </Link>
                  <Link 
                    to={routes.register} 
                    className="bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-colors duration-200 text-center"
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {t('header.register')}
                  </Link>
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
