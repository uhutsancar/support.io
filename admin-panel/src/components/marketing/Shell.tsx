/**
 * Pazarlama sayfalarının ortak kabuğu: üst menü, alt bilgi, sitenin kendi
 * sohbet balonu ve hareket tercihi.
 *
 * Üst menünün açılırları Radix NavigationMenu'dür: klavyeyle gezilir, Esc ile
 * kapanır, fare menüden çıkınca kısa bir gecikmeyle kapanır, açık panel
 * içeriğe göre boyut değiştirir. Bunların hiçbiri burada elle yazılmaz.
 *
 * Sürüm 1.2.14'e sabittir: sonraki sürümler `forwardRef`i kaldırıp React 19
 * varsayıyor ve bu projedeki React 18'de her açılışta ref uyarısı veriyor.
 * React 19'a geçildiğinde sabitleme kaldırılabilir.
 *
 * "Ürün" açılırı özellik kataloğundan, "Çözümler" sektör listesinden üretilir;
 * elle yazılmış bir liste katalog büyüdüğünde sessizce eksik kalırdı.
 */

import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MotionConfig, motion } from 'motion/react';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import {
  Menu,
  X,
  Moon,
  Sun,
  Languages,
  ChevronDown,
  MessageSquare,
  Code2,
  GitBranch,
  Zap,
  Send,
  BookOpen,
  BarChart3,
  Users,
  Sparkles,
  Eye,
  Briefcase,
  ArrowRight,
  Store,
  Rocket,
  Stethoscope,
  BedDouble,
  GraduationCap,
  Building2,
  LifeBuoy,
  Mail
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useTheme } from '../../contexts/ThemeContext';
import Logo, { LogoMark } from '../Logo';
import { Button, AccentIcon, accent } from './kit';
import { FEATURE_VISUAL, WidgetVisual } from './visuals';
import { marketingRoutes } from '../../lib/marketingPaths';
import { useSiteChat, openSiteChat } from './siteChat';
import {
  FEATURE_GROUPS,
  FEATURE_ICON,
  FEATURE_TONE,
  SOLUTIONS
} from '../../pages/marketing/features';

export const FEATURE_ICONS: Record<string, React.ElementType> = {
  MessageSquare,
  Code2,
  GitBranch,
  Zap,
  Send,
  BookOpen,
  BarChart3,
  Users,
  Sparkles,
  Eye,
  Briefcase
};

export const SOLUTION_ICONS: Record<string, React.ElementType> = {
  Store,
  Rocket,
  Briefcase,
  Stethoscope,
  BedDouble,
  GraduationCap
};

export const featureIcon = (id: string): React.ElementType =>
  FEATURE_ICONS[FEATURE_ICON[id as keyof typeof FEATURE_ICON]] || MessageSquare;

export function useMarketingRoutes() {
  const { language } = useLanguage();
  return marketingRoutes(language);
}

type Routes = ReturnType<typeof marketingRoutes>;

/* ------------------------------------------------------- ürün açılır menüsü */

const ALL_FEATURES = FEATURE_GROUPS.flatMap((g) => g.items);

/**
 * Solda özellik listesi, sağda üzerine gelinen özelliğin panelden bir
 * kesiti. Ziyaretçi menüden çıkmadan "bu ne işe yarıyor" sorusunun cevabını
 * görür.
 */
const ProductMenu = ({ routes }: { routes: Routes }) => {
  const { t } = useTranslation();
  const [hovered, setHovered] = React.useState(ALL_FEATURES[0]);
  const Visual = FEATURE_VISUAL[hovered as keyof typeof FEATURE_VISUAL];
  const tone = FEATURE_TONE[hovered as keyof typeof FEATURE_TONE];

  return (
    <div className="grid grid-cols-[250px_minmax(0,1fr)] w-[760px]">
      <div className="p-3 border-r border-gray-100 dark:border-white/[0.07]">
        <p className="px-2.5 pt-1.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
          {t('nav.product')}
        </p>
        <ul>
          {ALL_FEATURES.map((id) => {
            const Icon = featureIcon(id);
            const on = id === hovered;
            return (
              <li key={id}>
                <NavigationMenu.Link asChild>
                  <Link
                    to={routes.features + '/' + id}
                    onMouseEnter={() => setHovered(id)}
                    onFocus={() => setHovered(id)}
                    className={[
                      'flex items-center gap-2.5 px-2.5 py-[7px] rounded-lg text-[13.5px] transition-colors',
                      on
                        ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.04]'
                    ].join(' ')}
                  >
                    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.8} />
                    <span className="flex-1 truncate">
                      {t('featuresPage.items.' + id + '.title')}
                    </span>
                    {on && <ArrowRight className="w-3.5 h-3.5 shrink-0" />}
                  </Link>
                </NavigationMenu.Link>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="p-5 bg-gradient-to-b from-[#f4f5ff] to-white dark:from-white/[0.03] dark:to-transparent flex flex-col">
        {/*
          Görseller ~520px genişlik için çizildi; panele sığması için
          ölçeklenir. Ölçek ve giriş hareketi aynı `transform`u paylaştığı için
          ikisi de motion'a verilir — CSS keyframe'i ölçeği eziyordu.
        */}
        <div className="relative h-[292px] overflow-hidden rounded-xl">
          <motion.div
            key={hovered}
            initial={{ opacity: 0, y: 8, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 0.82 }}
            transition={{ duration: 0.25 }}
            className="absolute left-0 top-0 w-[560px] origin-top-left"
          >
            {Visual === WidgetVisual ? (
              <div className="flex justify-center pt-2">
                <WidgetVisual launcher={false} />
              </div>
            ) : Visual ? (
              <div className="rounded-2xl border border-gray-200 dark:border-white/[0.09] bg-white dark:bg-[#12141f] shadow-panel overflow-hidden">
                <Visual />
              </div>
            ) : null}
          </motion.div>
        </div>
        <p className="mt-4 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
          <span className={['font-semibold', accent(tone).text].join(' ')}>
            {t('featuresPage.items.' + hovered + '.title')}
          </span>{' '}
          — {t('featuresPage.items.' + hovered + '.short')}
        </p>
        <NavigationMenu.Link asChild>
          <Link
            to={routes.features}
            className="group mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-indigo-600 dark:text-indigo-400"
          >
            {t('nav.allFeatures')}
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </NavigationMenu.Link>
      </div>
    </div>
  );
};

/* ---------------------------------------------------- çözümler açılır menüsü */

const SolutionsMenu = ({ routes }: { routes: Routes }) => {
  const { t } = useTranslation();
  return (
    <div className="w-[640px] p-3">
      <p className="px-2.5 pt-1.5 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
        {t('nav.solutions')}
      </p>
      <ul className="grid grid-cols-2 gap-1">
        {SOLUTIONS.map((s) => (
          <li key={s.id}>
            <NavigationMenu.Link asChild>
              <Link
                to={routes.solutions + '/' + s.id}
                className="group flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <img
                  src={s.photo}
                  alt=""
                  loading="lazy"
                  className="w-[68px] h-[50px] rounded-lg object-cover shrink-0"
                />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {t('solutions.items.' + s.id + '.name')}
                  </span>
                  <span className="block text-[12px] leading-snug text-gray-500 dark:text-gray-400 line-clamp-2">
                    {t('solutions.items.' + s.id + '.tag')}
                  </span>
                </span>
              </Link>
            </NavigationMenu.Link>
          </li>
        ))}
      </ul>
    </div>
  );
};

/* --------------------------------------------------- kaynaklar açılır menüsü */

const ResourcesMenu = ({ routes }: { routes: Routes }) => {
  const { t } = useTranslation();
  const items = [
    { to: routes.docs, icon: BookOpen, key: 'docs' },
    { to: routes.about, icon: Building2, key: 'about' }
  ];
  const itemClass =
    'flex items-start gap-3 p-2.5 rounded-xl text-left w-full hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors';
  const body = (key: string) => (
    <span className="min-w-0">
      <span className="block text-[13.5px] font-semibold text-gray-900 dark:text-white">
        {t('nav.resources.' + key + '.title')}
      </span>
      <span className="block text-[12px] leading-snug text-gray-500 dark:text-gray-400">
        {t('nav.resources.' + key + '.body')}
      </span>
    </span>
  );
  return (
    <ul className="w-[320px] p-2">
      {items.map((item) => (
        <li key={item.key}>
          <NavigationMenu.Link asChild>
            <Link to={item.to} className={itemClass}>
              <AccentIcon icon={item.icon} size="sm" className="mt-0.5" />
              {body(item.key)}
            </Link>
          </NavigationMenu.Link>
        </li>
      ))}
      <li>
        <NavigationMenu.Link asChild>
          <button
            type="button"
            className={itemClass}
            onClick={() => {
              if (!openSiteChat()) window.location.href = 'mailto:destek@support.io';
            }}
          >
            <AccentIcon icon={LifeBuoy} size="sm" tone="emerald" className="mt-0.5" />
            {body('contact')}
          </button>
        </NavigationMenu.Link>
      </li>
    </ul>
  );
};

/* ------------------------------------------------------------------ Header */

const triggerClass = (active: boolean) =>
  [
    'group inline-flex items-center gap-1 px-3 py-2 rounded-full text-[14px] transition-colors',
    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
    'data-[state=open]:bg-gray-100 dark:data-[state=open]:bg-white/[0.07]',
    active
      ? 'text-gray-950 dark:text-white font-semibold'
      : 'text-gray-600 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white'
  ].join(' ');

/**
 * Radix ölçüyü içerikten alır: içerik mutlak konumlu ve kendi genişliğinde
 * olmalı, yoksa viewport'un genişliğine yayılır ve dar bir panel (Kaynaklar)
 * önceki geniş panelin boyunda kalır.
 */
const CONTENT_CLASS = 'absolute left-0 top-0 w-auto';

const Chevron = () => (
  <ChevronDown
    className="w-3.5 h-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
    aria-hidden="true"
  />
);

export const Header = ({ overDark = false }: { overDark?: boolean }) => {
  // Mobil menü açıldığı sayfaya bağlıdır: gezinince kendiliğinden kapanır,
  // bunun için rota değişimini izleyen ayrı bir efekt gerekmez.
  const location = useLocation();
  const [openOn, setOpenOn] = React.useState<string | null>(null);
  const open = openOn === location.pathname;
  const setOpen = (next: boolean | ((was: boolean) => boolean)) =>
    setOpenOn((typeof next === 'function' ? next(open) : next) ? location.pathname : null);
  const [scrolled, setScrolled] = React.useState(false);
  const { isAuthenticated, logout } = useAuth();
  const { language, toggleLanguage } = useLanguage();
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const routes = useMarketingRoutes();

  // Tepede başlık zeminsiz durur ve sayfanın ilk bölümüyle birleşir;
  // kaydırılınca zemin ve alt çizgi gelir.
  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate(routes.home);
  };

  const at = (prefix: string) => location.pathname.startsWith(prefix);

  const solid = scrolled || open;

  return (
    <header
      className={[
        'fixed inset-x-0 top-0 z-50 transition-all duration-300',
        // Koyu bir hero'nun üstündeyken başlık zeminsizdir; yazıların okunması
        // için koyu tema sınıfları o an başlığa uygulanır.
        overDark && !solid ? 'dark' : '',
        solid
          ? 'border-b border-gray-200/80 dark:border-white/[0.07] bg-white/85 dark:bg-surface-dark/85 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      ].join(' ')}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="h-[72px] flex items-center gap-2">
          <Link to={routes.home} aria-label={t('header.goToHome')} className="shrink-0 mr-5">
            <Logo size={28} />
          </Link>

          <NavigationMenu.Root
            className="hidden lg:block relative"
            delayDuration={60}
            aria-label={t('header.mainNavigation')}
          >
            <NavigationMenu.List className="flex items-center gap-0.5">
              <NavigationMenu.Item>
                <NavigationMenu.Trigger className={triggerClass(at(routes.features))}>
                  {t('nav.product')} <Chevron />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className={CONTENT_CLASS}>
                  <ProductMenu routes={routes} />
                </NavigationMenu.Content>
              </NavigationMenu.Item>

              <NavigationMenu.Item>
                <NavigationMenu.Trigger className={triggerClass(at(routes.solutions))}>
                  {t('nav.solutions')} <Chevron />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className={CONTENT_CLASS}>
                  <SolutionsMenu routes={routes} />
                </NavigationMenu.Content>
              </NavigationMenu.Item>

              <NavigationMenu.Item>
                <NavigationMenu.Link asChild active={at(routes.ai)}>
                  <Link to={routes.ai} className={triggerClass(at(routes.ai))}>
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" aria-hidden="true" />
                    {t('nav.ai')}
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>

              <NavigationMenu.Item>
                <NavigationMenu.Link asChild active={at(routes.pricing)}>
                  <Link to={routes.pricing} className={triggerClass(at(routes.pricing))}>
                    {t('header.pricing')}
                  </Link>
                </NavigationMenu.Link>
              </NavigationMenu.Item>

              <NavigationMenu.Item>
                <NavigationMenu.Trigger
                  className={triggerClass(at(routes.docs) || at(routes.about))}
                >
                  {t('nav.resourcesLabel')} <Chevron />
                </NavigationMenu.Trigger>
                <NavigationMenu.Content className={CONTENT_CLASS}>
                  <ResourcesMenu routes={routes} />
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            </NavigationMenu.List>

            <div className="absolute left-0 top-full pt-3">
              <NavigationMenu.Viewport
                className="nav-viewport relative overflow-hidden rounded-2xl border border-gray-200/90
                dark:border-white/[0.09] bg-white dark:bg-[#12141f] shadow-panel-lg
                data-[state=open]:animate-rise"
              />
            </div>
          </NavigationMenu.Root>

          <div className="flex-1" />

          <div className="hidden lg:flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-full text-[12.5px] font-semibold
                text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
              aria-label={t('header.switchLanguage')}
            >
              <Languages className="w-[17px] h-[17px]" />
              <span className="uppercase">{language === 'tr' ? 'EN' : 'TR'}</span>
            </button>

            {/* İkon geçilecek temayı gösterir. */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-full text-gray-600 dark:text-gray-400
                hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
              aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
              title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
            >
              {isDark ? <Sun className="w-[17px] h-[17px]" /> : <Moon className="w-[17px] h-[17px]" />}
            </button>

            <span className="w-px h-5 bg-gray-200 dark:bg-white/10 mx-2" />

            {isAuthenticated ? (
              <>
                <Button as="button" onClick={handleLogout} variant="ghost" size="sm">
                  {t('header.logout')}
                </Button>
                <Button to={routes.dashboard} size="sm" className="ml-1" arrow>
                  {t('header.panel')}
                </Button>
              </>
            ) : (
              <>
                <Button to={routes.login} variant="ghost" size="sm">
                  {t('header.login')}
                </Button>
                <Button to={routes.register} size="sm" className="ml-1">
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
        <div className="lg:hidden border-t border-gray-200 dark:border-white/[0.07] bg-white dark:bg-surface-dark max-h-[calc(100vh-72px)] overflow-y-auto">
          <nav className="max-w-6xl mx-auto px-5 py-4" aria-label={t('header.mainNavigation')}>
            <MobileGroup title={t('nav.product')}>
              {ALL_FEATURES.map((id) => {
                const Icon = featureIcon(id);
                return (
                  <Link key={id} to={routes.features + '/' + id} className="flex items-center gap-2.5 px-1 py-2 rounded-lg">
                    <AccentIcon icon={Icon} tone={FEATURE_TONE[id as keyof typeof FEATURE_TONE]} size="sm" />
                    <span className="text-[14px] text-gray-700 dark:text-gray-300">
                      {t('featuresPage.items.' + id + '.title')}
                    </span>
                  </Link>
                );
              })}
            </MobileGroup>

            <MobileGroup title={t('nav.solutions')}>
              {SOLUTIONS.map((s) => (
                <Link key={s.id} to={routes.solutions + '/' + s.id} className="flex items-center gap-2.5 px-1 py-2 rounded-lg">
                  <img src={s.photo} alt="" className="w-9 h-7 rounded-md object-cover" />
                  <span className="text-[14px] text-gray-700 dark:text-gray-300">
                    {t('solutions.items.' + s.id + '.name')}
                  </span>
                </Link>
              ))}
            </MobileGroup>

            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/[0.07] flex flex-col">
              {[
                { to: routes.ai, label: t('nav.ai') },
                { to: routes.pricing, label: t('header.pricing') },
                { to: routes.docs, label: t('header.docs') },
                { to: routes.about, label: t('header.about') }
              ].map((link) => (
                <Link key={link.to} to={link.to} className="py-2.5 text-[15px] font-medium text-gray-800 dark:text-gray-200">
                  {link.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-2 py-3 mt-1 border-t border-gray-100 dark:border-white/[0.07]">
              <button
                onClick={toggleLanguage}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
              >
                <Languages className="w-4 h-4" /> {language === 'tr' ? 'EN' : 'TR'}
              </button>
              <button
                onClick={toggleTheme}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[13px] font-medium border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                {isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-3 border-t border-gray-100 dark:border-white/[0.07]">
              {isAuthenticated ? (
                <>
                  <Button to={routes.dashboard}>{t('header.panel')}</Button>
                  <Button as="button" onClick={handleLogout} variant="secondary">
                    {t('header.logout')}
                  </Button>
                </>
              ) : (
                <>
                  <Button to={routes.register}>{t('header.register')}</Button>
                  <Button to={routes.login} variant="secondary">
                    {t('header.login')}
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

const MobileGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-3">
    <p className="px-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gray-400 dark:text-gray-500">
      {title}
    </p>
    <div className="mt-1.5 grid sm:grid-cols-2 gap-0.5">{children}</div>
  </div>
);

/* ------------------------------------------------------------------ Footer */

export const Footer = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();
  const { language, toggleLanguage } = useLanguage();

  const columns = [
    {
      title: t('nav.product'),
      links: [
        { label: t('landing.home.footerFeatures'), to: routes.features },
        ...FEATURE_GROUPS[0].items.slice(0, 3).map((id) => ({
          label: t('featuresPage.items.' + id + '.title'),
          to: routes.features + '/' + id
        })),
        { label: t('nav.ai'), to: routes.ai },
        { label: t('landing.home.footerPricing'), to: routes.pricing }
      ]
    },
    {
      title: t('nav.solutions'),
      links: SOLUTIONS.map((s) => ({
        label: t('solutions.items.' + s.id + '.name'),
        to: routes.solutions + '/' + s.id
      }))
    },
    {
      title: t('nav.resourcesLabel'),
      links: [
        { label: t('landing.home.footerDocs'), to: routes.docs },
        { label: t('landing.home.footerAbout'), to: routes.about }
      ]
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
    <footer className="bg-[#0b0d17] text-gray-300 px-5 sm:px-8 pt-20 pb-10">
      <div className="max-w-7xl mx-auto">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]">
          <div>
            <span className="inline-flex items-center gap-2.5">
              <LogoMark size={30} />
              <span className="text-[18px] font-semibold tracking-[-0.02em] text-white">
                Support<span className="text-indigo-400">.io</span>
              </span>
            </span>
            <p className="mt-5 text-[14px] leading-relaxed text-gray-400 max-w-[34ch]">
              {t('landing.home.footerDesc')}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                onClick={toggleLanguage}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium
                  border border-white/15 text-gray-300 hover:bg-white/[0.06] transition"
              >
                <Languages className="w-3.5 h-3.5" />
                {language === 'tr' ? 'Türkçe' : 'English'}
              </button>
              <a
                href="mailto:destek@support.io"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-medium
                  border border-white/15 text-gray-300 hover:bg-white/[0.06] transition"
              >
                <Mail className="w-3.5 h-3.5" /> destek@support.io
              </a>
            </div>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
                {column.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.to + link.label}>
                    <Link
                      to={link.to}
                      className="text-[13.5px] text-gray-400 hover:text-white transition"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-6 border-t border-white/[0.08] flex flex-wrap items-center justify-between gap-3">
          <p className="text-[12.5px] text-gray-500">© {new Date().getFullYear()} Support.io</p>
          <p className="text-[12.5px] text-gray-500">{t('landing.home.footerMade')}</p>
        </div>
      </div>
    </footer>
  );
};

/* ------------------------------------------------------------------- Shell */

const Shell = ({
  children,
  darkHero = false
}: {
  children?: React.ReactNode;
  /** The first section is dark; the header starts in its light-on-dark form. */
  darkHero?: boolean;
}) => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const location = useLocation();
  useSiteChat(language);

  // SPA'da yeni sayfaya geçince tarayıcı kaydırmayı sıfırlamaz; alttaki bir
  // bağlantıya tıklayan kişi yeni sayfanın ortasında açılıyordu.
  React.useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
  }, [location.pathname, location.hash]);

  return (
    // "Hareketi azalt" seçili sistemlerde kayma animasyonları kapanır, yalnızca
    // opaklık geçişi kalır.
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-white dark:bg-surface-dark text-gray-900 dark:text-gray-100">
        <a
          href="#main"
          className="skip-link px-3 py-2 rounded-lg bg-indigo-600 text-white text-[13px] font-medium"
        >
          {t('common.skipToContent')}
        </a>
        <Header overDark={darkHero} />
        <main id="main">{children}</main>
        <Footer />
      </div>
    </MotionConfig>
  );
};

export default Shell;

/* ------------------------------------------------------- ortak parçacıklar */

/**
 * Alt sayfaların giriş bloğu. Zemin sayfanın ilk bölümüyle aynı açık
 * degradedir; başlık ortalanabilir ya da sola yaslanır.
 */
export const PageHero = ({
  eyebrow,
  eyebrowTone = 'indigo',
  title,
  description,
  children,
  align = 'left'
}: {
  eyebrow?: React.ReactNode;
  eyebrowTone?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  align?: 'left' | 'center';
}) => {
  const a = accent(eyebrowTone);
  return (
    <section className="pt-36 pb-16 sm:pt-44 sm:pb-20 px-5 sm:px-8 bg-gradient-to-b from-[#f1f2ff] via-[#f7f6ff] to-white dark:from-[#10122a] dark:via-surface-dark dark:to-surface-dark">
      <div className={['max-w-6xl mx-auto', align === 'center' ? 'text-center' : ''].join(' ')}>
        {eyebrow && (
          <span
            className={['block text-[11.5px] font-semibold uppercase tracking-[0.16em]', a.text].join(' ')}
          >
            {eyebrow}
          </span>
        )}
        <h1
          className={[
            'mt-4 text-[38px] sm:text-[58px] font-bold tracking-[-0.04em] leading-[1.03]',
            'text-gray-950 dark:text-white text-balance',
            align === 'center' ? 'mx-auto max-w-[18ch]' : 'max-w-[18ch]'
          ].join(' ')}
        >
          {title}
        </h1>
        {description && (
          <p
            className={[
              'mt-6 text-[17.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[58ch] text-pretty',
              align === 'center' ? 'mx-auto' : ''
            ].join(' ')}
          >
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
};

export { LogoMark };
