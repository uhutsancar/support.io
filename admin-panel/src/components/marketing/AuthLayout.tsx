/**
 * Giriş ve kayıt ekranlarının ortak kabuğu.
 *
 * Eski iki sayfa da tam ekran indigo→mor→pembe bir gradyanın ortasında beyaz
 * bir kutuydu. Sitenin geri kalanında o gradyandan eser yoktu; kayıt olmaya
 * tıklayan kişi başka bir ürüne geçmiş gibi oluyordu. Ayrıca ikisinde de
 * açılış `<div>`inin hemen ardında kaçak bir `)` karakteri vardı ve sayfada
 * görünür biçimde basılıyordu.
 *
 * Yeni düzen iki sütun: solda form, sağda ürünün kendisi ve neye kayıt
 * olunduğunu söyleyen üç madde. Dar ekranda sağ sütun düşer, form tek başına
 * kalır — kayıt formunu doldurmak için önce pazarlama metni kaydırmak
 * gerekmez.
 */
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Moon, Sun, Languages } from 'lucide-react';
import Logo from '../Logo';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import ChatPlayer from './ChatPlayer';

const AuthLayout = ({
  title,
  subtitle,
  children,
  footer,
  side = 'register'
}: {
  title?: any;
  subtitle?: any;
  children?: any;
  footer?: any;
  [prop: string]: any;
}) => {
  const { t } = useTranslation();
  const { isDark, toggleTheme } = useTheme();
  const { language, toggleLanguage } = useLanguage();
  const home = language === 'en' ? '/en' : '/';

  const points = t('authPanel.' + side + '.points', { returnObjects: true });
  const list = Array.isArray(points) ? points : [];

  return (
    <div className="min-h-screen bg-white dark:bg-surface-dark lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ------------------------------------------------------------ form */}
      <div className="flex flex-col px-5 sm:px-10 py-6 sm:py-8">
        <div className="flex items-center justify-between gap-3">
          <Link to={home} aria-label={t('header.goToHome')}>
            <Logo size={26} />
          </Link>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleLanguage}
              className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[12.5px] font-medium
                text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
              aria-label={t('header.switchLanguage')}
            >
              <Languages className="w-4 h-4" />
              <span className="uppercase">{language === 'tr' ? 'EN' : 'TR'}</span>
            </button>
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-gray-600 dark:text-gray-400
                hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
              aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center py-10 sm:py-14">
          <div className="w-full max-w-[400px]">
            <h1
              className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em]
              text-gray-900 dark:text-white"
            >
              {title}
            </h1>
            <p className="mt-2.5 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
              {subtitle}
            </p>

            <div className="mt-8">{children}</div>

            {footer && (
              <div className="mt-7 pt-6 border-t border-gray-100 dark:border-white/[0.07] text-center">
                {footer}
              </div>
            )}
          </div>
        </div>

        <Link
          to={home}
          className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-gray-400
            hover:text-gray-900 dark:hover:text-white transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> {t('authPanel.backHome')}
        </Link>
      </div>

      {/* --------------------------------------------------------- yan panel */}
      {/*
        Fotoğraf + ürünün kendisi: ekranın bir yanında cevap veren kişi, önünde
        ziyaretçinin gördüğü balon kendi kendine konuşur. Neye kayıt olunduğu
        soyut bir madde listesinden daha iyi anlaşılır.
      */}
      <div className="hidden lg:block p-3">
        <div className="relative h-full min-h-[640px] overflow-hidden rounded-[28px]">
          <img
            src="/photos/agent-woman.webp"
            alt=""
            className="absolute inset-0 w-full h-full object-cover object-[60%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0d17] via-[#0b0d17]/55 to-[#0b0d17]/10" />
          <div className="relative h-full flex flex-col justify-end p-10 xl:p-12">
            <div className="dark absolute top-10 left-10 w-[290px]">
              <ChatPlayer script="hero" height={230} />
            </div>
            <h2 className="text-[30px] xl:text-[36px] font-bold tracking-[-0.035em] leading-[1.1] text-white max-w-[18ch]">
              {t('authPanel.' + side + '.title')}
            </h2>
            <ul className="mt-6 space-y-2.5">
              {list.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-white/15 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-emerald-300" strokeWidth={3} />
                  </span>
                  <span className="text-[14.5px] leading-relaxed text-gray-200">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- form alanı */

export const Field = ({
  label,
  hint,
  ...props
}: {
  label?: any;
  hint?: any;
  [prop: string]: any;
}) => (
  <label className="block">
    <span className="block text-[13.5px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {label}
    </span>
    <input
      className="w-full px-3.5 py-3 rounded-xl text-[15px]
        bg-white dark:bg-white/[0.04]
        border border-gray-300 dark:border-white/10
        text-gray-900 dark:text-white placeholder:text-gray-400
        focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500
        transition"
      {...props}
    />
    {hint && (
      <span className="block mt-1.5 text-[12px] text-gray-500 dark:text-gray-400">{hint}</span>
    )}
  </label>
);

export default AuthLayout;
