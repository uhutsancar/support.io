/**
 * Ana sayfa.
 *
 * Anlatım sırası: kim olduğumuz ve ürünün kendisi (hero + canlı sohbet),
 * panelin içi (sekmeli tur), kimler için (sektör karuseli), bir konuşmanın
 * başından sonuna nasıl aktığı (kaydırdıkça ilerleyen anlatım), yapay zekâ,
 * kurulum, özelliklerin tamamı, güven, fiyat, sorular.
 *
 * Kurallar değişmedi:
 *
 *  1. Uydurma sosyal kanıt yok. Müşteri sayısı, memnuniyet oranı, sahte logo
 *     yok. Ürün görsellerindeki rakamlar temsilîdir ve "örnek" diye işaretlidir.
 *  2. Teknik dil bu sayfada yok; teknik karşılıklar özellik detaylarının
 *     kapalı "teknik not" bloğunda ve dokümantasyonda.
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useInView, useScroll } from 'motion/react';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Globe,
  Laptop,
  LockKeyhole,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Tablet,
  UserRoundCheck,
  Users
} from 'lucide-react';
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
  Photo,
  Accordion,
  Tabs,
  TabPanel,
  AppFrame,
  accent,
  asList
} from '../components/marketing/kit';
import {
  InboxVisual,
  AnalyticsVisual,
  RoutingVisual,
  AutomationVisual,
  ProactiveVisual,
  AiVisual,
  VisitorsVisual
} from '../components/marketing/visuals';
import ChatPlayer from '../components/marketing/ChatPlayer';
import { openSiteChat, siteChatAvailable } from '../components/marketing/siteChat';
import {
  FEATURE_GROUPS,
  FEATURE_TONE,
  HOME_TABS,
  SOLUTIONS
} from './marketing/features';

type T = ReturnType<typeof useTranslation>['t'];
type Routes = ReturnType<typeof useMarketingRoutes>;

/**
 * The closing tag of an embed snippet, assembled rather than written whole.
 * A literal closing script tag in a file that is ever inlined into an HTML
 * `<script>` block would terminate that block early.
 */
const CLOSE_SCRIPT = `<${'/'}script>`;

/* ------------------------------------------------------------------- hero */

const Hero = ({ t, routes }: { t: T; routes: Routes }) => (
  <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-24 px-5 sm:px-8 overflow-hidden bg-gradient-to-b from-[#eef0ff] via-[#f6f5ff] to-white dark:from-[#10122a] dark:via-surface-dark dark:to-surface-dark">
    <div className="max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-14 lg:gap-10 items-center">
      <div>
        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-[42px] sm:text-[64px] font-bold tracking-[-0.045em] leading-[1.0] text-gray-950 dark:text-white text-balance"
        >
          {t('homePage.hero.title')}{' '}
          <span className="text-indigo-600 dark:text-indigo-400">
            {t('homePage.hero.accent')}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="mt-7 text-[18px] sm:text-[19px] leading-[1.6] text-gray-600 dark:text-gray-400 max-w-[50ch] text-pretty"
        >
          {t('homePage.hero.desc')}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="mt-9 flex flex-wrap items-center gap-3"
        >
          <Button to={routes.register} size="lg" arrow>
            {t('landing.home.btnStart')}
          </Button>
          <Button href="#tur" variant="secondary" size="lg">
            {t('homePage.hero.tour')}
          </Button>
        </motion.div>

        <ul className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2">
          {['free', 'card', 'setup'].map((k) => (
            <li key={k} className="flex items-center gap-1.5 text-[13.5px] text-gray-600 dark:text-gray-400">
              <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              {t('landing.home.trust.' + k)}
            </li>
          ))}
        </ul>
      </div>

      {/* ---- iki taraf birden: sohbeti yanıtlayan kişi ve ziyaretçinin balonu ---- */}
      <div className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          <Photo
            src="/photos/agent-woman.webp"
            alt={t('homePage.hero.photoAlt')}
            eager
            className="aspect-[4/3.4] sm:aspect-[4/3.2] lg:ml-auto lg:w-[86%] rounded-[32px] shadow-panel-lg"
            imgClassName="object-[62%_center]"
          />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          // Dar ekranda fotoğrafın üstüne binmez, altından yukarı taşar;
          // aksi halde fotoğrafın tamamını örtüyordu.
          className="relative -mt-24 mx-auto w-[280px] sm:absolute sm:mt-0 sm:mx-0 sm:-bottom-10 sm:left-2 sm:w-[300px]"
        >
          <ChatPlayer script="hero" height={250} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="hidden sm:flex absolute top-6 right-3 lg:-right-3 items-center gap-3 px-4 py-3 rounded-2xl bg-white/95 dark:bg-[#171a29]/95 backdrop-blur border border-gray-200/80 dark:border-white/10 shadow-panel-lg"
        >
          <span className="relative flex w-2.5 h-2.5">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60 motion-reduce:animate-none" />
            <span className="relative w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </span>
          <span>
            <span className="block text-[12.5px] font-semibold text-gray-900 dark:text-white">
              {t('homePage.hero.notifTitle')}
            </span>
            <span className="block text-[11px] text-gray-500 dark:text-gray-400">
              {t('homePage.hero.notifBody')}
            </span>
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="hidden sm:flex absolute bottom-16 right-3 lg:-right-5 items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/95 dark:bg-[#171a29]/95 backdrop-blur border border-gray-200/80 dark:border-white/10 shadow-panel-lg"
        >
          <UserRoundCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span className="text-[12px] font-medium text-gray-800 dark:text-gray-100">
            {t('homePage.hero.handoff')}
          </span>
        </motion.div>
      </div>
    </div>
  </section>
);

/* ------------------------------------------------------------- ürün turu */

const TOUR_VISUAL: Record<string, { node: () => React.ReactNode; frame: string }> = {
  'live-chat': { node: () => <InboxVisual />, frame: 'viz.inbox.frame' },
  'ai-assist': { node: () => <AiVisual />, frame: 'viz.ai.frame' },
  routing: { node: () => <RoutingVisual />, frame: 'viz.routing.frame' },
  automation: { node: () => <AutomationVisual />, frame: 'viz.automation.frame' },
  proactive: { node: () => <ProactiveVisual />, frame: 'viz.proactive.frame' },
  analytics: { node: () => <AnalyticsVisual />, frame: 'viz.analytics.frame' },
  visitors: { node: () => <VisitorsVisual />, frame: 'viz.visitors.frame' }
};

const ProductTour = ({ t, routes }: { t: T; routes: Routes }) => {
  const [active, setActive] = React.useState(HOME_TABS[0]);
  const tabs = HOME_TABS.map((id) => ({
    id,
    label: t('featuresPage.items.' + id + '.title'),
    icon: featureIcon(id)
  }));
  const tone = FEATURE_TONE[active as keyof typeof FEATURE_TONE];

  return (
    <Section id="tur" tone="plain" className="scroll-mt-20" wide>
      <SectionHead
        index={1}
        eyebrow={t('homePage.tour.eyebrow')}
        title={t('homePage.tour.title')}
        description={t('homePage.tour.desc')}
        align="center"
      />

      <Reveal className="mt-10">
        <Tabs items={tabs} active={active} onChange={setActive} variant="pill">
          {tabs.map((tab) => (
            <TabPanel key={tab.id} value={tab.id} className="focus:outline-none">
              <div className="mt-8 grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.4fr)] gap-8 lg:gap-12 items-center rounded-[28px] bg-gradient-to-br from-[#f3f4ff] to-[#faf8f4] dark:from-white/[0.03] dark:to-transparent border border-gray-200/70 dark:border-white/[0.06] p-6 sm:p-10">
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <Eyebrow tone={tone}>{t('featuresPage.items.' + tab.id + '.setup')}</Eyebrow>
                  <h3 className="mt-3 text-[26px] sm:text-[30px] font-bold tracking-[-0.03em] leading-[1.12] text-gray-950 dark:text-white">
                    {t('featuresPage.items.' + tab.id + '.title')}
                  </h3>
                  <p className="mt-3.5 text-[15.5px] leading-[1.65] text-gray-600 dark:text-gray-400">
                    {t('featuresPage.items.' + tab.id + '.plain')}
                  </p>
                  <ul className="mt-5 space-y-2.5">
                    {asList<string>(
                      t('featuresPage.items.' + tab.id + '.benefits', { returnObjects: true })
                    )
                      .slice(0, 3)
                      .map((b, i) => (
                        <li key={i} className="flex gap-2.5">
                          <Check className={['w-4 h-4 mt-1 shrink-0', accent(tone).text].join(' ')} />
                          <span className="text-[14.5px] leading-relaxed text-gray-700 dark:text-gray-300">
                            {b}
                          </span>
                        </li>
                      ))}
                  </ul>
                  <TextLink to={routes.features + '/' + tab.id} tone={tone} className="mt-6">
                    {t('landing.home.tour.detail')}
                  </TextLink>
                </motion.div>

                <motion.div
                  key={tab.id + '-v'}
                  initial={{ opacity: 0, y: 16, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                >
                  <AppFrame label={t(TOUR_VISUAL[tab.id].frame)} tone={tone}>
                    {TOUR_VISUAL[tab.id].node()}
                  </AppFrame>
                </motion.div>
              </div>
            </TabPanel>
          ))}
        </Tabs>
      </Reveal>
    </Section>
  );
};

/* ------------------------------------------------------ sektör karuseli */

const Industries = ({ t, routes }: { t: T; routes: Routes }) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'center' }, [
    Autoplay({ delay: 5000, stopOnMouseEnter: true, stopOnInteraction: false })
  ]);
  const [selected, setSelected] = React.useState(0);

  React.useEffect(() => {
    if (!emblaApi) return undefined;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on('select', onSelect);
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  return (
    <Section tone="mist" wide>
      <SectionHead
        index={2}
        eyebrow={t('homePage.industries.eyebrow')}
        title={t('homePage.industries.title')}
        description={t('homePage.industries.desc')}
        align="center"
      />

      <Reveal className="relative mt-12">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex touch-pan-y">
            {SOLUTIONS.map((s, i) => {
              const on = i === selected;
              return (
                <div
                  key={s.id}
                  className="flex-[0_0_84%] sm:flex-[0_0_62%] lg:flex-[0_0_54%] min-w-0 px-2 sm:px-3"
                  aria-roledescription="slide"
                >
                  <Link
                    to={routes.solutions + '/' + s.id}
                    tabIndex={on ? 0 : -1}
                    className={[
                      'group block transition-all duration-500',
                      on ? 'opacity-100 scale-100' : 'opacity-45 scale-[0.9] saturate-50'
                    ].join(' ')}
                  >
                    <Photo
                      src={s.photo}
                      alt={t('solutions.items.' + s.id + '.photoAlt')}
                      className="aspect-[16/10] rounded-[26px] shadow-panel-lg"
                      imgClassName="transition-transform duration-700 group-hover:scale-[1.03]"
                    >
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-black/0" />
                      <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 flex items-end justify-between gap-3">
                        <div>
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white bg-black/35 border border-white/25 backdrop-blur">
                            {t('solutions.items.' + s.id + '.name')}
                          </span>
                          <p
                            className={[
                              'mt-2.5 max-w-[34ch] text-[15px] sm:text-[17px] font-semibold leading-snug text-white transition-opacity',
                              on ? 'opacity-100' : 'opacity-0'
                            ].join(' ')}
                          >
                            {t('solutions.items.' + s.id + '.headline')}
                          </p>
                        </div>
                        <span
                          className={[
                            'shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11.5px] font-semibold uppercase tracking-[0.08em] bg-indigo-600 text-white transition-opacity',
                            on ? 'opacity-100' : 'opacity-0'
                          ].join(' ')}
                        >
                          {t('homePage.industries.explore')}
                          <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </Photo>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-y-0 left-0 right-0 hidden sm:flex items-center justify-between px-[16%] lg:px-[21%]">
          <button
            type="button"
            onClick={() => emblaApi?.scrollPrev()}
            className="pointer-events-auto w-11 h-11 -ml-5 rounded-full bg-white/95 dark:bg-gray-900/90 shadow-panel border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:scale-105 transition"
            aria-label={t('homePage.industries.prev')}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => emblaApi?.scrollNext()}
            className="pointer-events-auto w-11 h-11 -mr-5 rounded-full bg-white/95 dark:bg-gray-900/90 shadow-panel border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-700 dark:text-gray-200 hover:scale-105 transition"
            aria-label={t('homePage.industries.next')}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-7 flex justify-center gap-1.5">
          {SOLUTIONS.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => emblaApi?.scrollTo(i)}
              aria-label={t('solutions.items.' + s.id + '.name')}
              aria-current={i === selected}
              className={[
                'h-1.5 rounded-full transition-all duration-300',
                i === selected ? 'w-7 bg-indigo-600' : 'w-1.5 bg-gray-300 dark:bg-white/20'
              ].join(' ')}
            />
          ))}
        </div>
      </Reveal>
    </Section>
  );
};

/* ------------------------------------------- kaydırdıkça ilerleyen anlatım */

const STORY_VISUALS: Array<{ tone: string; frame?: string; node: () => React.ReactNode }> = [
  { tone: 'indigo', frame: 'viz.inbox.frame', node: () => <InboxVisual /> },
  {
    tone: 'violet',
    node: () => (
      <div className="mx-auto max-w-[360px]">
        <ChatPlayer script="story" height={330} />
      </div>
    )
  },
  { tone: 'emerald', frame: 'viz.routing.frame', node: () => <RoutingVisual /> },
  { tone: 'emerald', frame: 'viz.automation.frame', node: () => <AutomationVisual /> },
  { tone: 'sky', frame: 'viz.analytics.frame', node: () => <AnalyticsVisual /> }
];

const StoryVisual = ({ i, t }: { i: number; t: T }) => {
  const v = STORY_VISUALS[i] || STORY_VISUALS[0];
  return v.frame ? (
    <AppFrame label={t(v.frame)} tone={v.tone}>
      {v.node()}
    </AppFrame>
  ) : (
    <>{v.node()}</>
  );
};

interface StoryStep {
  title: string;
  body: string;
  chips: string[];
}

const StoryStepBlock = ({
  step,
  i,
  active,
  onActive,
  t
}: {
  step: StoryStep;
  i: number;
  active: boolean;
  onActive: (i: number) => void;
  t: T;
}) => {
  const ref = React.useRef<HTMLDivElement | null>(null);
  // Adım, ekranın ortasındaki ince bir şeritten geçerken etkin sayılır; böylece
  // aynı anda iki adım etkin olmaz.
  const inView = useInView(ref, { margin: '-45% 0px -45% 0px' });
  React.useEffect(() => {
    if (inView) onActive(i);
  }, [inView, i, onActive]);
  const tone = STORY_VISUALS[i]?.tone || 'indigo';

  return (
    <div ref={ref} className="relative lg:min-h-[62vh] flex flex-col justify-center pl-10 sm:pl-12">
      <span
        className={[
          'absolute left-[9px] top-[calc(50%-7px)] lg:top-auto w-[15px] h-[15px] rounded-full border-2 transition-all duration-300',
          active
            ? 'border-indigo-600 bg-white dark:bg-surface-dark ring-4 ring-indigo-500/15'
            : 'border-gray-300 dark:border-white/20 bg-white dark:bg-surface-dark'
        ].join(' ')}
        aria-hidden="true"
      >
        {active && <span className="absolute inset-[3px] rounded-full bg-indigo-600" />}
      </span>
      <div className={['transition-opacity duration-500', active ? 'opacity-100' : 'lg:opacity-35'].join(' ')}>
        <Eyebrow tone={tone}>· {String(i + 1).padStart(2, '0')}</Eyebrow>
        <h3 className="mt-2 text-[24px] sm:text-[28px] font-bold tracking-[-0.03em] leading-[1.15] text-gray-950 dark:text-white">
          {step.title}
        </h3>
        <p className="mt-3 text-[15.5px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[46ch]">
          {step.body}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {(step.chips || []).map((c) => (
            <Chip key={c}>{c}</Chip>
          ))}
        </div>
      </div>
      {/* Dar ekranda yapışkan sütun yok; görsel adımın altında durur. */}
      <div className="lg:hidden mt-7">
        <StoryVisual i={i} t={t} />
      </div>
    </div>
  );
};

const Story = ({ t }: { t: T }) => {
  const steps = asList<StoryStep>(t('homePage.story.steps', { returnObjects: true }));
  const [active, setActive] = React.useState(0);
  const onActive = React.useCallback((i: number) => setActive(i), []);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start center', 'end center'] });

  return (
    <Section tone="plain" wide>
      <SectionHead
        index={3}
        eyebrow={t('homePage.story.eyebrow')}
        title={t('homePage.story.title')}
        description={t('homePage.story.desc')}
      />

      <div className="mt-12 lg:mt-4 grid lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-10 lg:gap-16">
        <div ref={listRef} className="relative space-y-14 lg:space-y-0">
          {/* ilerleme çizgisi: gri ray + kaydırmayla dolan indigo çizgi */}
          <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200 dark:bg-white/10" aria-hidden="true" />
          <motion.div
            className="absolute left-4 top-0 bottom-0 w-px bg-indigo-600 origin-top"
            style={{ scaleY: scrollYProgress }}
            aria-hidden="true"
          />
          {steps.map((step, i) => (
            <StoryStepBlock
              key={i}
              step={step}
              i={i}
              active={active === i}
              onActive={onActive}
              t={t}
            />
          ))}
        </div>

        <div className="hidden lg:block">
          <div className="sticky top-[calc(50vh-210px)]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active}
                initial={{ opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <StoryVisual i={active} t={t} />
                <p className="mt-4 text-center text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gray-400 dark:text-gray-500">
                  {steps[active]?.chips?.join(' · ')}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Section>
  );
};

/* ---------------------------------------------------------- yapay zekâ */

const AiBand = ({ t, routes }: { t: T; routes: Routes }) => {
  const points = asList<{ title: string; body: string }>(
    t('homePage.ai.points', { returnObjects: true })
  );
  const modes = asList<{ name: string; body: string }>(t('homePage.ai.modes', { returnObjects: true }));
  const icons = [ServerCog, LockKeyhole, UserRoundCheck, ShieldCheck];

  return (
    <Section tone="deep" wide className="overflow-hidden">
      <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] gap-14 lg:gap-16 items-center">
        <div>
          <Reveal>
            <Eyebrow index={4} tone="violet" className="!text-violet-300">
              {t('homePage.ai.eyebrow')}
            </Eyebrow>
            <h2 className="mt-4 text-[31px] sm:text-[44px] font-bold tracking-[-0.035em] leading-[1.06] text-white text-balance">
              {t('homePage.ai.title')}
            </h2>
            <p className="mt-5 text-[16.5px] leading-[1.65] text-gray-400 max-w-[56ch]">
              {t('homePage.ai.desc')}
            </p>
          </Reveal>

          <div className="mt-10 grid sm:grid-cols-2 gap-x-8 gap-y-7">
            {points.map((p, i) => {
              const Icon = icons[i % icons.length];
              return (
                <Reveal key={i} delay={i * 0.06}>
                  <Icon className="w-5 h-5 text-violet-300" strokeWidth={1.8} />
                  <h3 className="mt-3 text-[15.5px] font-semibold text-white">{p.title}</h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-gray-400">{p.body}</p>
                </Reveal>
              );
            })}
          </div>

          <Reveal className="mt-10 grid sm:grid-cols-3 gap-2.5">
            {modes.map((m, i) => (
              <div
                key={i}
                className={[
                  'rounded-2xl p-4 border',
                  i === 2 ? 'border-violet-400/40 bg-violet-500/[0.12]' : 'border-white/10 bg-white/[0.03]'
                ].join(' ')}
              >
                <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-violet-200">
                  {m.name}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-400">{m.body}</p>
              </div>
            ))}
          </Reveal>

          <Reveal className="mt-9 flex flex-wrap gap-3">
            <Button to={routes.ai} variant="inverse" arrow>
              {t('homePage.ai.cta')}
            </Button>
            <Button
              to={routes.features + '/ai-assist'}
              className="bg-white/10 text-white border border-white/20 hover:bg-white/[0.16] shadow-none"
            >
              {t('homePage.ai.cta2')}
            </Button>
          </Reveal>
        </div>

        <Reveal y={40} className="relative">
          <div className="dark mx-auto max-w-[380px]">
            <ChatPlayer script="ai" height={400} />
          </div>
        </Reveal>
      </div>
    </Section>
  );
};

/* -------------------------------------------------------- kurulum bento */

const DEMO_BARS = [38, 52, 44, 61, 57, 72, 66];

const SetupBento = ({ t, routes }: { t: T; routes: Routes }) => {
  const [copied, setCopied] = React.useState(false);
  const origin = import.meta.env.VITE_API_URL || window.location.origin;
  const snippet = `<script\n  src="${origin}/widget.js"\n  data-site-key="${t('homePage.setup.keyPlaceholder')}"\n  async>${CLOSE_SCRIPT}`;
  const barsRef = React.useRef<HTMLDivElement | null>(null);
  const barsInView = useInView(barsRef, { once: true, amount: 0.5 });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa sessiz kal; kod zaten ekranda ve seçilebilir.
    }
  };

  const platforms = asList<string>(t('landing.home.setup.platforms', { returnObjects: true }));
  const stats = asList<{ label: string; value: string }>(t('homePage.setup.stats', { returnObjects: true }));
  const days = asList<string>(t('viz.analytics.days', { returnObjects: true }));

  return (
    <Section tone="cream" wide>
      <SectionHead
        index={5}
        eyebrow={t('homePage.setup.eyebrow')}
        title={t('homePage.setup.title')}
        description={t('homePage.setup.desc')}
        align="center"
      />

      <div className="mt-12 grid lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4">
        <div className="grid gap-4">
          {/* ---- kod ---- */}
          <Reveal>
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
                  <span className="ml-2 text-[11px] font-semibold tracking-[0.06em] text-gray-400 font-mono">
                    index.html
                  </span>
                </span>
                <button
                  onClick={copy}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.06] transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? t('common.copied') : t('common.copy')}
                </button>
              </div>
              <pre className="mt-4 overflow-x-auto rounded-xl bg-gray-950 p-5 text-[13px] leading-[1.8] text-gray-200">
                <code>
                  <span className="text-gray-500">{'<!-- ' + t('homePage.setup.comment') + ' -->'}</span>
                  {'\n'}
                  {snippet}
                </code>
              </pre>
              <p className="mt-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {t('homePage.setup.live')}
              </p>
            </Card>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-4">
            <Reveal delay={0.05}>
              <Card className="p-6 h-full flex flex-col">
                <Eyebrow tone="emerald">{t('homePage.setup.noDevs.eyebrow')}</Eyebrow>
                <h3 className="mt-3 text-[21px] font-bold tracking-[-0.02em] text-gray-950 dark:text-white">
                  {t('homePage.setup.noDevs.title')}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 flex-1">
                  {t('homePage.setup.noDevs.body')}
                </p>
                <div className="mt-5 flex flex-wrap gap-1.5">
                  {platforms.slice(0, 6).map((p) => (
                    <span
                      key={p}
                      className="px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 bg-white dark:bg-transparent"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </Card>
            </Reveal>

            <Reveal delay={0.1}>
              <Card className="p-6 h-full flex flex-col">
                <Eyebrow tone="sky">{t('homePage.setup.devices.eyebrow')}</Eyebrow>
                <h3 className="mt-3 text-[21px] font-bold tracking-[-0.02em] text-gray-950 dark:text-white">
                  {t('homePage.setup.devices.title')}
                </h3>
                <p className="mt-2 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 flex-1">
                  {t('homePage.setup.devices.body')}
                </p>
                <div className="mt-5 grid grid-cols-3 gap-2">
                  {[
                    { icon: Laptop, key: 'desktop' },
                    { icon: Tablet, key: 'tablet' },
                    { icon: Smartphone, key: 'phone' }
                  ].map((d) => (
                    <span
                      key={d.key}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-transparent"
                    >
                      <d.icon className="w-5 h-5 text-gray-700 dark:text-gray-300" strokeWidth={1.7} />
                      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-gray-500">
                        {t('homePage.setup.devices.' + d.key)}
                      </span>
                    </span>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>
        </div>

        {/* ---- örnek pano ---- */}
        <Reveal delay={0.08}>
          <Card className="p-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
              <Eyebrow>{t('homePage.setup.board.title')}</Eyebrow>
              <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                {t('homePage.setup.board.sample')}
              </span>
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
              {t('homePage.setup.board.replies')}
            </p>
            <p className="mt-1 text-[40px] font-semibold tracking-[-0.04em] text-gray-950 dark:text-white tabular-nums">
              147
            </p>
            <div ref={barsRef} className="mt-4 h-28 flex items-end gap-2" aria-hidden="true">
              {DEMO_BARS.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <motion.div
                    className="w-full rounded-md bg-gradient-to-t from-indigo-600 to-indigo-400"
                    initial={{ height: 0 }}
                    animate={{ height: barsInView ? `${(v / 72) * 100}%` : 0 }}
                    transition={{ duration: 0.8, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <span className="text-[9px] text-gray-400">{days[i]}</span>
                </div>
              ))}
            </div>
            <dl className="mt-6 divide-y divide-gray-100 dark:divide-white/[0.07] border-t border-gray-100 dark:border-white/[0.07]">
              {stats.map((s) => (
                <div key={s.label} className="flex items-center justify-between py-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-500">{s.label}</dt>
                  <dd className="text-[13.5px] font-semibold text-gray-900 dark:text-white tabular-nums">{s.value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto pt-4 flex items-center gap-2">
              <div className="flex -space-x-2">
                {['/photos/agent-woman.webp', '/photos/reception.webp', '/photos/shopper.webp'].map((src) => (
                  <img key={src} src={src} alt="" loading="lazy" className="w-8 h-8 rounded-full object-cover ring-2 ring-white dark:ring-[#12141f]" />
                ))}
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-400">
                {t('homePage.setup.board.online')}
              </span>
            </div>
          </Card>
        </Reveal>
      </div>

      <Reveal className="mt-10 flex justify-center gap-3 flex-wrap">
        <Button to={routes.register} arrow>
          {t('landing.home.setup.cta')}
        </Button>
        <Button to={routes.docs} variant="secondary">
          {t('landing.home.btnDocs')}
        </Button>
      </Reveal>
    </Section>
  );
};

/* ----------------------------------------------------------- özellikler */

const FeatureGrid = ({ t, routes }: { t: T; routes: Routes }) => (
  <Section tone="plain" wide>
    <div className="flex flex-wrap items-end justify-between gap-6">
      <SectionHead
        index={6}
        eyebrow={t('homePage.features.eyebrow')}
        title={t('homePage.features.title')}
        description={t('homePage.features.desc')}
      />
      <Reveal>
        <TextLink to={routes.features}>{t('nav.allFeatures')}</TextLink>
      </Reveal>
    </div>

    <div className="mt-12 space-y-10">
      {FEATURE_GROUPS.map((group) => (
        <div key={group.id}>
          <Reveal>
            <Eyebrow tone={group.tone}>{t('nav.groups.' + group.id)}</Eyebrow>
          </Reveal>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {group.items.map((id, i) => {
              const Icon = featureIcon(id);
              const tone = FEATURE_TONE[id as keyof typeof FEATURE_TONE];
              return (
                <Reveal key={id} delay={i * 0.05}>
                  <Link to={routes.features + '/' + id} className="group block h-full">
                    <Card hover className="h-full p-5">
                      <span className={['inline-flex w-10 h-10 items-center justify-center rounded-xl border', accent(tone).border].join(' ')}>
                        <Icon className={['w-5 h-5', accent(tone).text].join(' ')} strokeWidth={1.8} />
                      </span>
                      <h3 className="mt-4 flex items-center gap-1.5 text-[15.5px] font-semibold text-gray-950 dark:text-white">
                        {t('featuresPage.items.' + id + '.title')}
                        <ArrowRight className="w-3.5 h-3.5 opacity-0 -translate-x-1 transition-all group-hover:opacity-70 group-hover:translate-x-0" />
                      </h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                        {t('featuresPage.items.' + id + '.short')}
                      </p>
                    </Card>
                  </Link>
                </Reveal>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  </Section>
);

/* ----------------------------------------------------------------- güven */

const Trust = ({ t }: { t: T }) => {
  const items = asList<{ title: string; body: string }>(
    t('landing.home.security.items', { returnObjects: true })
  );
  const icons = [ShieldCheck, Users, Globe, LockKeyhole];
  return (
    <Section tone="mist" wide>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-12 lg:gap-16 items-center">
        <div>
          <SectionHead
            index={7}
            eyebrow={t('landing.home.security.eyebrow')}
            eyebrowTone="emerald"
            title={t('landing.home.security.title')}
            description={t('landing.home.security.desc')}
          />
          <div className="mt-9 grid sm:grid-cols-2 gap-3">
            {items.map((item, i) => {
              const Icon = icons[i % icons.length];
              return (
                <Reveal key={i} delay={i * 0.05}>
                  <Card className="p-5 h-full">
                    <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" strokeWidth={1.8} />
                    <h3 className="mt-3 text-[14.5px] font-semibold text-gray-950 dark:text-white">{item.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">{item.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </div>
        <Reveal y={30}>
          <Photo
            src="/photos/team.webp"
            alt={t('homePage.trustPhotoAlt')}
            className="aspect-[4/3.3] rounded-[28px] shadow-panel-lg"
          />
        </Reveal>
      </div>
    </Section>
  );
};

/* ------------------------------------------------------------- fiyat */

const PricingTeaser = ({ t, routes }: { t: T; routes: Routes }) => (
  <Section tone="plain" wide>
    <SectionHead
      index={8}
      eyebrow={t('landing.home.plans.eyebrow')}
      title={t('landing.home.plans.title')}
      description={t('landing.home.plans.desc')}
      align="center"
    />
    <div className="mt-12 grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
      {['free', 'pro', 'enterprise'].map((id, i) => (
        <Reveal key={id} delay={i * 0.06}>
          <Card
            hover
            className={[
              'p-6 h-full',
              i === 1 ? 'ring-2 ring-indigo-600 border-transparent dark:border-transparent' : ''
            ].join(' ')}
          >
            <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-500">
              {t('pricingPage.plans.' + id + '.name')}
            </p>
            <p className="mt-3 text-[30px] font-bold tracking-[-0.03em] text-gray-950 dark:text-white tabular-nums">
              {t('landing.home.plans.price.' + id)}
            </p>
            <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
              {t('landing.home.plans.note.' + id)}
            </p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
              {t('pricingPage.plans.' + id + '.tagline')}
            </p>
          </Card>
        </Reveal>
      ))}
    </div>
    <Reveal className="mt-8 text-center">
      <TextLink to={routes.pricing}>{t('landing.home.plans.link')}</TextLink>
    </Reveal>
  </Section>
);

/* ------------------------------------------------------------------ SSS */

interface FaqItem {
  q: string;
  a: string;
  cat: string;
}

const Faq = ({ t, routes }: { t: T; routes: Routes }) => {
  const items = asList<FaqItem>(t('homePage.faq.items', { returnObjects: true }));
  const cats = ['all', ...Array.from(new Set(items.map((i) => i.cat)))];
  const [cat, setCat] = React.useState('all');
  const shown = cat === 'all' ? items : items.filter((i) => i.cat === cat);

  return (
    <Section tone="mist" wide>
      <div className="grid lg:grid-cols-[minmax(0,.75fr)_minmax(0,1.25fr)] gap-10 lg:gap-16 items-start">
        <div className="lg:sticky lg:top-28">
          <SectionHead index={9} eyebrow={t('homePage.faq.eyebrow')} title={t('homePage.faq.title')} />
          <Reveal className="mt-8">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-gray-400">
              {t('homePage.faq.categories')}
            </p>
            <ul className="mt-3 border-l border-gray-200 dark:border-white/10" role="tablist">
              {cats.map((c) => {
                const count = c === 'all' ? items.length : items.filter((i) => i.cat === c).length;
                const on = c === cat;
                return (
                  <li key={c}>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={on}
                      onClick={() => setCat(c)}
                      className={[
                        '-ml-px w-full flex items-center justify-between pl-4 pr-1 py-2 border-l-2 text-[14px] transition-colors',
                        on
                          ? 'border-indigo-600 text-gray-950 dark:text-white font-semibold'
                          : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      ].join(' ')}
                    >
                      {t('homePage.faq.cat.' + c)}
                      <span className="text-[11.5px] tabular-nums text-gray-400">· {count}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10">
              <p className="text-[13.5px] text-gray-600 dark:text-gray-400">{t('homePage.faq.still')}</p>
              {siteChatAvailable ? (
                <TextLink onClick={() => openSiteChat()} className="mt-1.5">
                  {t('homePage.faq.chat')}
                </TextLink>
              ) : (
                <TextLink to={routes.about} className="mt-1.5">
                  {t('homePage.faq.contact')}
                </TextLink>
              )}
            </div>
          </Reveal>
        </div>

        <Reveal key={cat}>
          <Accordion items={shown} numbered />
        </Reveal>
      </div>
    </Section>
  );
};

/* ------------------------------------------------------------------- CTA */

const FinalCta = ({ t, routes }: { t: T; routes: Routes }) => (
  <section className="px-5 sm:px-8 py-10 sm:py-14 bg-white dark:bg-surface-dark">
    <Reveal className="max-w-7xl mx-auto">
      <Photo
        src="/photos/reception.webp"
        alt=""
        className="rounded-[32px] min-h-[420px] flex items-center"
        imgClassName="object-[75%_center]"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0d17] via-[#0b0d17]/85 to-[#0b0d17]/10" />
        <div className="relative px-7 sm:px-14 py-14 max-w-2xl">
          <h2 className="text-[34px] sm:text-[48px] font-bold tracking-[-0.04em] leading-[1.04] text-white text-balance">
            {t('landing.home.ctaTitle')}
          </h2>
          <p className="mt-5 text-[17px] leading-relaxed text-gray-300 max-w-[46ch]">
            {t('landing.home.ctaDesc')}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button to={routes.register} size="lg" arrow>
              {t('landing.home.ctaBtn1')}
            </Button>
            <Button
              to={routes.pricing}
              size="lg"
              className="bg-white/10 text-white border border-white/25 hover:bg-white/[0.18] shadow-none"
            >
              {t('landing.home.ctaBtn2')}
            </Button>
          </div>
          <p className="mt-6 text-[13px] text-gray-400">{t('landing.home.ctaNote')}</p>
        </div>
      </Photo>
    </Reveal>
  </section>
);

/* -------------------------------------------------------------------- sayfa */

const Home = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();

  return (
    <>
      <Helmet>
        <title>{t('landing.home.metaTitle')}</title>
        <meta name="description" content={t('landing.home.metaDesc')} />
      </Helmet>

      <Shell>
        <Hero t={t} routes={routes} />
        <ProductTour t={t} routes={routes} />
        <Industries t={t} routes={routes} />
        <Story t={t} />
        <AiBand t={t} routes={routes} />
        <SetupBento t={t} routes={routes} />
        <FeatureGrid t={t} routes={routes} />
        <Trust t={t} />
        <PricingTeaser t={t} routes={routes} />
        <Faq t={t} routes={routes} />
        <FinalCta t={t} routes={routes} />
      </Shell>
    </>
  );
};

export default Home;
