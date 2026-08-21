import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare, Code2, GitBranch, Zap, Send, BookOpen,
  BarChart3, Users, Sparkles, Eye, ArrowLeft, ArrowRight, Check
} from 'lucide-react';

import Shell, { Section, useMarketingRoutes } from '../components/marketing/Shell';
import { FEATURE_IDS, FEATURE_ICON, FEATURE_PLAN, PLAN_LABEL } from './marketing/features';

/**
 * Tek bir özelliğin detay sayfası.
 *
 * Eski sürüm slug'ı BAŞLIKTAN türetiyordu (`slugify(feature.title)`), yani
 * başlık ya da dil değiştiğinde bağlantılar kırılıyor ve sayfa "Özellik
 * bulunamadı" veriyordu. Ayrıca içeriği `dangerouslySetInnerHTML` ile
 * basıyordu ve her özellik için aynı stok fotoğrafı gösteriyordu.
 *
 * Artık slug sabit bir kimlik; metin i18n'den, ikon ve plan bilgisi ise
 * Features sayfasıyla ortak veri modülünden gelir.
 */

const ICONS = { MessageSquare, Code2, GitBranch, Zap, Send, BookOpen, BarChart3, Users, Sparkles, Eye };

const FeatureDetail = () => {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const routes = useMarketingRoutes();
  const lang = i18n.language === 'en' ? 'en' : 'tr';

  const known = FEATURE_IDS.includes(slug);

  if (!known) {
    return (
      <Shell>
        <Helmet>
          <title>{`${t('featuresPage.notFound.title')} — Support.io`}</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="pt-40 pb-28 px-5 sm:px-8">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-[24px] font-semibold text-gray-900 dark:text-white">
              {t('featuresPage.notFound.title')}
            </h1>
            <p className="mt-2.5 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">
              {t('featuresPage.notFound.body')}
            </p>
            <Link
              to={routes.features}
              className="mt-6 inline-flex items-center gap-2 px-4 py-2.5 rounded-lg
                bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[14px] font-medium"
            >
              <ArrowLeft className="w-4 h-4" /> {t('featuresPage.backToList')}
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const Icon = ICONS[FEATURE_ICON[slug]] || MessageSquare;
  const plan = FEATURE_PLAN[slug];
  const points = t(`featuresPage.items.${slug}.points`, { returnObjects: true });
  const list = Array.isArray(points) ? points : [];

  // Bir sonraki / bir önceki özellik — sayfada çıkmaz sokak olmasın.
  const index = FEATURE_IDS.indexOf(slug);
  const next = FEATURE_IDS[(index + 1) % FEATURE_IDS.length];
  const previous = FEATURE_IDS[(index - 1 + FEATURE_IDS.length) % FEATURE_IDS.length];

  return (
    <Shell>
      <Helmet>
        <title>{`${t(`featuresPage.items.${slug}.title`)} — Support.io`}</title>
        <meta name="description" content={t(`featuresPage.items.${slug}.summary`)} />
      </Helmet>

      <div className="pt-28 sm:pt-32 pb-16 px-5 sm:px-8 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-6xl mx-auto">
          <Link
            to={routes.features}
            className="inline-flex items-center gap-1.5 text-[13.5px] text-gray-500 dark:text-gray-400
              hover:text-gray-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('featuresPage.backToList')}
          </Link>

          <div className="mt-6 flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl border border-gray-200 dark:border-gray-800
              flex items-center justify-center">
              <Icon className="w-[19px] h-[19px] text-gray-500 dark:text-gray-400" strokeWidth={1.8} />
            </span>
            <span className="px-2 py-1 rounded-md text-[11px] font-medium
              bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
              {PLAN_LABEL[plan][lang]}
            </span>
          </div>

          <h1 className="mt-5 text-[32px] sm:text-[40px] font-semibold tracking-[-0.03em]
            leading-[1.1] text-gray-900 dark:text-white max-w-[18ch]">
            {t(`featuresPage.items.${slug}.title`)}
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[58ch]">
            {t(`featuresPage.items.${slug}.summary`)}
          </p>
        </div>
      </div>

      <Section bordered>
        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-12 items-start">
          <div>
            <p className="text-[15.5px] leading-[1.75] text-gray-700 dark:text-gray-300 max-w-[62ch]">
              {t(`featuresPage.items.${slug}.body`)}
            </p>

            {list.length > 0 && (
              <ul className="mt-8 space-y-3">
                {list.map((point, i) => (
                  <li key={i} className="flex gap-3">
                    <Check className="w-4 h-4 mt-1 shrink-0 text-green-600 dark:text-green-500" />
                    <span className="text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[58ch]">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <aside className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {t('featuresPage.aside.title')}
            </h2>
            <dl className="mt-3.5 space-y-2.5 text-[13.5px]">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t('featuresPage.aside.plan')}</dt>
                <dd className="text-gray-900 dark:text-white text-right">{PLAN_LABEL[plan][lang]}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500 dark:text-gray-400">{t('featuresPage.aside.setup')}</dt>
                <dd className="text-gray-900 dark:text-white text-right">
                  {t(`featuresPage.items.${slug}.setup`)}
                </dd>
              </div>
            </dl>
            <Link
              to={routes.register}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[14px] font-medium
                hover:bg-gray-800 dark:hover:bg-gray-100 transition"
            >
              {t('landing.home.btnStart')} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to={routes.docs}
              className="mt-2 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg
                border border-gray-200 dark:border-gray-800 text-[14px] font-medium
                text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
            >
              {t('landing.home.btnDocs')}
            </Link>
          </aside>
        </div>
      </Section>

      {/* -------------------------------------------------- önceki / sonraki */}
      <Section bordered={false}>
        <nav className="flex flex-wrap items-center justify-between gap-4" aria-label={t('featuresPage.moreTitle')}>
          <Link
            to={`${routes.features}/${previous}`}
            className="group inline-flex items-center gap-2 text-[14px] text-gray-600 dark:text-gray-400
              hover:text-gray-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            {t(`featuresPage.items.${previous}.title`)}
          </Link>
          <Link
            to={`${routes.features}/${next}`}
            className="group inline-flex items-center gap-2 text-[14px] text-gray-600 dark:text-gray-400
              hover:text-gray-900 dark:hover:text-white transition"
          >
            {t(`featuresPage.items.${next}.title`)}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </nav>
      </Section>
    </Shell>
  );
};

export default FeatureDetail;
