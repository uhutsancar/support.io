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
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, Moon, Sun, Languages } from 'lucide-react';
import Logo from '../Logo';
import { useTheme } from '../../contexts/ThemeContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { InboxVisual } from './visuals';
import { AppFrame } from './kit';

const AuthLayout = ({ title, subtitle, children, footer, side = 'register' }: { title?: any; subtitle?: any; children?: any; footer?: any; [prop: string]: any }) => {
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
            <h1 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.03em]
              text-gray-900 dark:text-white">
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
      {/* Düz koyu zemin — parıltı ve ızgara dokusu yok. */}
      <div className="hidden lg:flex overflow-hidden bg-gray-950 dark:bg-black
        flex-col justify-center px-12 xl:px-16 py-14">
        <div>
          <h2 className="text-[28px] xl:text-[34px] font-semibold tracking-[-0.03em]
            leading-[1.15] text-white max-w-[18ch]">
            {t('authPanel.' + side + '.title')}
          </h2>

          <ul className="mt-7 space-y-3">
            {list.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 w-5 h-5 rounded-full bg-white/[0.12] flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-emerald-300" strokeWidth={3} />
                </span>
                <span className="text-[14.5px] leading-relaxed text-gray-300">{p}</span>
              </li>
            ))}
          </ul>

          {/*
            Ürünün kendisi. Kayıt formunun yanında neye kayıt olunduğunun
            görünmesi, soyut bir vaat listesinden daha ikna edici.
          */}
          {/*
            `dark` sınıfı burada elle veriliyor: bu panel her zaman koyu
            zeminde duruyor, dolayısıyla içindeki ürün görseli de sayfanın
            genel temasından bağımsız olarak koyu varyantını kullanmalı.
            Tailwind'in class stratejisinde `dark:` en yakın `.dark`
            atasından çözülür, bu yüzden sarmalayıcı yeterli.
          */}
          <div className="dark mt-10 max-w-[560px]">
            <AppFrame label={t('viz.inbox.frame')} className="shadow-[0_32px_80px_-24px_rgba(0,0,0,.8)]">
              <InboxVisual compact />
            </AppFrame>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------- form alanı */

export const Field = ({ label, hint, ...props }: { label?: any; hint?: any; [prop: string]: any }) => (
  <label className="block">
    <span className="block text-[13.5px] font-medium text-gray-700 dark:text-gray-300 mb-1.5">
      {label}
    </span>
    <input
      className="w-full px-3.5 py-3 rounded-xl text-[14.5px]
        bg-white dark:bg-white/[0.04]
        border border-gray-300 dark:border-white/10
        text-gray-900 dark:text-white placeholder:text-gray-400
        focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500
        transition"
      {...props}
    />
    {hint && <span className="block mt-1.5 text-[12px] text-gray-500 dark:text-gray-400">{hint}</span>}
  </label>
);

export default AuthLayout;
