import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, Moon, Sun, Languages } from 'lucide-react';

import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import Logo from '../Logo';

/**
 * Pazarlama sayfalarının ortak kabuğu.
 *
 * Önceden her sayfa (Home, Features, Pricing, About, Docs) kendi header ve
 * footer'ını taşıyordu; dördü de birbirinden farklı yükseklikte, farklı buton
 * biçiminde ve farklı footer içeriğindeydi. Aynı siteye ait olmadıkları
 * hissini veren asıl şey buydu. Artık tek kaynak var.
 */

export function useMarketingRoutes() {
  const { language } = useLanguage();
  const langPrefix = language === 'en' ? '/en' : '';
  return {
    langPrefix,
    home: langPrefix || '/',
    features: language === 'en' ? '/en/features' : '/ozellikler',
    pricing: language === 'en' ? '/en/pricing' : '/fiyatlandirma',
    docs: language === 'en' ? '/en/documentation' : '/dokumantasyon',
    about: language === 'en' ? '/en/about' : '/hakkimizda',
    login: `${langPrefix}/login`,
    register: `${langPrefix}/register`,
    dashboard: `${langPrefix}/dashboard`
  };
}

/* ------------------------------------------------------------------ Header */

export const Header = () => {
  const [open, setOpen] = React.useState(false);
  const { isAuthenticated, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const routes = useMarketingRoutes();

  // Rota değişince mobil menü kapanır; aksi halde gezindikten sonra açık kalıyordu.
  React.useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate(routes.home);
  };

  const links = [
    { to: routes.features, label: t('header.features') },
    { to: routes.pricing, label: t('header.pricing') },
    { to: routes.docs, label: t('header.docs') },
    { to: routes.about, label: t('header.about') }
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 border-b border-gray-200/80 dark:border-gray-800/80
        bg-white/85 dark:bg-gray-950/85 backdrop-blur-md"
      role="banner"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="h-16 flex items-center gap-8">
          <Link to={routes.home} aria-label={t('header.goToHome')} className="shrink-0">
            <Logo size={26} />
          </Link>

          <nav className="hidden md:flex items-center gap-7" aria-label={t('header.mainNavigation')}>
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                aria-current={isActive(link.to) ? 'page' : undefined}
                className={`relative text-[14px] transition-colors
                  ${isActive(link.to)
                    ? 'text-gray-900 dark:text-white font-medium'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
              >
                {link.label}
                {isActive(link.to) && (
                  <span className="absolute -bottom-[21px] inset-x-0 h-px bg-gray-900 dark:bg-white" />
                )}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium
                text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900 transition"
              aria-label={t('header.switchLanguage')}
            >
              <Languages className="w-[17px] h-[17px]" />
              <span className="uppercase">{language === 'tr' ? 'EN' : 'TR'}</span>
            </button>

            {/*
              İkon "geçilecek" temayı gösterir. Eskiden koyu temadayken Ay
              çiziliyordu — yani zaten bulunduğunuz durumu gösteriyordu ve
              butonun ne yapacağı belirsizdi.
            */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400
                hover:bg-gray-100 dark:hover:bg-gray-900 transition"
              aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
              title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
            >
              {isDark ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
            </button>

            <span className="w-px h-5 bg-gray-200 dark:bg-gray-800 mx-2" />

            {isAuthenticated ? (
              <>
                <Link
                  to={routes.dashboard}
                  className="px-3 py-2 rounded-lg text-[14px] font-medium text-gray-600 dark:text-gray-400
                    hover:text-gray-900 dark:hover:text-white transition"
                >
                  {t('header.panel')}
                </Link>
                <button
                  onClick={handleLogout}
                  className="px-3 py-2 rounded-lg text-[14px] font-medium text-gray-600 dark:text-gray-400
                    hover:text-gray-900 dark:hover:text-white transition"
                >
                  {t('header.logout')}
                </button>
              </>
            ) : (
              <>
                <Link
                  to={routes.login}
                  className="px-3 py-2 rounded-lg text-[14px] font-medium text-gray-600 dark:text-gray-400
                    hover:text-gray-900 dark:hover:text-white transition"
                >
                  {t('header.login')}
                </Link>
                <Link
                  to={routes.register}
                  className="ml-1 px-4 py-2 rounded-lg text-[14px] font-medium
                    bg-gray-900 dark:bg-white text-white dark:text-gray-900
                    hover:bg-gray-800 dark:hover:bg-gray-100 transition"
                >
                  {t('header.register')}
                </Link>
              </>
            )}
          </div>

          <button
            onClick={() => setOpen((o) => !o)}
            className="md:hidden p-2 -mr-2 rounded-lg text-gray-700 dark:text-gray-300"
            aria-label={open ? t('header.closeMenu') : t('header.openMenu')}
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <nav className="max-w-6xl mx-auto px-5 py-4 flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="py-2.5 text-[15px] text-gray-700 dark:text-gray-300"
              >
                {link.label}
              </Link>
            ))}

            <div className="flex items-center gap-2 py-3 mt-1 border-t border-gray-100 dark:border-gray-900">
              <button
                onClick={toggleLanguage}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
                  border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
              >
                <Languages className="w-4 h-4" /> {language === 'tr' ? 'EN' : 'TR'}
              </button>
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
                  border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 dark:border-gray-900">
              {isAuthenticated ? (
                <>
                  <Link to={routes.dashboard} className="py-2.5 text-[15px] text-gray-700 dark:text-gray-300">
                    {t('header.panel')}
                  </Link>
                  <button onClick={handleLogout} className="py-2.5 text-left text-[15px] text-gray-700 dark:text-gray-300">
                    {t('header.logout')}
                  </button>
                </>
              ) : (
                <>
                  <Link to={routes.login} className="py-2.5 text-[15px] text-gray-700 dark:text-gray-300">
                    {t('header.login')}
                  </Link>
                  <Link
                    to={routes.register}
                    className="py-2.5 rounded-lg text-center text-[14.5px] font-medium
                      bg-gray-900 dark:bg-white text-white dark:text-gray-900"
                  >
                    {t('header.register')}
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

/* ------------------------------------------------------------------ Footer */

export const Footer = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();

  const columns = [
    {
      title: t('landing.home.footerProduct'),
      links: [
        { label: t('landing.home.footerFeatures'), to: routes.features },
        { label: t('landing.home.footerPricing'), to: routes.pricing },
        { label: t('landing.home.footerDocs'), to: routes.docs }
      ]
    },
    {
      title: t('landing.home.footerCompany'),
      links: [{ label: t('landing.home.footerAbout'), to: routes.about }]
    },
    {
      title: t('landing.home.footerSupport'),
      links: [
        { label: t('landing.home.footerLogin'), to: routes.login },
        { label: t('landing.home.footerRegister'), to: routes.register }
      ]
    }
  ];

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 px-5 sm:px-8 py-14">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo size={26} />
            <p className="mt-3.5 text-[13.5px] leading-relaxed text-gray-500 dark:text-gray-400 max-w-[36ch]">
              {t('landing.home.footerDesc')}
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {column.title}
              </h3>
              <ul className="mt-3.5 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-[13.5px] text-gray-600 dark:text-gray-400
                        hover:text-gray-900 dark:hover:text-white transition"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Yıl sabit değildi: eski metinlerde "© 2024" gömülüydü. */}
        <p className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-900 text-[12.5px]
          text-gray-400 dark:text-gray-500">
          © {new Date().getFullYear()} Support.io
        </p>
      </div>
    </footer>
  );
};

/* ------------------------------------------------------------------- Shell */

const Shell = ({ children }) => (
  <div className="min-h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <Header />
    <main>{children}</main>
    <Footer />
  </div>
);

export default Shell;

/* ------------------------------------------------------- ortak parçacıklar */

export const PageHero = ({ eyebrow, title, description, children }) => (
  <section className="pt-28 pb-14 sm:pt-36 sm:pb-20 px-5 sm:px-8 border-b border-gray-200 dark:border-gray-800">
    <div className="max-w-6xl mx-auto">
      {eyebrow && (
        <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11.5px]
          font-medium border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400">
          {eyebrow}
        </span>
      )}
      <h1 className="mt-5 text-[34px] sm:text-[46px] font-semibold tracking-[-0.03em]
        leading-[1.07] text-gray-900 dark:text-white max-w-[19ch]">
        {title}
      </h1>
      {description && (
        <p className="mt-5 text-[17px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[58ch]">
          {description}
        </p>
      )}
      {children}
    </div>
  </section>
);

export const Section = ({ title, description, children, bordered = true, id }) => (
  <section
    id={id}
    className={`py-20 px-5 sm:px-8 ${bordered ? 'border-b border-gray-200 dark:border-gray-800' : ''}`}
  >
    <div className="max-w-6xl mx-auto">
      {title && (
        <h2 className="text-[27px] sm:text-[31px] font-semibold tracking-[-0.025em] text-gray-900 dark:text-white">
          {title}
        </h2>
      )}
      {description && (
        <p className="mt-3 text-[15.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[58ch]">
          {description}
        </p>
      )}
      {children}
    </div>
  </section>
);
