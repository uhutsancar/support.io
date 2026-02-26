import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, Globe, Moon, Sun } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';
import logo from '../public/support.io_logo.webp';
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = React.useState(false);
  const { isAuthenticated, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = () => {
    logout();
    navigate(routes.home);
  };
  const langPrefix = language === 'en' ? '/en' : '';
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
  const isActive = (path) => location.pathname === path;
  return (
    <header className="fixed top-0 left-0 right-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md transition-all duration-300 border-b border-gray-200/50 dark:border-gray-800/50 shadow-sm" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to={routes.home} className="flex items-center" aria-label={t('header.goToHome')}>
            <img src={logo} alt="Support.io" className="h-8 w-auto dark:invert-0" />
          </Link>
          <nav className="hidden md:flex items-center space-x-8" aria-label={t('header.mainNavigation')}>
            <Link to={routes.features} className={`font-medium transition-colors duration-200 ${isActive(routes.features) ? 'text-indigo-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
              {t('header.features')}
            </Link>
            <Link to={routes.pricing} className={`font-medium transition-colors duration-200 ${isActive(routes.pricing) ? 'text-indigo-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
              {t('header.pricing')}
            </Link>
            <Link to={routes.docs} className={`font-medium transition-colors duration-200 ${isActive(routes.docs) ? 'text-indigo-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
              {t('header.docs')}
            </Link>
            <Link to={routes.about} className={`font-medium transition-colors duration-200 ${isActive(routes.about) ? 'text-indigo-600 dark:text-white' : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'}`}>
              {t('header.about')}
            </Link>
          </nav>
          <div className="hidden md:flex items-center space-x-6">
            <button
              onClick={toggleTheme}
              className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
              aria-label="Toggle theme"
            >
              {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleLanguage}
              className="flex items-center space-x-1 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
              aria-label={t('header.switchLanguage')}
            >
              <Globe className="w-4 h-4" />
              <span className="text-sm font-semibold">{language.toUpperCase()}</span>
            </button>
            {isAuthenticated ? (
              <>
                <Link
                  to={routes.dashboard}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors duration-200"
                >
                  {t('header.panel')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white font-medium transition-colors duration-200"
                >
                  {t('header.logout')}
                </button>
              </>
            ) : (
              <div className="flex items-center space-x-4">
                <Link
                  to={routes.login}
                  className="text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors duration-200"
                >
                  {t('header.login')}
                </Link>
                <Link
                  to={routes.register}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-[0_0_15px_rgba(99,102,241,0.5)] hover:shadow-[0_0_25px_rgba(99,102,241,0.6)]"
                >
                  {t('header.register') || 'Ücretsiz Başla'}
                </Link>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-lg text-gray-900 dark:text-white"
            aria-label={isMenuOpen ? t('header.closeMenu') : t('header.openMenu')}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {isMenuOpen && (
          <div className="md:hidden py-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 rounded-b-2xl px-4 absolute left-0 right-0 shadow-xl">
            <nav className="flex flex-col space-y-4">
              <Link to={routes.features} className="text-gray-900 dark:text-white font-medium" onClick={() => setIsMenuOpen(false)}>{t('header.features')}</Link>
              <Link to={routes.pricing} className="text-gray-900 dark:text-white font-medium" onClick={() => setIsMenuOpen(false)}>{t('header.pricing')}</Link>
              <Link to={routes.docs} className="text-gray-900 dark:text-white font-medium" onClick={() => setIsMenuOpen(false)}>{t('header.docs')}</Link>
              <Link to={routes.about} className="text-gray-900 dark:text-white font-medium" onClick={() => setIsMenuOpen(false)}>{t('header.about')}</Link>
              <div className="flex items-center space-x-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                <button onClick={() => { toggleTheme(); setIsMenuOpen(false); }} className="text-gray-900 dark:text-white">
                  {isDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
                <button onClick={() => { toggleLanguage(); setIsMenuOpen(false); }} className="flex items-center space-x-1 text-gray-900 dark:text-white">
                  <Globe className="w-4 h-4" />
                  <span className="font-semibold">{language.toUpperCase()}</span>
                </button>
              </div>
              <div className="flex flex-col space-y-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                {!isAuthenticated ? (
                  <>
                    <Link to={routes.login} className="text-center font-medium text-gray-900 dark:text-white" onClick={() => setIsMenuOpen(false)}>{t('header.login')}</Link>
                    <Link to={routes.register} className="bg-indigo-600 text-white px-4 py-2 rounded-full text-center font-semibold" onClick={() => setIsMenuOpen(false)}>{t('header.register') || 'Ücretsiz Başla'}</Link>
                  </>
                ) : (
                  <>
                    <Link to={routes.dashboard} className="text-center font-medium text-gray-900 dark:text-white" onClick={() => setIsMenuOpen(false)}>{t('header.panel')}</Link>
                    <button onClick={() => { handleLogout(); setIsMenuOpen(false); }} className="text-center font-medium text-gray-900 dark:text-white">{t('header.logout')}</button>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};
export default Header;
