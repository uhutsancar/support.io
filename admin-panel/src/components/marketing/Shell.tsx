/**
 * Pazarlama sayfalarının ortak kabuğu.
 *
 * Önceden her sayfa (Home, Features, Pricing, About, Docs) kendi header ve
 * footer'ını taşıyordu; dördü de birbirinden farklı yükseklikte, farklı buton
 * biçiminde ve farklı footer içeriğindeydi. Aynı siteye ait olmadıkları
 * hissini veren asıl şey buydu. Artık tek kaynak var.
 *
 * Üst menüdeki "Ürün" açılırı özellik kataloğundan üretilir. Elle yazılmış bir
 * liste, katalog büyüdüğünde sessizce eksik kalırdı.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Menu, X, Moon, Sun, Languages, ChevronDown, MessageSquare, Code2, GitBranch,
  Zap, Send, BookOpen, BarChart3, Users, Sparkles, Eye, Briefcase, ArrowRight
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import Logo, { LogoMark } from '../Logo';
import { Button, AccentIcon, accent } from './kit';
import { FEATURE_GROUPS, FEATURE_ICON, FEATURE_TONE } from '../../pages/marketing/features';

const ICONS = {
  MessageSquare, Code2, GitBranch, Zap, Send, BookOpen, BarChart3, Users, Sparkles, Eye, Briefcase
};

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
    login: langPrefix + '/login',
    register: langPrefix + '/register',
    dashboard: langPrefix + '/dashboard'
  };
}

/* ------------------------------------------------------- ürün açılır menüsü */

const ProductMenu = ({ routes, onNavigate }: { routes?: any; onNavigate?: (...args: any[]) => void; [prop: string]: any }) => {
  const { t } = useTranslation();
  return (
    <div className="grid sm:grid-cols-3 gap-x-6 gap-y-5 p-5">
      {FEATURE_GROUPS.map((group) => (
        <div key={group.id}>
          <p className="px-2 text-[10.5px] font-semibold uppercase tracking-[0.09em]
            text-gray-400 dark:text-gray-500">
            {t('nav.groups.' + group.id)}
          </p>
          <ul className="mt-2 space-y-0.5">
            {group.items.map((id) => {
              const Icon = ICONS[FEATURE_ICON[id as keyof typeof FEATURE_ICON] as keyof typeof ICONS] || MessageSquare;
              return (
                <li key={id}>
                  <Link
                    to={routes.features + '/' + id}
                    onClick={onNavigate}
                    className="flex items-start gap-2.5 px-2 py-2 rounded-lg
                      hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors group"
                  >
                    <AccentIcon icon={Icon} tone={FEATURE_TONE[id as keyof typeof FEATURE_TONE]} size="sm" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-gray-900 dark:text-white">
                        {t('featuresPage.items.' + id + '.title')}
                      </span>
                      <span className="block text-[11.5px] leading-snug text-gray-500 dark:text-gray-400
                        line-clamp-2">
                        {t('featuresPage.items.' + id + '.short')}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      <div className="sm:col-span-3 -mx-5 -mb-5 mt-1 px-5 py-3.5
        border-t border-gray-100 dark:border-white/[0.07] bg-gray-50/70 dark:bg-white/[0.02]">
        <Link
          to={routes.features}
          onClick={onNavigate}
          className="group inline-flex items-center gap-1.5 text-[13px] font-medium
            text-indigo-600 dark:text-indigo-400"
        >
          {t('nav.allFeatures')}
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ Header */

export const Header = () => {
  const [open, setOpen] = React.useState(false);
  const [productOpen, setProductOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const { isAuthenticated, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const routes = useMarketingRoutes();
  const productRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rota değişince menüler kapanır; aksi halde gezindikten sonra açık kalıyordu.
  React.useEffect(() => {
    setOpen(false);
    setProductOpen(false);
  }, [location.pathname]);

  // Sayfa kaydırılınca başlık zeminini koyulaştır: en tepede sınır çizgisi
  // gereksiz bir kutu çiziyordu, kaydırıldığında ise içerik başlığın altından
  // sınırsız geçiyordu.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Dışarı tıklama ve Esc ile kapanma — fare ile açılıp klavyeyle kapatılamayan
  // bir menü, klavye kullanıcısını sayfada kilitliyordu.
  React.useEffect(() => {
    if (!productOpen) return;
    const onDown = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) setProductOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setProductOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [productOpen]);

  React.useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(routes.home);
  };

  const links = [
    { to: routes.pricing, label: t('header.pricing') },
    { to: routes.docs, label: t('header.docs') },
    { to: routes.about, label: t('header.about') }
  ];

  const isActive = (path: string) => location.pathname === path;
  const navLink = (active: any) => [
    'relative px-3 py-2 rounded-lg text-[14px] transition-colors',
    active
      ? 'text-gray-900 dark:text-white font-medium'
      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/70 dark:hover:bg-white/[0.05]'
  ].join(' ');

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        scrolled
          ? 'border-b border-gray-200/80 dark:border-white/[0.07] bg-white/85 dark:bg-surface-dark/85 backdrop-blur-xl'
          : 'border-b border-transparent bg-white/60 dark:bg-surface-dark/60 backdrop-blur-md'
      ].join(' ')}
      role="banner"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="h-[68px] flex items-center gap-2">
          <Link to={routes.home} aria-label={t('header.goToHome')} className="shrink-0 mr-4">
            <Logo size={27} />
          </Link>

          <nav className="hidden lg:flex items-center gap-0.5" aria-label={t('header.mainNavigation')}>
            {/* ürün açılırı */}
            <div
              ref={productRef}
              className="relative"
              onMouseEnter={() => { if (closeTimer.current) clearTimeout(closeTimer.current); setProductOpen(true); }}
              onMouseLeave={() => { closeTimer.current = setTimeout(() => setProductOpen(false), 140); }}
            >
              <button
                onClick={() => setProductOpen((v) => !v)}
                aria-expanded={productOpen}
                aria-haspopup="true"
                className={[navLink(location.pathname.includes('features') || location.pathname.includes('ozellik')),
                  'inline-flex items-center gap-1'].join(' ')}
              >
                {t('header.features')}
                <ChevronDown className={[
                  'w-3.5 h-3.5 transition-transform duration-200',
                  productOpen ? 'rotate-180' : ''
                ].join(' ')} />
              </button>

              {productOpen && (
                <div className="absolute left-0 top-full pt-2.5">
                  <div className="w-[700px] rounded-2xl border border-gray-200 dark:border-white/[0.09]
                    bg-white dark:bg-[#12141f] shadow-panel-lg overflow-hidden animate-rise">
                    <ProductMenu routes={routes} onNavigate={() => setProductOpen(false)} />
                  </div>
                </div>
              )}
            </div>

            {links.map((link) => (
              <Link key={link.to} to={link.to} aria-current={isActive(link.to) ? 'page' : undefined}
                className={navLink(isActive(link.to))}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium
                text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
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
                hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
              aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
              title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
            >
              {isDark ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
            </button>

            <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-2" />

            {isAuthenticated ? (
              <>
                <Button to={routes.dashboard} variant="ghost" size="sm">{t('header.panel')}</Button>
                <Button as="button" onClick={handleLogout} variant="ghost" size="sm">{t('header.logout')}</Button>
              </>
            ) : (
              <>
                <Button to={routes.login} variant="ghost" size="sm">{t('header.login')}</Button>
                <Button to={routes.register} variant="primary" size="sm" className="ml-1">
                  {t('header.register')}
                </Button>
              </>
            )}
          </div>

          <button
            onClick={() => setOpen((o) => !o)}
            className="lg:hidden p-2 -mr-2 rounded-lg text-gray-700 dark:text-gray-300"
            aria-label={open ? t('header.closeMenu') : t('header.openMenu')}
            aria-expanded={open}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------- mobil menü */}
      {open && (
        <div className="lg:hidden border-t border-gray-200 dark:border-white/[0.07]
          bg-white dark:bg-surface-dark max-h-[calc(100vh-68px)] overflow-y-auto">
          <nav className="max-w-6xl mx-auto px-5 py-4">
            <p className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.09em]
              text-gray-400 dark:text-gray-500">
              {t('header.features')}
            </p>
            <div className="mt-2 grid sm:grid-cols-2 gap-1">
              {FEATURE_GROUPS.flatMap((g) => g.items).map((id) => {
                const Icon = ICONS[FEATURE_ICON[id as keyof typeof FEATURE_ICON] as keyof typeof ICONS] || MessageSquare;
                return (
                  <Link key={id} to={routes.features + '/' + id}
                    className="flex items-center gap-2.5 px-1 py-2 rounded-lg">
                    <AccentIcon icon={Icon} tone={FEATURE_TONE[id as keyof typeof FEATURE_TONE]} size="sm" />
                    <span className="text-[14px] text-gray-700 dark:text-gray-300">
                      {t('featuresPage.items.' + id + '.title')}
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.07] flex flex-col">
              <Link to={routes.features} className="py-2.5 text-[15px] font-medium text-gray-900 dark:text-white">
                {t('nav.allFeatures')}
              </Link>
              {links.map((link) => (
                <Link key={link.to} to={link.to} className="py-2.5 text-[15px] text-gray-700 dark:text-gray-300">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 py-3 mt-1 border-t border-gray-100 dark:border-white/[0.07]">
              <button
                onClick={toggleLanguage}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
                  border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
              >
                <Languages className="w-4 h-4" /> {language === 'tr' ? 'EN' : 'TR'}
              </button>
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium
                  border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 dark:border-white/[0.07]">
              {isAuthenticated ? (
                <>
                  <Button to={routes.dashboard} variant="secondary">{t('header.panel')}</Button>
                  <Button as="button" onClick={handleLogout} variant="ghost">{t('header.logout')}</Button>
                </>
              ) : (
                <>
                  <Button to={routes.login} variant="secondary">{t('header.login')}</Button>
                  <Button to={routes.register} variant="primary">{t('header.register')}</Button>
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
  const { language, toggleLanguage } = useLanguage();

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
      title: t('nav.groups.talk'),
      links: FEATURE_GROUPS[0].items.map((id) => ({
        label: t('featuresPage.items.' + id + '.title'),
        to: routes.features + '/' + id
      }))
    },
    {
      title: t('nav.groups.grow'),
      links: FEATURE_GROUPS[2].items.map((id) => ({
        label: t('featuresPage.items.' + id + '.title'),
        to: routes.features + '/' + id
      }))
    },
    {
      title: t('landing.home.footerCompany'),
      links: [
        { label: t('landing.home.footerAbout'), to: routes.about },
        { label: t('landing.home.footerLogin'), to: routes.login },
        { label: t('landing.home.footerRegister'), to: routes.register }
      ]
    }
  ];

  return (
    <footer className="border-t border-gray-200 dark:border-white/[0.07]
      bg-surface-subtle dark:bg-surface-darkSubtle px-5 sm:px-8 py-16">
      <div className="max-w-6xl mx-auto">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
          <div>
            <Logo size={27} />
            <p className="mt-4 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[34ch]">
              {t('landing.home.footerDesc')}
            </p>
            <button
              onClick={toggleLanguage}
              className="mt-5 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12.5px] font-medium
                border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-400
                hover:bg-white dark:hover:bg-white/[0.05] transition"
            >
              <Languages className="w-3.5 h-3.5" />
              {language === 'tr' ? 'Türkçe' : 'English'}
            </button>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-400 dark:text-gray-500">
                {column.title}
              </h3>
              <ul className="mt-3.5 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      to={link.to}
                      className="text-[13.5px] text-gray-600 dark:text-gray-400
                        hover:text-indigo-600 dark:hover:text-indigo-400 transition"
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
        <div className="mt-14 pt-6 border-t border-gray-200 dark:border-white/[0.07]
          flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-gray-500 dark:text-gray-500">
            © {new Date().getFullYear()} Support.io
          </p>
          <p className="text-[12.5px] text-gray-500 dark:text-gray-500">
            {t('landing.home.footerMade')}
          </p>
        </div>
      </div>
    </footer>
  );
};

/* ------------------------------------------------------------------- Shell */

const Shell = ({ children }: { children?: any; [prop: string]: any }) => {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100">
      <a href="#main" className="skip-link px-3 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-medium">
        {t('common.skipToContent')}
      </a>
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </div>
  );
};

export default Shell;

/* ------------------------------------------------------- ortak parçacıklar */

/**
 * Alt sayfaların (Özellikler, Fiyatlandırma, Hakkımızda) giriş bloğu.
 * Ana sayfa kendi hero'sunu kurar; buradaki daha sakin ve tek sütunludur.
 */
export const PageHero = ({ eyebrow, eyebrowTone = 'indigo', title, description, children, align = 'left' }: { eyebrow?: any; title?: any; description?: any; children?: any; [prop: string]: any }) => {
  const a = accent(eyebrowTone);
  return (
    // Zemin düz. Burada başlığın arkasında büyük, bulanık mor bir parıltı
    // vardı; sayfanın söylediği hiçbir şeye katkısı yoktu ve her alt sayfayı
    // aynı hazır şablondan çıkmış gibi gösteriyordu.
    <section className="pt-32 pb-16 sm:pt-40 sm:pb-20 px-5 sm:px-8">
      <div className={['max-w-6xl mx-auto', align === 'center' ? 'text-center' : ''].join(' ')}>
        {eyebrow && (
          <span className={[
            'block text-[12px] font-semibold uppercase tracking-[0.1em]', a.text
          ].join(' ')}>
            {eyebrow}
          </span>
        )}
        <h1 className={[
          'mt-4 text-[36px] sm:text-[52px] font-semibold tracking-[-0.035em] leading-[1.06]',
          'text-gray-900 dark:text-white',
          align === 'center' ? 'mx-auto max-w-[20ch]' : 'max-w-[20ch]'
        ].join(' ')}>
          {title}
        </h1>
        {description && (
          <p className={[
            'mt-5 text-[17.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[58ch]',
            align === 'center' ? 'mx-auto' : ''
          ].join(' ')}>
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
};

/** Eski API ile uyum: Docs ve birkaç sayfa hâlâ bu adla içe aktarıyor. */
export const Section = ({ title, description, children, bordered = true, id }: { title?: any; description?: any; children?: any; id?: string; [prop: string]: any }) => (
  <section
    id={id}
    className={[
      'py-20 px-5 sm:px-8',
      bordered ? 'border-b border-gray-200 dark:border-white/[0.07]' : ''
    ].join(' ')}
  >
    <div className="max-w-6xl mx-auto">
      {title && (
        <h2 className="text-[28px] sm:text-[33px] font-semibold tracking-[-0.028em] text-gray-900 dark:text-white">
          {title}
        </h2>
      )}
      {description && (
        <p className="mt-3.5 text-[16px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[60ch]">
          {description}
        </p>
      )}
      {children}
    </div>
  </section>
);

export { LogoMark };
