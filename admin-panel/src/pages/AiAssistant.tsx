/**
 * Yapay zekâ asistanı — pazarlama sayfası.
 *
 * Asistanın ne yaptığını alıcının diliyle anlatır: anında yanıt, sizin SSS
 * içeriğinize dayanması, bilmediğini ekibe devretmesi, müşteri verisinin
 * korunması ve planlara göre farkı. Sağlayıcı, model ya da başka teknik
 * ayrıntı burada geçmez (ürün kararı). Plan rakamları GET /api/plans'tan
 * gelir; sayfada elle yazılmış sınır yoktur.
 */

import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Zap,
  Moon,
  BookOpenCheck,
  UserRoundCog,
  Hand,
  BarChart3,
  ShieldCheck,
  Sparkles,
  Store,
  Rocket,
  Building2
} from 'lucide-react';
import Shell, { useMarketingRoutes } from '../components/marketing/Shell';
import {
  Accordion,
  AppFrame,
  Button,
  Card,
  Reveal,
  Section,
  SectionHead,
  StepNumber,
  TextLink,
  asList
} from '../components/marketing/kit';
import ChatPlayer from '../components/marketing/ChatPlayer';
import { AssistantVisual } from '../components/marketing/visuals';
import { usePlans } from '../hooks/usePlans';

const BENEFIT_ICONS = [Zap, Moon, BookOpenCheck, UserRoundCog, Hand, BarChart3];
const PLAN_ICONS = { FREE: Store, PRO: Rocket, ENTERPRISE: Building2 } as const;

const AiAssistant = () => {
  const { t, i18n } = useTranslation();
  const routes = useMarketingRoutes();
  const { plans } = usePlans();
  const number = new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'tr-TR');

  const heroPoints = asList<string>(t('aiPage.heroPoints', { returnObjects: true }));
  const how = asList<{ title: string; body: string }>(t('aiPage.how', { returnObjects: true }));
  const benefits = asList<{ title: string; body: string }>(
    t('aiPage.benefits', { returnObjects: true })
  );
  const control = asList<string>(t('aiPage.controlPoints', { returnObjects: true }));
  const trust = asList<string>(t('aiPage.trust', { returnObjects: true }));
  const faq = asList<{ q: string; a: string }>(t('aiPage.faq', { returnObjects: true }));

  return (
    <Shell>
      <Helmet>
        <title>{t('aiPage.meta.title') + ' — Support.io'}</title>
        <meta name="description" content={t('aiPage.meta.description')} />
      </Helmet>

      {/* ------------------------------------------------------------ hero */}
      <section className="pt-32 pb-20 sm:pt-40 sm:pb-24 px-5 sm:px-8 bg-gradient-to-b from-[#f3f0ff] via-[#f8f6ff] to-white dark:from-[#15112a] dark:via-surface-dark dark:to-surface-dark">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] gap-12 lg:gap-14 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">
              <Sparkles className="w-3.5 h-3.5" /> {t('aiPage.eyebrow')}
            </span>
            <h1 className="mt-4 text-[38px] sm:text-[56px] font-bold tracking-[-0.04em] leading-[1.04] text-gray-950 dark:text-white text-balance">
              {t('aiPage.title')}
            </h1>
            <p className="mt-6 text-[17.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[56ch] text-pretty">
              {t('aiPage.desc')}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button to={routes.register} size="lg" arrow>
                {t('aiPage.ctaPrimary')}
              </Button>
              <Button to={routes.pricing} variant="secondary" size="lg">
                {t('aiPage.ctaSecondary')}
              </Button>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2">
              {heroPoints.map((point) => (
                <li
                  key={point}
                  className="flex items-center gap-1.5 text-[13.5px] text-gray-600 dark:text-gray-400"
                >
                  <Check className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />{' '}
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <Reveal y={30}>
            <div className="mx-auto max-w-[380px]">
              <ChatPlayer script="hero" height={300} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---------------------------------------------------- nasıl çalışır */}
      <Section tone="plain">
        <SectionHead
          eyebrow={t('aiPage.howEyebrow')}
          eyebrowTone="violet"
          title={t('aiPage.howTitle')}
          align="center"
        />
        <ol className="mt-12 grid md:grid-cols-3 gap-4">
          {how.map((step, i) => (
            <Reveal key={step.title} delay={i * 0.06} as="li">
              <Card className="p-6 h-full">
                <StepNumber n={i + 1} tone="violet" />
                <h3 className="mt-5 text-[17px] font-semibold text-gray-950 dark:text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {step.body}
                </p>
              </Card>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* ------------------------------------------------------- kazanımlar */}
      <Section tone="mist">
        <SectionHead
          eyebrow={t('aiPage.benefitsEyebrow')}
          eyebrowTone="violet"
          title={t('aiPage.benefitsTitle')}
        />
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {benefits.map((benefit, i) => {
            const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
            return (
              <Reveal key={benefit.title} delay={i * 0.04}>
                <Card className="p-6 h-full">
                  <span className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center">
                    <Icon
                      className="w-5 h-5 text-violet-600 dark:text-violet-300"
                      strokeWidth={1.8}
                    />
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold text-gray-950 dark:text-white">
                    {benefit.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                    {benefit.body}
                  </p>
                </Card>
              </Reveal>
            );
          })}
        </div>
      </Section>

      {/* ---------------------------------------------------- kontrol sizde */}
      <Section tone="plain" wide>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <SectionHead
              eyebrow={t('aiPage.controlEyebrow')}
              eyebrowTone="violet"
              title={t('aiPage.controlTitle')}
              description={t('aiPage.controlDesc')}
            />
            <ul className="mt-8 space-y-3">
              {control.map((point) => (
                <li
                  key={point}
                  className="flex gap-2.5 text-[15px] text-gray-700 dark:text-gray-300"
                >
                  <Check className="w-5 h-5 mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" />{' '}
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <Reveal y={30}>
            <AppFrame label={t('viz.assistant.frame')} tone="violet">
              <AssistantVisual />
            </AppFrame>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------------------ güven */}
      <Section tone="deep">
        <div className="grid lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-16 items-start">
          <Reveal>
            <span className="block text-[11.5px] font-semibold uppercase tracking-[0.16em] text-violet-300">
              {t('aiPage.trustEyebrow')}
            </span>
            <h2 className="mt-4 text-[30px] sm:text-[40px] font-bold tracking-[-0.035em] leading-[1.08] text-white text-balance">
              {t('aiPage.trustTitle')}
            </h2>
          </Reveal>
          <ul className="grid sm:grid-cols-2 gap-3">
            {trust.map((item, i) => (
              <Reveal key={item} delay={i * 0.05} as="li">
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 flex gap-3">
                  <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-400" />
                  <span className="text-[14.5px] leading-relaxed text-gray-300">{item}</span>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </Section>

      {/* ----------------------------------------------------------- planlar */}
      <Section tone="plain">
        <SectionHead
          eyebrow={t('aiPage.plansEyebrow')}
          eyebrowTone="violet"
          title={t('aiPage.plansTitle')}
          description={t('aiPage.plansDesc')}
          align="center"
        />
        <div className="mt-12 grid md:grid-cols-3 gap-4 min-h-[200px]">
          {(plans ?? []).map((plan, i) => {
            const Icon = PLAN_ICONS[plan.type];
            return (
              <Reveal key={plan.type} delay={i * 0.06}>
                <Card
                  className={[
                    'p-6 h-full',
                    plan.type === 'ENTERPRISE'
                      ? 'ring-2 ring-violet-500 border-transparent dark:border-transparent'
                      : ''
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon
                      className="w-5 h-5 text-violet-600 dark:text-violet-400"
                      strokeWidth={1.8}
                    />
                    <span className="text-[15px] font-semibold text-gray-950 dark:text-white">
                      {t('pricingPage.plans.' + plan.type.toLowerCase() + '.name')}
                    </span>
                  </div>
                  <p className="mt-4 text-[26px] font-bold tracking-[-0.02em] text-gray-950 dark:text-white tabular-nums">
                    {t('aiPage.perMonth', { n: number.format(plan.assistant.monthlyReplies) })}
                  </p>
                  <p className="mt-1 text-[14px] text-gray-600 dark:text-gray-400">
                    {t('aiPage.perConversation', { count: plan.assistant.repliesPerConversation })}
                  </p>
                  <p className="mt-4 pt-4 border-t border-gray-100 dark:border-white/[0.07] text-[14px] text-gray-700 dark:text-gray-300">
                    {t('aiPage.depth.' + plan.type)}
                  </p>
                </Card>
              </Reveal>
            );
          })}
        </div>
        <Reveal className="mt-8 text-center">
          <TextLink to={routes.pricing}>{t('aiPage.seePricing')}</TextLink>
        </Reveal>
      </Section>

      {/* --------------------------------------------------------------- SSS */}
      <Section tone="cream">
        <div className="grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-16">
          <SectionHead eyebrow={t('homePage.faq.eyebrow')} title={t('aiPage.faqTitle')} />
          <Reveal>
            <Accordion items={faq} />
          </Reveal>
        </div>
      </Section>

      {/* --------------------------------------------------------------- CTA */}
      <Section tone="deep">
        <Reveal className="text-center max-w-2xl mx-auto">
          <h2 className="text-[32px] sm:text-[44px] font-bold tracking-[-0.04em] leading-[1.06] text-white text-balance">
            {t('aiPage.ctaTitle')}
          </h2>
          <p className="mt-5 text-[16.5px] leading-relaxed text-gray-400">{t('aiPage.ctaDesc')}</p>
          <div className="mt-9 flex justify-center">
            <Button to={routes.register} size="lg" arrow>
              {t('aiPage.ctaBtn')}
            </Button>
          </div>
        </Reveal>
      </Section>
    </Shell>
  );
};

export default AiAssistant;
