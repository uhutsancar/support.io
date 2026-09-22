/**
 * Hakkımızda.
 *
 * Eski sayfada "Aktif Kullanıcı / Aylık Konuşma / Ülke" sayaçları, isimsiz bir
 * "GELİŞTİRİCİLER & DESTEK" ekip bölümü ve "bugün binlerce işletme kullanıyor"
 * cümlesi vardı. Hiçbirinin arkasında bir veri yoktu, dolayısıyla hepsi
 * kaldırıldı ve geri getirilmedi.
 *
 * Yerine konan şey doğrulanabilir: ürünün ne olduğu, hangi kararlarla
 * kurulduğu ve neyin üzerine inşa edildiği. Bir şirket sayfasının tek dürüst
 * "sosyal kanıtı", neyi neden yaptığını açıkça yazabilmesidir.
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Mail, BookOpen, Heart, Eye, Wallet, Accessibility, Layers, ArrowRight
} from 'lucide-react';
import Shell, { PageHero, useMarketingRoutes } from '../components/marketing/Shell';
import {
  Button, Section, SectionHead, Card, AccentIcon, accent
} from '../components/marketing/kit';

const PRINCIPLES = [
  { key: 'own', icon: Wallet, tone: 'indigo' },
  { key: 'plain', icon: Eye, tone: 'emerald' },
  { key: 'honest', icon: Heart, tone: 'rose' },
  { key: 'accessible', icon: Accessibility, tone: 'violet' }
];

const About = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();

  const stack = [
    { name: 'React + Vite', role: 'aboutPage.stack.frontend' },
    { name: 'Node.js + Express', role: 'aboutPage.stack.backend' },
    { name: 'PostgreSQL', role: 'aboutPage.stack.db' },
    { name: 'Socket.IO + Redis', role: 'aboutPage.stack.realtime' },
    { name: 'Amazon S3', role: 'aboutPage.stack.storage' },
    { name: 'Shadow DOM', role: 'aboutPage.stack.widget' }
  ];

  return (
    <Shell>
      <Helmet>
        <title>{t('aboutPage.meta.title') + ' — Support.io'}</title>
        <meta name="description" content={t('aboutPage.meta.description')} />
      </Helmet>

      <PageHero
        eyebrow={t('aboutPage.eyebrow')}
        title={t('aboutPage.title')}
        description={t('aboutPage.description')}
      />

      {/* ------------------------------------------------------------ hikâye */}
      <Section tone="subtle" bordered>
        <div className="grid lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] gap-10 lg:gap-16">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-gray-400 dark:text-gray-500">
            {t('aboutPage.storyEyebrow')}
          </h2>
          <div className="space-y-6 max-w-[64ch]">
            {['p1', 'p2', 'p3'].map((key, i) => (
              <p
                key={key}
                className={[
                  'leading-[1.75] text-gray-700 dark:text-gray-300',
                  i === 0 ? 'text-[19px] sm:text-[21px] font-medium tracking-[-0.015em] text-gray-900 dark:text-white' : 'text-[16px]'
                ].join(' ')}
              >
                {t('aboutPage.story.' + key)}
              </p>
            ))}
          </div>
        </div>
      </Section>

      {/* ---------------------------------------------------------- ilkeler */}
      <Section bordered>
        <SectionHead
          eyebrow={t('aboutPage.principlesEyebrow')}
          title={t('aboutPage.principlesTitle')}
          description={t('aboutPage.principlesDesc')}
        />

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          {PRINCIPLES.map((p, i) => (
            <div key={p.key}>
              <Card hover className="h-full p-6">
                <AccentIcon icon={p.icon} tone={p.tone} size="lg" />
                <h3 className="mt-5 text-[17px] font-semibold text-gray-900 dark:text-white">
                  {t('aboutPage.principles.' + p.key + '.title')}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-[1.7] text-gray-600 dark:text-gray-400">
                  {t('aboutPage.principles.' + p.key + '.body')}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------ teknik */}
      <Section tone="subtle" bordered>
        <div className="grid lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] gap-10 lg:gap-16">
          <div>
            <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-gray-400 dark:text-gray-500">
              {t('aboutPage.stackEyebrow')}
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[36ch]">
              {t('aboutPage.stackNote')}
            </p>
          </div>

          <ul className="grid sm:grid-cols-2 gap-3">
            {stack.map((item) => (
              <li key={item.name}>
                <Card className="p-4 h-full flex items-start gap-3">
                  <AccentIcon icon={Layers} tone="sky" size="sm" />
                  <span className="min-w-0">
                    <span className="block text-[14.5px] font-semibold text-gray-900 dark:text-white">
                      {item.name}
                    </span>
                    <span className="block mt-0.5 text-[13px] leading-relaxed text-gray-600 dark:text-gray-400">
                      {t(item.role)}
                    </span>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* ---------------------------------------------------------- iletişim */}
      <Section bordered>
        <div className="grid lg:grid-cols-[minmax(0,.7fr)_minmax(0,1.3fr)] gap-10 lg:gap-16">
          <h2 className="text-[11.5px] font-semibold uppercase tracking-[0.09em] text-gray-400 dark:text-gray-500">
            {t('aboutPage.contactEyebrow')}
          </h2>

          <div className="max-w-[64ch]">
            <p className="text-[17px] leading-[1.7] text-gray-700 dark:text-gray-300">
              {t('aboutPage.contactBody')}
            </p>

            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button href="mailto:destek@support.io" variant="secondary">
                <Mail className="w-4 h-4" /> destek@support.io
              </Button>
              <Button to={routes.docs} variant="secondary">
                <BookOpen className="w-4 h-4" /> {t('landing.home.btnDocs')}
              </Button>
            </div>

            <div className="mt-12 rounded-2xl border border-indigo-200 dark:border-indigo-500/25
              bg-indigo-50/70 dark:bg-indigo-500/[0.08] p-6 sm:p-8">
              <h3 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.025em]
                leading-snug text-gray-900 dark:text-white max-w-[22ch]">
                {t('landing.home.ctaTitle')}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[50ch]">
                {t('landing.home.ctaDesc')}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button to={routes.register} arrow>{t('landing.home.ctaBtn1')}</Button>
                <Button to={routes.pricing} variant="secondary">{t('landing.home.ctaBtn2')}</Button>
              </div>
            </div>
          </div>
        </div>
      </Section>
    </Shell>
  );
};

export default About;
