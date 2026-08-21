import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  MessageSquare, Code2, GitBranch, Zap, Send, BookOpen,
  BarChart3, Users, Sparkles, Eye, ArrowRight, ArrowUpRight
} from 'lucide-react';

import Shell, { PageHero, Section, useMarketingRoutes } from '../components/marketing/Shell';
import { FEATURE_IDS, FEATURE_ICON, FEATURE_PLAN } from './marketing/features';

/**
 * Özellikler sayfası.
 *
 * Eski sayfada üç ayrı istatistik şeridi ("Aktif Kullanıcı", "Ülke", "Uptime"),
 * gradient başlıklar ve doğrulanamayan iddialar vardı. Hepsi kaldırıldı;
 * yerine ürünün gerçekten yaptığı işlerin sade bir listesi kondu.
 */

const ICONS = { MessageSquare, Code2, GitBranch, Zap, Send, BookOpen, BarChart3, Users, Sparkles, Eye };

const PLAN_BADGE = {
  all: null,
  pro: 'Pro',
  enterprise: 'Enterprise'
};

const Features = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();

  return (
    <Shell>
      <Helmet>
        <title>{`${t('featuresPage.meta.title')} — Support.io`}</title>
        <meta name="description" content={t('featuresPage.meta.description')} />
      </Helmet>

      <PageHero
        eyebrow={t('featuresPage.eyebrow')}
        title={t('featuresPage.title')}
        description={t('featuresPage.description')}
      >
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to={routes.register}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-gray-900 dark:bg-white
              text-white dark:text-gray-900 text-[14.5px] font-medium
              hover:bg-gray-800 dark:hover:bg-gray-100 transition"
          >
            {t('landing.home.btnStart')} <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            to={routes.docs}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border
              border-gray-200 dark:border-gray-800 text-[14.5px] font-medium
              text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
          >
            {t('landing.home.btnDocs')}
          </Link>
        </div>
      </PageHero>

      {/* ------------------------------------------------ özellik listesi */}
      <Section bordered>
        <div className="grid gap-x-10 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURE_IDS.map((id) => {
            const Icon = ICONS[FEATURE_ICON[id]] || MessageSquare;
            const badge = PLAN_BADGE[FEATURE_PLAN[id]];
            return (
              <Link
                key={id}
                to={`${routes.features}/${id}`}
                className="group block focus:outline-none focus-visible:ring-2
                  focus-visible:ring-indigo-500 focus-visible:ring-offset-4 rounded-lg
                  dark:focus-visible:ring-offset-gray-950"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="w-[18px] h-[18px] text-gray-400 dark:text-gray-500" strokeWidth={1.8} />
                  {badge && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide
                      bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                      {badge}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 flex items-center gap-1 text-[15.5px] font-semibold
                  text-gray-900 dark:text-white">
                  {t(`featuresPage.items.${id}.title`)}
                  <ArrowUpRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all
                    group-hover:opacity-60 group-hover:translate-x-0" />
                </h2>
                <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {t(`featuresPage.items.${id}.summary`)}
                </p>
              </Link>
            );
          })}
        </div>
      </Section>

      {/* ------------------------------------------------------ geliştirici */}
      <Section
        title={t('featuresPage.devTitle')}
        description={t('featuresPage.devDesc')}
        bordered
      >
        <div className="mt-8 grid gap-x-10 gap-y-8 sm:grid-cols-3">
          {['embed', 'sdk', 'isolation'].map((item) => (
            <div key={item}>
              <h3 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                {t(`featuresPage.dev.${item}.title`)}
              </h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                {t(`featuresPage.dev.${item}.body`)}
              </p>
            </div>
          ))}
        </div>
        <Link
          to={routes.docs}
          className="mt-9 inline-flex items-center gap-1.5 text-[14px] font-medium
            text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {t('featuresPage.readDocs')} <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </Section>

      {/* ------------------------------------------------------------- CTA */}
      <Section bordered={false}>
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-[28px] sm:text-[33px] font-semibold tracking-[-0.025em]
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
      </Section>
    </Shell>
  );
};

export default Features;
