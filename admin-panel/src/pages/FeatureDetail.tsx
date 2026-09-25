/**
 * Tek bir özelliğin detay sayfası.
 *
 * Slug sabit bir kimliktir (`FEATURE_IDS`); başlıktan türetilmez, dil ya da
 * başlık değişince bağlantı kırılmaz.
 *
 * Anlatım sırası: ne işe yaradığı ve ürünün o ekranı, somut kazanımlar,
 * kurulum adımları, en altta kapalı bir "teknik not". Teknik metin satın
 * alanın önüne çıkmaz; merak eden açar.
 */

import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight, Check, Plus, Terminal } from 'lucide-react';
import Shell, { useMarketingRoutes, featureIcon } from '../components/marketing/Shell';
import {
  Button,
  TextLink,
  Section,
  SectionHead,
  Card,
  Chip,
  Eyebrow,
  Reveal,
  AppFrame,
  accent,
  asList
} from '../components/marketing/kit';
import { FEATURE_VISUAL, WidgetVisual } from '../components/marketing/visuals';
import ChatPlayer from '../components/marketing/ChatPlayer';
import {
  FEATURE_IDS,
  FEATURE_PLAN,
  FEATURE_TONE,
  PLAN_LABEL,
  FEATURE_GROUPS
} from './marketing/features';

/** Widget görseli kendi kabuğunu taşır; diğerleri panel penceresine girer. */
const renderVisual = (slug: string, t: (k: string) => string) => {
  if (slug === 'ai-assist') {
    return (
      <div className="mx-auto max-w-[380px]">
        <ChatPlayer script="ai" height={380} />
      </div>
    );
  }
  const Visual = FEATURE_VISUAL[slug as keyof typeof FEATURE_VISUAL];
  if (!Visual) return null;
  if (Visual === WidgetVisual) {
    return (
      <div className="flex justify-center py-8 rounded-3xl bg-white/70 dark:bg-white/[0.03] border border-gray-200/80 dark:border-white/[0.08]">
        <WidgetVisual />
      </div>
    );
  }
  return (
    <AppFrame label={t('featuresPage.items.' + slug + '.title')} tone={FEATURE_TONE[slug as keyof typeof FEATURE_TONE]}>
      <Visual />
    </AppFrame>
  );
};

const NotFound = ({ t, to }: { t: (k: string) => string; to: string }) => (
  <Shell>
    <Helmet>
      <title>{t('featuresPage.notFound.title') + ' — Support.io'}</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <div className="pt-44 pb-28 px-5 sm:px-8">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-[28px] font-bold text-gray-950 dark:text-white">{t('featuresPage.notFound.title')}</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
          {t('featuresPage.notFound.body')}
        </p>
        <Button to={to} className="mt-7">
          <ArrowLeft className="w-4 h-4" /> {t('featuresPage.backToList')}
        </Button>
      </div>
    </div>
  </Shell>
);

const FeatureDetail = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const routes = useMarketingRoutes();
  const lang = i18n.language === 'en' ? 'en' : 'tr';

  if (!FEATURE_IDS.includes(slug)) return <NotFound t={t} to={routes.features} />;

  const Icon = featureIcon(slug);
  const tone = FEATURE_TONE[slug as keyof typeof FEATURE_TONE];
  const a = accent(tone);
  const plan = FEATURE_PLAN[slug as keyof typeof FEATURE_PLAN];

  const key = (suffix: string) => 'featuresPage.items.' + slug + '.' + suffix;
  const benefits = asList<string>(t(key('benefits'), { returnObjects: true }));
  const steps = asList<{ title: string; body: string }>(t(key('steps'), { returnObjects: true }));
  const points = asList<string>(t(key('points'), { returnObjects: true }));

  // Aynı gruptaki diğer özellikler — sayfa çıkmaz sokak olmasın.
  const group = FEATURE_GROUPS.find((g) => g.items.includes(slug));
  const siblings = (group?.items || []).filter((id) => id !== slug).slice(0, 3);
  const next = FEATURE_IDS[(FEATURE_IDS.indexOf(slug) + 1) % FEATURE_IDS.length];

  return (
    <Shell>
      <Helmet>
        <title>{t(key('title')) + ' — Support.io'}</title>
        <meta name="description" content={t(key('plain'))} />
      </Helmet>

      {/* ------------------------------------------------------------ hero */}
      <section className="pt-32 sm:pt-36 pb-16 sm:pb-24 px-5 sm:px-8 bg-gradient-to-b from-[#eef0ff] via-[#f6f5ff] to-white dark:from-[#10122a] dark:via-surface-dark dark:to-surface-dark">
        <div className="max-w-7xl mx-auto">
          <Link
            to={routes.features}
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('featuresPage.backToList')}
          </Link>

          <div className="mt-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-12 lg:gap-16 items-center">
            <Reveal>
              <div className="flex items-center gap-3">
                <span className={['inline-flex w-11 h-11 items-center justify-center rounded-2xl border bg-white dark:bg-transparent', a.border].join(' ')}>
                  <Icon className={['w-[22px] h-[22px]', a.text].join(' ')} strokeWidth={1.8} />
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <Chip>{PLAN_LABEL[plan as keyof typeof PLAN_LABEL][lang]}</Chip>
                  <Chip tone={tone}>{t(key('setup'))}</Chip>
                </div>
              </div>
              <h1 className="mt-6 text-[38px] sm:text-[56px] font-bold tracking-[-0.042em] leading-[1.03] text-gray-950 dark:text-white max-w-[16ch] text-balance">
                {t(key('title'))}
              </h1>
              <p className="mt-6 text-[17.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[52ch]">
                {t(key('plain'))}
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Button to={routes.register} size="lg" arrow>
                  {t('landing.home.btnStart')}
                </Button>
                {slug === 'ai-assist' ? (
                  <Button to={routes.ai} variant="secondary" size="lg">
                    {t('homePage.ai.cta')}
                  </Button>
                ) : (
                  <Button to={routes.pricing} variant="secondary" size="lg">
                    {t('landing.home.ctaBtn2')}
                  </Button>
                )}
              </div>
            </Reveal>
            <Reveal y={30} delay={0.08}>
              {renderVisual(slug, t)}
            </Reveal>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- kazanımlar */}
      {benefits.length > 0 && (
        <Section tone="plain" wide>
          <SectionHead index={1} eyebrow={t('featuresPage.benefitsTitle')} eyebrowTone={tone} title={t(key('short'))} />
          <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {benefits.map((b, i) => (
              <Reveal key={i} delay={i * 0.06}>
                <Card className="h-full p-6">
                  <span className={['inline-flex w-8 h-8 items-center justify-center rounded-full', a.soft].join(' ')}>
                    <Check className={['w-4 h-4', a.text].join(' ')} strokeWidth={2.4} />
                  </span>
                  <p className="mt-4 text-[15px] leading-relaxed font-medium text-gray-800 dark:text-gray-200">{b}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------ nasıl kurulur */}
      {steps.length > 0 && (
        <Section tone="mist" wide>
          <div className="grid lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] gap-10 lg:gap-16">
            <SectionHead index={2} eyebrow={t(key('title'))} eyebrowTone={tone} title={t('featuresPage.howTitle')} description={t('featuresPage.howDesc')} />
            <ol className="relative space-y-4">
              {steps.map((s, i) => (
                <Reveal as="li" key={i} delay={i * 0.08}>
                  <Card className="p-6 flex gap-5">
                    <span className={['text-[28px] font-bold tabular-nums leading-none tracking-[-0.04em]', a.text].join(' ')}>
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="block text-[16px] font-semibold text-gray-950 dark:text-white">{s.title}</span>
                      <span className="block mt-1.5 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">{s.body}</span>
                    </span>
                  </Card>
                </Reveal>
              ))}
            </ol>
          </div>
        </Section>
      )}

      {/* --------------------------------------------------------- teknik not */}
      <Section tone="plain" size="sm" wide>
        <details className="group max-w-4xl rounded-2xl border border-gray-200 dark:border-white/[0.08] px-6 py-5">
          <summary className="flex items-center gap-2.5 cursor-pointer list-none text-[14.5px] font-medium text-gray-700 dark:text-gray-300 hover:text-gray-950 dark:hover:text-white transition">
            <Terminal className="w-4 h-4 text-gray-400" />
            {t('featuresPage.techTitle')}
            <Plus className="ml-auto w-4 h-4 text-gray-400 transition-transform group-open:rotate-45" />
          </summary>
          <div className="mt-5 pl-6">
            <p className="text-[14.5px] leading-[1.75] text-gray-600 dark:text-gray-400 max-w-[70ch]">{t(key('body'))}</p>
            {points.length > 0 && (
              <ul className="mt-5 space-y-2.5">
                {points.map((p, i) => (
                  <li key={i} className="flex gap-2.5">
                    <span className="w-1 h-1 mt-2.5 rounded-full bg-gray-400 shrink-0" />
                    <span className="text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[66ch]">{p}</span>
                  </li>
                ))}
              </ul>
            )}
            <TextLink to={routes.docs} className="mt-6">
              {t('featuresPage.readDocs')}
            </TextLink>
          </div>
        </details>
      </Section>

      {/* ------------------------------------------------------- ilgili olanlar */}
      <Section tone="cream" wide>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <Reveal>
            <Eyebrow>{t('nav.groups.' + (group?.id || 'talk'))}</Eyebrow>
            <h2 className="mt-3 text-[26px] sm:text-[32px] font-bold tracking-[-0.03em] text-gray-950 dark:text-white">
              {t('featuresPage.moreTitle')}
            </h2>
          </Reveal>
          <TextLink to={routes.features}>{t('featuresPage.backToList')}</TextLink>
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {siblings.map((id, i) => {
            const SIcon = featureIcon(id);
            const st = accent(FEATURE_TONE[id as keyof typeof FEATURE_TONE]);
            return (
              <Reveal key={id} delay={i * 0.06}>
                <Link to={routes.features + '/' + id} className="group block h-full">
                  <Card hover className="h-full p-6">
                    <SIcon className={['w-5 h-5', st.text].join(' ')} strokeWidth={1.8} />
                    <h3 className="mt-4 text-[16px] font-semibold text-gray-950 dark:text-white">
                      {t('featuresPage.items.' + id + '.title')}
                    </h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                      {t('featuresPage.items.' + id + '.short')}
                    </p>
                  </Card>
                </Link>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-white/[0.07]">
          <Link
            to={routes.features + '/' + next}
            className="group inline-flex items-center gap-2 text-[14.5px] font-medium text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white transition"
          >
            {t('featuresPage.nextFeature')}: {t('featuresPage.items.' + next + '.title')}
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Section>
    </Shell>
  );
};

export default FeatureDetail;
