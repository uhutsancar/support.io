/**
 * Özellikler sayfası.
 *
 * Eski sayfa on bir maddeyi tek bir düz ızgaraya diziyordu: hepsi aynı
 * boyutta, aynı renkte, aynı sırada. Hangi maddenin hangi işe yaradığını
 * ancak hepsini okuyan anlayabiliyordu. Artık üç iş başlığı altında
 * gruplanıyor, her grubun kendi rengi ve kendi ürün görseli var.
 *
 * Her karttaki metin `plain` anahtarından gelir — teknik özet değil, ne işe
 * yaradığı. Teknik karşılığı detay sayfasındaki "teknik not" bloğunda.
 */

import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
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
  ArrowUpRight,
  Check
} from 'lucide-react';
import Shell, { PageHero, useMarketingRoutes } from '../components/marketing/Shell';
import {
  Button,
  TextLink,
  Section,
  SectionHead,
  Card,
  AccentIcon,
  Pill,
  AppFrame,
  accent,
  asList
} from '../components/marketing/kit';
import { InboxVisual, AnalyticsVisual, AutomationVisual } from '../components/marketing/visuals';
import { FEATURE_GROUPS, FEATURE_ICON, FEATURE_PLAN, FEATURE_TONE } from './marketing/features';

const ICONS = {
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

const PLAN_BADGE = { all: null, pro: 'Pro', enterprise: 'Enterprise' };

/** Grup başına tanıtım görseli. */
const GROUP_VISUAL = {
  talk: (t: any) => (
    <AppFrame label={t('viz.inbox.frame')}>
      <InboxVisual compact />
    </AppFrame>
  ),
  organize: (t: any) => (
    <AppFrame label={t('viz.automation.frame')} tone="emerald">
      <AutomationVisual />
    </AppFrame>
  ),
  grow: (t: any) => (
    <AppFrame label={t('viz.analytics.frame')} tone="sky">
      <AnalyticsVisual />
    </AppFrame>
  )
};

const FeatureCard = ({
  id,
  routes,
  t
}: {
  id?: string;
  routes?: any;
  t?: any;
  [prop: string]: any;
}) => {
  const Icon =
    ICONS[FEATURE_ICON[id as keyof typeof FEATURE_ICON] as keyof typeof ICONS] || MessageSquare;
  const badge =
    PLAN_BADGE[FEATURE_PLAN[id as keyof typeof FEATURE_PLAN] as keyof typeof PLAN_BADGE];
  const tone = FEATURE_TONE[id as keyof typeof FEATURE_TONE];

  return (
    <Link
      to={routes.features + '/' + id}
      className="group block h-full focus:outline-none focus-visible:ring-2
        focus-visible:ring-indigo-500 focus-visible:ring-offset-4 rounded-2xl
        dark:focus-visible:ring-offset-gray-950"
    >
      <Card hover className="h-full p-5 flex flex-col">
        <div className="flex items-start justify-between gap-3">
          <AccentIcon icon={Icon} tone={tone} />
          {badge && <Pill>{badge}</Pill>}
        </div>

        <h3 className="mt-4 flex items-center gap-1.5 text-[16px] font-semibold text-gray-900 dark:text-white">
          {t('featuresPage.items.' + id + '.title')}
          <ArrowUpRight
            className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all
            group-hover:opacity-60 group-hover:translate-x-0"
          />
        </h3>
        <p className="mt-2 text-[14px] leading-[1.6] text-gray-600 dark:text-gray-400 flex-1">
          {t('featuresPage.items.' + id + '.plain')}
        </p>
        <p className={['mt-4 text-[12.5px] font-medium', accent(tone).text].join(' ')}>
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
      >
        <div className="mt-9 flex flex-wrap gap-3">
          <Button to={routes.register} size="lg" arrow>
            {t('landing.home.btnStart')}
          </Button>
          <Button to={routes.pricing} variant="secondary" size="lg">
            {t('landing.home.ctaBtn2')}
          </Button>
        </div>
      </PageHero>

      {/* -------------------------------------------------- gruplar */}
      {FEATURE_GROUPS.map((group, gi) => (
        <Section key={group.id} tone={gi % 2 === 0 ? 'plain' : 'subtle'} bordered>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 lg:gap-16 items-center">
            <div className={gi % 2 === 1 ? 'lg:order-2' : ''}>
              <SectionHead
                eyebrow={t('nav.groups.' + group.id)}
                eyebrowTone={group.tone}
                title={t('featuresPage.groups.' + group.id + '.title')}
                description={t('featuresPage.groups.' + group.id + '.desc')}
              />
              <ul className="mt-7 space-y-3">
                {asList(
                  t('featuresPage.groups.' + group.id + '.points', { returnObjects: true })
                ).map((p, i) => (
                  <li key={i} className="flex gap-2.5">
                    <Check
                      className={['w-4 h-4 mt-1 shrink-0', accent(group.tone).text].join(' ')}
                    />
                    <span className="text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                      {p}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={gi % 2 === 1 ? 'lg:order-1' : ''}>
              {GROUP_VISUAL[group.id as keyof typeof GROUP_VISUAL]?.(t)}
            </div>
          </div>

          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {group.items.map((id, _i) => (
              <div key={id}>
                <FeatureCard id={id} routes={routes} t={t} />
              </div>
            ))}
          </div>
        </Section>
      ))}

      {/* ------------------------------------------------- kurulum tarafı */}
      <Section bordered>
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-10 lg:gap-16 items-start">
          <SectionHead
            eyebrow={t('featuresPage.devEyebrow')}
            eyebrowTone="violet"
            title={t('featuresPage.devTitle')}
            description={t('featuresPage.devDesc')}
          />

          <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
            {['embed', 'sdk', 'isolation', 'control'].map((item) => (
              <div key={item}>
                <h3 className="text-[15.5px] font-semibold text-gray-900 dark:text-white">
                  {t('featuresPage.dev.' + item + '.title')}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {t('featuresPage.dev.' + item + '.body')}
                </p>
              </div>
            ))}
            <div className="sm:col-span-2">
              <TextLink to={routes.docs} tone="violet">
                {t('featuresPage.readDocs')}
              </TextLink>
            </div>
          </div>
        </div>
      </Section>

      {/* -------------------------------------------------------- CTA */}
      <Section tone="subtle" bordered>
        <div className="text-center max-w-2xl mx-auto">
          <h2
            className="text-[30px] sm:text-[36px] font-semibold tracking-[-0.03em]
            leading-[1.12] text-gray-900 dark:text-white"
          >
            {t('landing.home.ctaTitle')}
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-gray-600 dark:text-gray-400">
            {t('landing.home.ctaDesc')}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button to={routes.register} size="lg" arrow>
              {t('landing.home.ctaBtn1')}
            </Button>
            <Button to={routes.pricing} variant="secondary" size="lg">
              {t('landing.home.ctaBtn2')}
            </Button>
          </div>
        </div>
      </Section>
    </Shell>
  );
};

export default Features;
