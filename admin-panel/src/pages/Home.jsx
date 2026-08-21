import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, Check, Copy, MessageSquare, Zap, BarChart3, Users,
  ShieldCheck, Globe, Code2, Paperclip, Send
} from 'lucide-react';

import Shell, { useMarketingRoutes } from '../components/marketing/Shell';
import { LogoMark } from '../components/Logo';

/**
 * Ana sayfa.
 *
 * Önceki sürüm "AI ile üretilmiş SaaS şablonu" görüntüsünün ders kitabı
 * örneğiydi ve şunlar temizlendi:
 *
 *  - Arka planda dönen mor blur "blob", süzülen (float) kart animasyonu,
 *    başlıkta gradient metin, butonlarda neon glow gölgeler.
 *  - `i.pravatar.cc` üzerinden çekilen SAHTE kullanıcı avatarları. Bu hem
 *    uydurma bir sosyal kanıttı hem de ana sayfadan üçüncü parti bir servise
 *    çıkan gerçek bir istekti.
 *  - "5.000+ işletme tarafından güveniliyor" ve "Dünya devleri bizi seçti"
 *    gibi doğrulanamayan iddialar.
 *
 * Yerine konan şey: tipografi, beyaz alan ve hiyerarşi. Kanıt olarak da
 * uydurma bir rakam değil, gerçekten çalışan kurulum kodu ve ürünün kendi
 * arayüzü gösteriliyor.
 */

const FRAMEWORKS = [
  'HTML', 'React', 'Next.js', 'Vue', 'Nuxt', 'Angular',
  'Svelte', 'Astro', 'WordPress', 'Laravel', 'Shopify', 'PHP'
];

/* ------------------------------------------------------ ürün önizlemesi */

/** Panelin kendi görsel dilinde, statik ama gerçekçi bir gelen kutusu. */
const InboxPreview = ({ t }) => (
  <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900
    overflow-hidden shadow-sm">
    <div className="flex items-center gap-2 px-3 h-9 border-b border-gray-200 dark:border-gray-800
      bg-gray-50 dark:bg-gray-900/60">
      <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700" />
      <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700" />
      <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700" />
      <span className="ml-2 text-[11px] text-gray-400 dark:text-gray-500">{t('landing.home.preview.inbox')}</span>
    </div>

    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] h-[286px]">
      {/* konuşma listesi */}
      <div className="border-r border-gray-200 dark:border-gray-800 overflow-hidden">
        {[
          { name: 'Elif Kaya', preview: t('landing.home.preview.thread1'), time: '2d', unread: true, active: true },
          { name: 'Marcus Reid', preview: t('landing.home.preview.thread2'), time: '14d', unread: false },
          { name: 'Zeynep A.', preview: t('landing.home.preview.thread3'), time: '1s', unread: false },
          { name: 'Deniz Yurt', preview: t('landing.home.preview.thread4'), time: '3s', unread: false }
        ].map((row) => (
          <div
            key={row.name}
            className={`px-3 py-2.5 border-b border-gray-100 dark:border-gray-800/70
              ${row.active ? 'bg-indigo-50/60 dark:bg-indigo-500/[0.08]' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 shrink-0
                text-[10px] font-semibold text-gray-600 dark:text-gray-300 flex items-center justify-center">
                {row.name.charAt(0)}
              </span>
              <span className="text-[12.5px] font-medium text-gray-900 dark:text-white truncate flex-1">
                {row.name}
              </span>
              <span className="text-[10px] text-gray-400 shrink-0">{row.time}</span>
              {row.unread && <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
            </div>
            <p className="mt-1 pl-8 text-[11.5px] text-gray-500 dark:text-gray-400 truncate">{row.preview}</p>
          </div>
        ))}
      </div>

      {/* açık konuşma */}
      <div className="flex flex-col min-w-0">
        <div className="px-3.5 py-2.5 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 text-[10px] font-semibold
            text-gray-600 dark:text-gray-300 flex items-center justify-center">E</span>
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium text-gray-900 dark:text-white leading-tight">Elif Kaya</span>
            <span className="flex items-center gap-1 text-[10.5px] text-gray-500 dark:text-gray-400">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              /fiyatlandirma
            </span>
          </span>
          <span className="ml-auto px-1.5 py-0.5 rounded text-[9.5px] font-medium
            bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
            {t('landing.home.preview.pending')}
          </span>
        </div>

        <div className="flex-1 p-3.5 space-y-2 overflow-hidden">
          <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-bl-sm bg-gray-100 dark:bg-gray-800
            text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
            {t('landing.home.preview.msg1')}
          </div>
          <div className="max-w-[80%] ml-auto px-3 py-2 rounded-xl rounded-br-sm bg-indigo-600
            text-[12px] leading-relaxed text-white">
            {t('landing.home.preview.msg2')}
          </div>
          <div className="max-w-[80%] px-3 py-2 rounded-xl rounded-bl-sm bg-gray-100 dark:bg-gray-800
            text-[12px] leading-relaxed text-gray-700 dark:text-gray-300">
            {t('landing.home.preview.msg3')}
          </div>
        </div>

        <div className="p-2.5 border-t border-gray-200 dark:border-gray-800 flex items-center gap-2">
          <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <span className="flex-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700
            text-[11.5px] text-gray-400 truncate">
            {t('landing.home.preview.composer')}
          </span>
          <span className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <Send className="w-3 h-3 text-white" />
          </span>
        </div>
      </div>
    </div>
  </div>
);

/* -------------------------------------------------------------- sayfa */

const Home = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();
  const [copied, setCopied] = useState(false);

  const origin = import.meta.env.VITE_API_URL || 'https://your-support-host.com';
  const snippet = `<script\n  src="${origin}/widget.js"\n  data-site-key="YOUR_SITE_KEY"\n  async><\/script>`;

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Pano izni yoksa sessiz kal; kod zaten ekranda ve seçilebilir.
    }
  };

  const capabilities = [
    { icon: MessageSquare, key: 'liveChat' },
    { icon: Zap, key: 'automation' },
    { icon: Users, key: 'team' },
    { icon: BarChart3, key: 'analytics' },
    { icon: Globe, key: 'multisite' },
    { icon: ShieldCheck, key: 'security' }
  ];

  return (
    <>
      <Helmet>
        <title>{t('landing.home.metaTitle')}</title>
        <meta name="description" content={t('landing.home.heroDesc')} />
      </Helmet>

      <Shell>
        <>
          {/* ================================================== HERO */}
          <section className="pt-28 pb-16 sm:pt-36 sm:pb-24 px-5 sm:px-8">
            <div className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-12 lg:gap-16 items-center">
              <div>
                <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11.5px]
                  font-medium border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                  {t('landing.home.badge')}
                </span>

                <h1 className="mt-5 text-[38px] sm:text-[52px] font-semibold tracking-[-0.03em]
                  leading-[1.05] text-gray-900 dark:text-white">
                  {t('landing.home.heroTitle')}
                </h1>

                <p className="mt-5 text-[17px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[52ch]">
                  {t('landing.home.heroDesc')}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link
                    to={routes.register}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gray-900 dark:bg-white
                      text-white dark:text-gray-900 text-[14.5px] font-medium
                      hover:bg-gray-800 dark:hover:bg-gray-100 transition
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2
                      dark:focus-visible:ring-offset-gray-950"
                  >
                    {t('landing.home.btnStart')}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to={routes.docs}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border
                      border-gray-200 dark:border-gray-800 text-[14.5px] font-medium
                      text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                  >
                    <Code2 className="w-4 h-4" />
                    {t('landing.home.btnDocs')}
                  </Link>
                </div>

                <p className="mt-5 text-[13px] text-gray-500 dark:text-gray-500">
                  {t('landing.home.heroNote')}
                </p>
              </div>

              {/* Kanıt: uydurma bir rakam değil, gerçekten çalışan kurulum kodu. */}
              <div className="lg:pl-4">
                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-gray-950">
                  <div className="flex items-center justify-between px-4 h-10 border-b border-white/[0.07]">
                    <span className="text-[11.5px] font-mono text-gray-400">index.html</span>
                    <button
                      onClick={copySnippet}
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11.5px]
                        font-medium text-gray-400 hover:text-white hover:bg-white/10 transition"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? t('common.copied') : t('common.copy')}
                    </button>
                  </div>
                  <pre className="overflow-x-auto p-4 text-[12.5px] leading-[1.75] text-gray-200">
                    <code>{snippet}</code>
                  </pre>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {FRAMEWORKS.map((name) => (
                    <span
                      key={name}
                      className="px-2 py-1 rounded-md text-[11px] font-medium
                        bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400
                        border border-gray-200 dark:border-gray-800"
                    >
                      {name}
                    </span>
                  ))}
                </div>
                <p className="mt-2.5 text-[12.5px] text-gray-500 dark:text-gray-500">
                  {t('landing.home.sameSnippet')}
                </p>
              </div>
            </div>
          </section>

          {/* ======================================= ÜRÜN ÖNİZLEMESİ */}
          <section className="px-5 sm:px-8 pb-20">
            <div className="max-w-6xl mx-auto">
              <InboxPreview t={t} />
            </div>
          </section>

          {/* ============================================ NASIL ÇALIŞIR */}
          <section className="border-y border-gray-200 dark:border-gray-800 py-20 px-5 sm:px-8">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                {t('landing.home.howTitle')}
              </h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[58ch]">
                {t('landing.home.howDesc')}
              </p>

              <ol className="mt-10 grid sm:grid-cols-3 gap-x-8 gap-y-10">
                {['step1', 'step2', 'step3'].map((step, index) => (
                  <li key={step}>
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full
                      border border-gray-300 dark:border-gray-700 text-[12.5px] font-semibold
                      text-gray-600 dark:text-gray-400">
                      {index + 1}
                    </span>
                    <h3 className="mt-3.5 text-[15.5px] font-semibold text-gray-900 dark:text-white">
                      {t(`landing.home.${step}Title`)}
                    </h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                      {t(`landing.home.${step}Desc`)}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ================================================ YETENEKLER */}
          <section className="py-20 px-5 sm:px-8">
            <div className="max-w-6xl mx-auto">
              <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                {t('landing.home.featuresTitle')}
              </h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[58ch]">
                {t('landing.home.featuresDesc')}
              </p>

              <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-9">
                {capabilities.map(({ icon: Icon, key }) => (
                  <div key={key}>
                    <Icon className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500" strokeWidth={1.8} />
                    <h3 className="mt-3 text-[15px] font-semibold text-gray-900 dark:text-white">
                      {t(`landing.home.cap.${key}.title`)}
                    </h3>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                      {t(`landing.home.cap.${key}.body`)}
                    </p>
                  </div>
                ))}
              </div>

              <Link
                to={routes.features}
                className="mt-10 inline-flex items-center gap-1.5 text-[14px] font-medium
                  text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                {t('landing.home.allFeatures')} <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </section>

          {/* ================================================== GÜVENLİK */}
          <section className="border-t border-gray-200 dark:border-gray-800 py-20 px-5 sm:px-8">
            <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-start">
              <div>
                <h2 className="text-[28px] sm:text-[32px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                  {t('landing.home.securityTitle')}
                </h2>
                <p className="mt-3 text-[15.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[54ch]">
                  {t('landing.home.securityDesc')}
                </p>
              </div>
              <ul className="space-y-3.5">
                {['isolation', 'tenant', 'csp', 'data'].map((item) => (
                  <li key={item} className="flex gap-3">
                    <Check className="w-4 h-4 mt-0.5 shrink-0 text-green-600 dark:text-green-500" />
                    <span className="text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                      <strong className="font-medium text-gray-900 dark:text-white">
                        {t(`landing.home.sec.${item}.title`)}
                      </strong>{' '}
                      — {t(`landing.home.sec.${item}.body`)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* ======================================================= CTA */}
          <section className="border-t border-gray-200 dark:border-gray-800 py-20 px-5 sm:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <LogoMark size={40} className="mx-auto" />
              <h2 className="mt-6 text-[30px] sm:text-[36px] font-semibold tracking-[-0.025em]
                text-gray-900 dark:text-white leading-tight">
                {t('landing.home.ctaTitle')}
              </h2>
              <p className="mt-3 text-[15.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                {t('landing.home.ctaDesc')}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  to={routes.register}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gray-900 dark:bg-white
                    text-white dark:text-gray-900 text-[14.5px] font-medium
                    hover:bg-gray-800 dark:hover:bg-gray-100 transition"
                >
                  {t('landing.home.ctaBtn1')} <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  to={routes.pricing}
                  className="inline-flex items-center px-5 py-3 rounded-lg border
                    border-gray-200 dark:border-gray-800 text-[14.5px] font-medium
                    text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
                >
                  {t('landing.home.ctaBtn2')}
                </Link>
              </div>
            </div>
          </section>
        </>
      </Shell>
    </>
  );
};

export default Home;
