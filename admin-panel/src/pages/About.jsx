import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Mail, Github, BookOpen } from 'lucide-react';

import Shell, { PageHero, Section, useMarketingRoutes } from '../components/marketing/Shell';

/**
 * Hakkımızda.
 *
 * Eski sayfada "Aktif Kullanıcı / Aylık Konuşma / Ülke" sayaçları, isimsiz bir
 * "GELİŞTİRİCİLER & DESTEK" ekip bölümü ve "bugün binlerce işletme kullanıyor"
 * cümlesi vardı. Hiçbirinin arkasında bir veri yoktu, dolayısıyla hepsi
 * kaldırıldı.
 *
 * Yerine konan şey doğrulanabilir: ürünün ne olduğu, hangi kararlarla
 * kurulduğu ve neyin üzerine inşa edildiği.
 */

const About = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();

  const principles = ['own', 'plain', 'honest', 'accessible'];
  const stack = [
    { name: 'React 18 + Vite', role: 'aboutPage.stack.frontend' },
    { name: 'Node.js + Express', role: 'aboutPage.stack.backend' },
    { name: 'PostgreSQL', role: 'aboutPage.stack.db' },
    { name: 'Socket.IO + Redis', role: 'aboutPage.stack.realtime' },
    { name: 'Amazon S3', role: 'aboutPage.stack.storage' },
    { name: 'Shadow DOM', role: 'aboutPage.stack.widget' }
  ];

  return (
    <Shell>
      <Helmet>
        <title>{`${t('aboutPage.meta.title')} — Support.io`}</title>
        <meta name="description" content={t('aboutPage.meta.description')} />
      </Helmet>

      <PageHero title={t('aboutPage.title')} description={t('aboutPage.description')} />

      {/* ------------------------------------------------------------ hikâye */}
      <Section bordered>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('aboutPage.storyEyebrow')}
          </h2>
          <div className="space-y-5 max-w-[62ch]">
            {['p1', 'p2', 'p3'].map((key) => (
              <p key={key} className="text-[15.5px] leading-[1.75] text-gray-700 dark:text-gray-300">
                {t(`aboutPage.story.${key}`)}
              </p>
            ))}
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- ilkeler */}
      <Section bordered>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('aboutPage.principlesEyebrow')}
          </h2>
          <dl className="space-y-8 max-w-[62ch]">
            {principles.map((key) => (
              <div key={key}>
                <dt className="text-[15.5px] font-semibold text-gray-900 dark:text-white">
                  {t(`aboutPage.principles.${key}.title`)}
                </dt>
                <dd className="mt-1.5 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {t(`aboutPage.principles.${key}.body`)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      {/* ------------------------------------------------------------ teknik */}
      <Section bordered>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-12">
          <div>
            <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {t('aboutPage.stackEyebrow')}
            </h2>
            <p className="mt-3 text-[14px] leading-relaxed text-gray-500 dark:text-gray-400 max-w-[34ch]">
              {t('aboutPage.stackNote')}
            </p>
          </div>
          <ul className="max-w-[62ch] divide-y divide-gray-100 dark:divide-gray-900">
            {stack.map((item) => (
              <li key={item.name} className="flex items-baseline justify-between gap-6 py-3">
                <span className="text-[14.5px] font-medium text-gray-900 dark:text-white">{item.name}</span>
                <span className="text-[13.5px] text-gray-500 dark:text-gray-400 text-right">{t(item.role)}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ---------------------------------------------------------- iletişim */}
      <Section bordered={false}>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-12">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
            {t('aboutPage.contactEyebrow')}
          </h2>

          <div className="max-w-[62ch]">
            <p className="text-[15.5px] leading-relaxed text-gray-700 dark:text-gray-300">
              {t('aboutPage.contactBody')}
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              <a
                href="mailto:destek@support.io"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border
                  border-gray-200 dark:border-gray-800 text-[14px] font-medium
                  text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
              >
                <Mail className="w-4 h-4" /> destek@support.io
              </a>
              <Link
                to={routes.docs}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border
                  border-gray-200 dark:border-gray-800 text-[14px] font-medium
                  text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900 transition"
              >
                <BookOpen className="w-4 h-4" /> {t('landing.home.btnDocs')}
              </Link>
            </div>

            <div className="mt-10 pt-8 border-t border-gray-100 dark:border-gray-900">
              <h3 className="text-[20px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                {t('landing.home.ctaTitle')}
              </h3>
              <Link
                to={routes.register}
                className="mt-5 inline-flex items-center gap-2 px-5 py-3 rounded-lg
                  bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-[14.5px] font-medium
                  hover:bg-gray-800 dark:hover:bg-gray-100 transition"
              >
                {t('landing.home.ctaBtn1')} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </Section>
    </Shell>
  );
};

export default About;
