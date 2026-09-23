/**
 * Tek bir özelliğin detay sayfası.
 *
 * Eski sürüm slug'ı BAŞLIKTAN türetiyordu (`slugify(feature.title)`), yani
 * başlık ya da dil değiştiğinde bağlantılar kırılıyor ve sayfa "Özellik
 * bulunamadı" veriyordu. Ayrıca içeriği `dangerouslySetInnerHTML` ile
 * basıyordu ve her özellik için aynı stok fotoğrafı gösteriyordu.
 *
 * Sayfanın anlatım sırası: önce ne işe yaradığı (düz Türkçe) ve ürünün o
 * ekranı, sonra somut kazanımlar, sonra "nasıl kurulur" adımları. Teknik
 * karşılığı en altta KAPALI bir blokta duruyor — merak eden açar, satın alan
 * hiç görmez. Eskiden bu metin sayfanın ilk paragrafıydı ve sayfayı teknik
 * bir belgeye çeviriyordu.
 */

import { Helmet } from 'react-helmet-async';
import { Link, useParams } from 'react-router-dom';
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
  ArrowLeft,
  ArrowRight,
  Check,
  Plus,
  Terminal
} from 'lucide-react';
import Shell, { useMarketingRoutes } from '../components/marketing/Shell';
import {
  Button,
  TextLink,
  Section,
  Card,
  AccentIcon,
  Pill,
  StepNumber,
  AppFrame,
  accent
} from '../components/marketing/kit';
import { FEATURE_VISUAL, WidgetVisual } from '../components/marketing/visuals';
import {
  FEATURE_IDS,
  FEATURE_ICON,
  FEATURE_PLAN,
  FEATURE_TONE,
  PLAN_LABEL,
  FEATURE_GROUPS
} from './marketing/features';

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

/** Widget görseli kendi kabuğunu taşır; diğerleri panel penceresine girer. */
const renderVisual = (slug: string, t: any) => {
  const Visual = FEATURE_VISUAL[slug as keyof typeof FEATURE_VISUAL];
  if (!Visual) return null;
  if (Visual === WidgetVisual) {
    return (
      <div
        className="flex justify-center py-6 rounded-2xl bg-gray-50 dark:bg-white/[0.03]
        border border-gray-200 dark:border-white/[0.08]"
      >
        <WidgetVisual />
      </div>
    );
  }
  return (
    <AppFrame label={t('viz.frameGeneric')} tone={FEATURE_TONE[slug as keyof typeof FEATURE_TONE]}>
      <Visual />
    </AppFrame>
  );
};

const NotFound = ({ t, routes }: { t?: any; routes?: any; [prop: string]: any }) => (
  <Shell>
    <Helmet>
      <title>{t('featuresPage.notFound.title') + ' — Support.io'}</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <div className="pt-44 pb-28 px-5 sm:px-8">
      <div className="max-w-md mx-auto text-center">
        <h1 className="text-[26px] font-semibold text-gray-900 dark:text-white">
          {t('featuresPage.notFound.title')}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-gray-600 dark:text-gray-400">
          {t('featuresPage.notFound.body')}
        </p>
        <Button to={routes.features} className="mt-7">
          <ArrowLeft className="w-4 h-4" /> {t('featuresPage.backToList')}
        </Button>
      </div>
    </div>
  </Shell>
);

const FeatureDetail = () => {
  // The route only matches a slug, but useParams cannot know that.
  const { slug = '' } = useParams<{ slug: string }>();
  const { t, i18n } = useTranslation();
  const routes = useMarketingRoutes();
  const lang = i18n.language === 'en' ? 'en' : 'tr';

  if (!FEATURE_IDS.includes(slug)) return <NotFound t={t} routes={routes} />;

  const Icon =
    ICONS[FEATURE_ICON[slug as keyof typeof FEATURE_ICON] as keyof typeof ICONS] || MessageSquare;
  const tone = FEATURE_TONE[slug as keyof typeof FEATURE_TONE];
  const a = accent(tone);
  const plan = FEATURE_PLAN[slug as keyof typeof FEATURE_PLAN];

  const key = (suffix: string) => 'featuresPage.items.' + slug + '.' + suffix;
  const listOf = (suffix: string) => {
    const v = t(key(suffix), { returnObjects: true });
    return Array.isArray(v) ? v : [];
  };

  const benefits = listOf('benefits');
  const steps = listOf('steps');

  // Aynı gruptaki diğer özellikler — sayfa çıkmaz sokak olmasın.
  const group = FEATURE_GROUPS.find((g) => g.items.includes(slug));
  const siblings = (group?.items || []).filter((id) => id !== slug).slice(0, 3);

  const index = FEATURE_IDS.indexOf(slug);
  const next = FEATURE_IDS[(index + 1) % FEATURE_IDS.length];

  return (
    <Shell>
      <Helmet>
        <title>{t(key('title')) + ' — Support.io'}</title>
        <meta name="description" content={t(key('plain'))} />
      </Helmet>

      {/* ------------------------------------------------------------ hero */}
      <section className="pt-32 sm:pt-36 pb-14 px-5 sm:px-8">
        <div className="max-w-6xl mx-auto">
          <Link
            to={routes.features}
            className="inline-flex items-center gap-1.5 text-[13.5px] text-gray-500 dark:text-gray-400
              hover:text-gray-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> {t('featuresPage.backToList')}
          </Link>

          <div className="mt-7 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-10 lg:gap-16 items-center">
            <div>
              <div className="flex items-center gap-2.5">
                <AccentIcon icon={Icon} tone={tone} size="lg" />
                <div className="flex flex-wrap gap-1.5">
                  <Pill>{PLAN_LABEL[plan as keyof typeof PLAN_LABEL][lang]}</Pill>
                  <Pill>{t(key('setup'))}</Pill>
                </div>
              </div>

              <h1
                className="mt-6 text-[34px] sm:text-[46px] font-semibold tracking-[-0.035em]
                leading-[1.07] text-gray-900 dark:text-white max-w-[17ch]"
              >
                {t(key('title'))}
              </h1>
              <p className="mt-5 text-[17.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[52ch]">
                {t(key('plain'))}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button to={routes.register} arrow>
                  {t('landing.home.btnStart')}
                </Button>
                <Button to={routes.pricing} variant="secondary">
                  {t('landing.home.ctaBtn2')}
                </Button>
              </div>
            </div>

            <div>{renderVisual(slug, t)}</div>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- kazanımlar */}
      {benefits.length > 0 && (
        <Section tone="subtle" bordered size="sm">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.09em] text-gray-400 dark:text-gray-500">
            {t('featuresPage.benefitsTitle')}
          </h2>
          <div className="mt-7 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
            {benefits.map((b, i) => (
              <div key={i}>
                <div className="flex gap-2.5">
                  <Check className={['w-4 h-4 mt-1 shrink-0', a.text].join(' ')} />
                  <span className="text-[14.5px] leading-relaxed text-gray-700 dark:text-gray-300">
                    {b}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------ nasıl kurulur */}
      {steps.length > 0 && (
        <Section bordered>
          <div className="grid lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] gap-10 lg:gap-16">
            <div>
              <h2
                className="text-[27px] sm:text-[32px] font-semibold tracking-[-0.028em]
                leading-[1.15] text-gray-900 dark:text-white max-w-[16ch]"
              >
                {t('featuresPage.howTitle')}
              </h2>
              <p className="mt-4 text-[15.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[44ch]">
                {t('featuresPage.howDesc')}
              </p>
            </div>

            <ol className="space-y-7">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <StepNumber n={i + 1} tone={tone} />
                  <div className="pt-1.5">
                    <p className="text-[15.5px] font-semibold text-gray-900 dark:text-white">
                      {s.title}
                    </p>
                    <p className="mt-1.5 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[56ch]">
                      {s.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Section>
      )}

      {/* --------------------------------------------------------- teknik not */}
      <Section tone="subtle" bordered size="sm">
        <details className="group max-w-4xl">
          <summary
            className="flex items-center gap-2.5 cursor-pointer list-none
            text-[14.5px] font-medium text-gray-700 dark:text-gray-300
            hover:text-gray-900 dark:hover:text-white transition"
          >
            <Terminal className="w-4 h-4 text-gray-400" />
            {t('featuresPage.techTitle')}
            <Plus className="w-4 h-4 text-gray-400 transition-transform group-open:rotate-45" />
          </summary>
          <div className="mt-5 pl-7">
            <p className="text-[14.5px] leading-[1.75] text-gray-600 dark:text-gray-400 max-w-[70ch]">
              {t(key('body'))}
            </p>
            <ul className="mt-5 space-y-2.5">
              {listOf('points').map((p, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-1 h-1 mt-2.5 rounded-full bg-gray-400 shrink-0" />
                  <span className="text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[66ch]">
                    {p}
                  </span>
                </li>
              ))}
            </ul>
            <TextLink to={routes.docs} className="mt-6">
              {t('featuresPage.readDocs')}
            </TextLink>
          </div>
        </details>
      </Section>

      {/* ------------------------------------------------------- ilgili olanlar */}
      <Section bordered>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.025em] text-gray-900 dark:text-white">
            {t('featuresPage.moreTitle')}
          </h2>
          <TextLink to={routes.features}>{t('featuresPage.backToList')}</TextLink>
        </div>

        <div className="mt-8 grid sm:grid-cols-3 gap-4">
          {siblings.map((id) => {
            const SiblingIcon =
              ICONS[FEATURE_ICON[id as keyof typeof FEATURE_ICON] as keyof typeof ICONS] ||
              MessageSquare;
            return (
              <Link key={id} to={routes.features + '/' + id} className="group block h-full">
                <Card hover className="h-full p-5">
                  <AccentIcon
                    icon={SiblingIcon}
                    tone={FEATURE_TONE[id as keyof typeof FEATURE_TONE]}
                  />
                  <h3 className="mt-4 text-[15.5px] font-semibold text-gray-900 dark:text-white">
                    {t('featuresPage.items.' + id + '.title')}
                  </h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                    {t('featuresPage.items.' + id + '.short')}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="mt-10 pt-6 border-t border-gray-200 dark:border-white/[0.07]">
          <Link
            to={routes.features + '/' + next}
            className="group inline-flex items-center gap-2 text-[14.5px] text-gray-600 dark:text-gray-400
              hover:text-gray-900 dark:hover:text-white transition"
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
