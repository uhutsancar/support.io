/**
 * Sektör çözümü sayfası (`/cozumler/:slug`, `/en/solutions/:slug`).
 *
 * Aynı ürünü bir sektörün kendi sorularıyla anlatır: önce tanıdık dertler,
 * sonra o sektörde işi taşıyan dört özelliğin sektöre özel anlatımı ve
 * panelden kesiti, sonra ne değiştiği. İçerik `solutions.items.<id>`
 * altında; hangi özelliklerin anlatılacağı `SOLUTIONS[].features`'ta.
 */

import { Helmet } from 'react-helmet-async';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, Check } from 'lucide-react';
import Shell, { useMarketingRoutes, featureIcon, SOLUTION_ICONS } from '../components/marketing/Shell';
import {
  AppFrame,
  Button,
  Card,
  Eyebrow,
  Photo,
  Reveal,
  Section,
  SectionHead,
  TextLink,
  accent,
  asList
} from '../components/marketing/kit';
import { FEATURE_VISUAL, WidgetVisual } from '../components/marketing/visuals';
import { FEATURE_TONE, SOLUTIONS } from './marketing/features';
import ChatPlayer from '../components/marketing/ChatPlayer';

const FeatureVisual = ({ id, t }: { id: string; t: (k: string) => string }) => {
  // Çözüm sayfalarında asistan ziyaretçi tarafıyla anlatılır (sipariş, devir);
  // temsilci yardımcısı ekranı bu anlatımla örtüşmüyordu.
  if (id === 'ai-assist')
    return (
      <div className="mx-auto max-w-[360px]">
        <ChatPlayer script="story" height={330} />
      </div>
    );
  const Visual = FEATURE_VISUAL[id as keyof typeof FEATURE_VISUAL];
  if (!Visual) return null;
  if (Visual === WidgetVisual)
    return (
      <div className="flex justify-center py-8 rounded-3xl bg-gradient-to-br from-[#f3f4ff] to-[#faf8f4] dark:from-white/[0.03] dark:to-transparent">
        <WidgetVisual />
      </div>
    );
  return (
    <AppFrame label={t('featuresPage.items.' + id + '.title')} tone={FEATURE_TONE[id as keyof typeof FEATURE_TONE]}>
      <Visual />
    </AppFrame>
  );
};

const Solution = () => {
  const { slug = '' } = useParams<{ slug: string }>();
  const { t } = useTranslation();
  const routes = useMarketingRoutes();
  const solution = SOLUTIONS.find((s) => s.id === slug);

  // Bilinmeyen sektör: ilk çözüme değil, ana sayfadaki sektör listesine dön.
  if (!solution) return <Navigate to={routes.home} replace />;

  const key = (suffix: string) => 'solutions.items.' + solution.id + '.' + suffix;
  const pains = asList<{ title: string; body: string }>(t(key('pains'), { returnObjects: true }));
  const uses = asList<{ title: string; body: string }>(t(key('uses'), { returnObjects: true }));
  const wins = asList<{ label: string; body: string }>(t(key('wins'), { returnObjects: true }));
  const Icon = SOLUTION_ICONS[solution.icon];
  const a = accent(solution.tone);
  const others = SOLUTIONS.filter((s) => s.id !== solution.id);

  return (
    <Shell>
      <Helmet>
        <title>{t(key('name')) + ' — Support.io'}</title>
        <meta name="description" content={t(key('desc'))} />
      </Helmet>

      {/* ------------------------------------------------------------ hero */}
      <section className="pt-32 sm:pt-40 pb-16 sm:pb-24 px-5 sm:px-8 bg-gradient-to-b from-[#eef0ff] via-[#f6f5ff] to-white dark:from-[#10122a] dark:via-surface-dark dark:to-surface-dark">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-12 lg:gap-14 items-center">
          <Reveal>
            <Eyebrow tone={solution.tone}>
              {t('solutions.eyebrow')} / {t(key('name'))}
            </Eyebrow>
            <h1 className="mt-5 text-[38px] sm:text-[56px] font-bold tracking-[-0.042em] leading-[1.03] text-gray-950 dark:text-white text-balance">
              {t(key('headline'))}
            </h1>
            <p className="mt-6 text-[17.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[54ch]">
              {t(key('desc'))}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button to={routes.register} size="lg" arrow>
                {t('landing.home.btnStart')}
              </Button>
              <Button to={routes.pricing} variant="secondary" size="lg">
                {t('landing.home.ctaBtn2')}
              </Button>
            </div>
          </Reveal>

          <Reveal y={30} className="relative">
            <Photo
              src={solution.photo}
              alt={t(key('photoAlt'))}
              eager
              className="aspect-[4/3] rounded-[30px] shadow-panel-lg"
            />
            <div className="absolute -bottom-6 left-4 sm:-left-6 max-w-[290px] rounded-2xl bg-white/95 dark:bg-[#171a29]/95 backdrop-blur border border-gray-200/80 dark:border-white/10 shadow-panel-lg p-4">
              <span className="flex items-center gap-2">
                {Icon && <Icon className={['w-4 h-4', a.text].join(' ')} strokeWidth={1.9} />}
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
                  {t(key('name'))}
                </span>
              </span>
              <p className="mt-1.5 text-[13.5px] font-medium leading-snug text-gray-900 dark:text-white">
                {t(key('tag'))}
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------- dertler */}
      <Section tone="plain" wide>
        <SectionHead index={1} eyebrow={t(key('name'))} eyebrowTone="rose" title={t('solutions.painsTitle')} />
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {pains.map((p, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <Card className="p-6 h-full">
                <AlertCircle className="w-5 h-5 text-rose-500" strokeWidth={1.8} />
                <h3 className="mt-4 text-[16.5px] font-semibold text-gray-950 dark:text-white">{p.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">{p.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------ nasıl çalışır */}
      <Section tone="mist" wide>
        <SectionHead index={2} eyebrow={t(key('name'))} title={t('solutions.usesTitle')} />
        <div className="mt-14 space-y-20 sm:space-y-24">
          {uses.map((u, i) => {
            const id = solution.features[i];
            if (!id) return null;
            const FIcon = featureIcon(id);
            const tone = FEATURE_TONE[id as keyof typeof FEATURE_TONE];
            const flip = i % 2 === 1;
            return (
              <div key={id} className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                <Reveal className={flip ? 'lg:order-2' : ''}>
                  <span className="inline-flex items-center gap-2">
                    <span className={['inline-flex w-9 h-9 items-center justify-center rounded-xl border bg-white dark:bg-transparent', accent(tone).border].join(' ')}>
                      <FIcon className={['w-[18px] h-[18px]', accent(tone).text].join(' ')} strokeWidth={1.8} />
                    </span>
                    <Eyebrow tone={tone}>{t('featuresPage.items.' + id + '.title')}</Eyebrow>
                  </span>
                  <h3 className="mt-5 text-[26px] sm:text-[32px] font-bold tracking-[-0.03em] leading-[1.12] text-gray-950 dark:text-white max-w-[20ch]">
                    {u.title}
                  </h3>
                  <p className="mt-4 text-[16px] leading-[1.7] text-gray-600 dark:text-gray-400 max-w-[50ch]">
                    {u.body}
                  </p>
                  <TextLink to={routes.features + '/' + id} tone={tone} className="mt-6">
                    {t('solutions.featureLink')}
                  </TextLink>
                </Reveal>
                <Reveal y={30} delay={0.08} className={flip ? 'lg:order-1' : ''}>
                  <FeatureVisual id={id} t={t} />
                </Reveal>
              </div>
            );
          })}
        </div>
      </Section>

      {/* --------------------------------------------------- kazanımlar */}
      <Section tone="plain" wide>
        <SectionHead index={3} eyebrow={t('solutions.winsTitle')} eyebrowTone="emerald" title={t('landing.home.ctaTitle')} />
        <div className="mt-10 grid md:grid-cols-3 gap-4">
          {wins.map((w, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <Card className="p-6 h-full">
                <span className="inline-flex w-8 h-8 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                  <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" strokeWidth={2.4} />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-gray-950 dark:text-white">{w.label}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">{w.body}</p>
              </Card>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10 flex flex-wrap gap-3">
          <Button to={routes.register} arrow>
            {t('landing.home.ctaBtn1')}
          </Button>
          <Button to={routes.ai} variant="secondary">
            {t('homePage.ai.cta')}
          </Button>
        </Reveal>
      </Section>

      {/* ------------------------------------------------ diğer sektörler */}
      <Section tone="cream" wide size="sm">
        <Reveal>
          <Eyebrow>{t('solutions.othersTitle')}</Eyebrow>
        </Reveal>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-3">
          {others.map((s, i) => (
            <Reveal key={s.id} delay={i * 0.04}>
              <Link to={routes.solutions + '/' + s.id} className="group block">
                <Photo
                  src={s.photo}
                  alt=""
                  className="aspect-[4/3] rounded-2xl"
                  imgClassName="transition-transform duration-500 group-hover:scale-105"
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
                  <span className="absolute left-3 bottom-3 right-3 flex items-center justify-between text-[13px] font-semibold text-white">
                    {t('solutions.items.' + s.id + '.name')}
                    <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                  </span>
                </Photo>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>
    </Shell>
  );
};

export default Solution;
