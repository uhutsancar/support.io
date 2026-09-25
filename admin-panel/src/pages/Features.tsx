/**
 * Özellikler sayfası.
 *
 * On bir özellik üç iş başlığı altında: müşteriyle konuşmak, işi düzenlemek,
 * ölçüp büyütmek. Her grubun kendi ürün görseli ve kartları var; sayfanın
 * üstündeki yapışkan şerit gruplar arasında atlatır. Kart metni `plain`
 * anahtarından gelir — ne işe yaradığı; teknik karşılığı detay sayfasındaki
 * kapalı "teknik not" bloğunda.
 */

import type React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, Check, Code2, Palette, ShieldCheck, Pin } from 'lucide-react';
import Shell, { PageHero, useMarketingRoutes, featureIcon } from '../components/marketing/Shell';
import {
  Button,
  TextLink,
  Section,
  SectionHead,
  Card,
  Chip,
  Reveal,
  AppFrame,
  Photo,
  accent,
  asList,
  type SectionTone
} from '../components/marketing/kit';
import { InboxVisual, AnalyticsVisual, AutomationVisual } from '../components/marketing/visuals';
import { FEATURE_GROUPS, FEATURE_PLAN, FEATURE_TONE } from './marketing/features';

const PLAN_BADGE: Record<string, string | null> = { all: null, pro: 'Pro', enterprise: 'Enterprise' };

/** Grup başına tanıtım görseli. */
const GROUP_VISUAL: Record<string, (t: (k: string) => string) => React.ReactNode> = {
  talk: (t) => (
    <AppFrame label={t('viz.inbox.frame')}>
      <InboxVisual compact />
    </AppFrame>
  ),
  organize: (t) => (
    <AppFrame label={t('viz.automation.frame')} tone="emerald">
      <AutomationVisual />
    </AppFrame>
  ),
  grow: (t) => (
    <AppFrame label={t('viz.analytics.frame')} tone="sky">
      <AnalyticsVisual />
    </AppFrame>
  )
};

const GROUP_TONE: SectionTone[] = ['plain', 'mist', 'plain'];
const DEV_ICONS: Record<string, React.ElementType> = {
  embed: Code2,
  sdk: Palette,
  isolation: ShieldCheck,
  control: Pin
};

const FeatureCard = ({ id, to, t }: { id: string; to: string; t: (k: string) => string }) => {
  const Icon = featureIcon(id);
  const badge = PLAN_BADGE[FEATURE_PLAN[id as keyof typeof FEATURE_PLAN]];
  const tone = FEATURE_TONE[id as keyof typeof FEATURE_TONE];
  const a = accent(tone);

  return (
    <Link
      to={to}
      className="group block h-full rounded-3xl focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-4 dark:focus-visible:ring-offset-gray-950"
    >
      <Card hover className="h-full p-6 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <span className={['inline-flex w-10 h-10 items-center justify-center rounded-xl border', a.border].join(' ')}>
            <Icon className={['w-5 h-5', a.text].join(' ')} strokeWidth={1.8} />
          </span>
          {badge && <Chip>{badge}</Chip>}
        </div>
        <h3 className="mt-5 flex items-center gap-1.5 text-[16.5px] font-semibold text-gray-950 dark:text-white">
          {t('featuresPage.items.' + id + '.title')}
          <ArrowUpRight className="w-4 h-4 opacity-0 -translate-x-1 transition-all group-hover:opacity-70 group-hover:translate-x-0" />
        </h3>
        <p className="mt-2 text-[14px] leading-[1.6] text-gray-600 dark:text-gray-400 flex-1">
          {t('featuresPage.items.' + id + '.plain')}
        </p>
        <p className={['mt-5 text-[11px] font-semibold uppercase tracking-[0.12em]', a.text].join(' ')}>
          {t('featuresPage.items.' + id + '.setup')}
        </p>
      </Card>
    </Link>
  );
};

const Features = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();

  return (
    <Shell>
      <Helmet>
        <title>{t('featuresPage.meta.title') + ' — Support.io'}</title>
        <meta name="description" content={t('featuresPage.meta.description')} />
      </Helmet>

      <PageHero
        eyebrow={t('featuresPage.eyebrow')}
        title={t('featuresPage.title')}
        description={t('featuresPage.description')}
        align="center"
      >
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button to={routes.register} size="lg" arrow>
            {t('landing.home.btnStart')}
          </Button>
          <Button to={routes.pricing} variant="secondary" size="lg">
            {t('landing.home.ctaBtn2')}
          </Button>
        </div>
      </PageHero>

      {/* ------------------------------------------ gruplar arası kısayol */}
      <nav
        aria-label={t('featuresPage.meta.title')}
        className="sticky top-[72px] z-30 border-y border-gray-200/70 dark:border-white/[0.07] bg-white/85 dark:bg-surface-dark/85 backdrop-blur-xl"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 flex gap-1.5 overflow-x-auto py-2.5 [scrollbar-width:none]">
          {FEATURE_GROUPS.map((g) => (
            <a
              key={g.id}
              href={'#' + g.id}
              className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
            >
              {t('nav.groups.' + g.id)}
            </a>
          ))}
          <a
            href="#gelistiriciler"
            className="shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition"
          >
            {t('featuresPage.devEyebrow')}
          </a>
        </div>
      </nav>

      {/* -------------------------------------------------- gruplar */}
      {FEATURE_GROUPS.map((group, gi) => (
        <Section key={group.id} id={group.id} tone={GROUP_TONE[gi]} wide className="scroll-mt-32">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 lg:gap-16 items-center">
            <div className={gi % 2 === 1 ? 'lg:order-2' : ''}>
              <SectionHead
                index={gi + 1}
                eyebrow={t('nav.groups.' + group.id)}
                eyebrowTone={group.tone}
                title={t('featuresPage.groups.' + group.id + '.title')}
                description={t('featuresPage.groups.' + group.id + '.desc')}
              />
              <ul className="mt-7 space-y-3">
                {asList<string>(t('featuresPage.groups.' + group.id + '.points', { returnObjects: true })).map(
                  (p, i) => (
                    <Reveal as="li" key={i} delay={i * 0.05} className="flex gap-2.5">
                      <Check className={['w-4 h-4 mt-1 shrink-0', accent(group.tone).text].join(' ')} />
                      <span className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-300">{p}</span>
                    </Reveal>
                  )
                )}
              </ul>
            </div>
            <Reveal y={30} className={gi % 2 === 1 ? 'lg:order-1' : ''}>
              {GROUP_VISUAL[group.id]?.(t)}
            </Reveal>
          </div>

          <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {group.items.map((id, i) => (
              <Reveal key={id} delay={i * 0.06}>
                <FeatureCard id={id} to={routes.features + '/' + id} t={t} />
              </Reveal>
            ))}
          </div>
        </Section>
      ))}

      {/* ------------------------------------------------- geliştiriciler */}
      <Section id="gelistiriciler" tone="cream" wide className="scroll-mt-32">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 lg:gap-16 items-center">
          <div>
            <SectionHead
              index={4}
              eyebrow={t('featuresPage.devEyebrow')}
              eyebrowTone="violet"
              title={t('featuresPage.devTitle')}
              description={t('featuresPage.devDesc')}
            />
            <div className="mt-9 grid sm:grid-cols-2 gap-3">
              {['embed', 'sdk', 'isolation', 'control'].map((item, i) => {
                const Icon = DEV_ICONS[item];
                return (
                  <Reveal key={item} delay={i * 0.05}>
                    <Card className="p-5 h-full">
                      <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" strokeWidth={1.8} />
                      <h3 className="mt-3 text-[15px] font-semibold text-gray-950 dark:text-white">
                        {t('featuresPage.dev.' + item + '.title')}
                      </h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                        {t('featuresPage.dev.' + item + '.body')}
                      </p>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
            <Reveal className="mt-7">
              <TextLink to={routes.docs} tone="violet">
                {t('featuresPage.readDocs')}
              </TextLink>
            </Reveal>
          </div>
          <Reveal y={30}>
            <Photo
              src="/photos/workspace.webp"
              alt=""
              className="aspect-[4/3.2] rounded-[28px] shadow-panel-lg"
            />
          </Reveal>
        </div>
      </Section>

      {/* -------------------------------------------------------- CTA */}
      <Section tone="deep" wide>
        <Reveal className="text-center max-w-2xl mx-auto">
          <h2 className="text-[32px] sm:text-[44px] font-bold tracking-[-0.04em] leading-[1.06] text-white text-balance">
            {t('landing.home.ctaTitle')}
          </h2>
          <p className="mt-5 text-[16.5px] leading-relaxed text-gray-400">{t('landing.home.ctaDesc')}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button to={routes.register} size="lg" arrow>
              {t('landing.home.ctaBtn1')}
            </Button>
            <Button
              to={routes.pricing}
              size="lg"
              className="bg-white/10 text-white border border-white/20 hover:bg-white/[0.16] shadow-none"
            >
              {t('landing.home.ctaBtn2')}
            </Button>
          </div>
        </Reveal>
      </Section>
    </Shell>
  );
};

export default Features;
