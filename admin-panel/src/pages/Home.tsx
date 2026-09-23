/**
 * Ana sayfa.
 *
 * Anlatım sırası, bu işi yapan olgun ürünlerin (Intercom, tawk.to, Crisp,
 * Chatwoot) ortaklaştığı sıradır: önce sonuç, sonra problem, sonra numaralı
 * kurulum turu, sonra sekmeli özellik gezintisi, sonra sektör dili, en sonda
 * fiyat ve soru-cevap. Her bölüm bir öncekinden FARKLI bir düzen kullanır —
 * eski sayfada beş bölüm üst üste "başlık + üç sütun metin" olduğu için
 * okuyan ikinci bölümden sonra kaydırıp geçiyordu.
 *
 * İki kural:
 *
 *  1. Uydurma sosyal kanıt yok. "5.000+ işletme", "%99.9 uptime", sahte
 *     avatarlar ve gerçek olmayan müşteri logoları burada YOKTU, geri de
 *     gelmedi. Kanıt olarak ürünün kendi ekranları gösteriliyor.
 *  2. Teknik dil bu sayfada yok. "Shadow DOM", "WebSocket", "round-robin"
 *     gibi terimler ürünün gerçeği ama alıcının derdi değil; onlar
 *     dokümantasyonda ve özellik detay sayfalarının "teknik not" bloğunda.
 */

import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Check,
  Copy,
  MessageSquare,
  Zap,
  BarChart3,
  Users,
  ShieldCheck,
  Globe,
  Send,
  GitBranch,
  Sparkles,
  Clock,
  Inbox,
  Store,
  Rocket,
  Briefcase,
  Wrench,
  AlertTriangle,
  PlugZap
} from 'lucide-react';
import Shell, { useMarketingRoutes } from '../components/marketing/Shell';
import {
  Button,
  TextLink,
  Section,
  SectionHead,
  Card,
  AccentIcon,
  SolidIcon,
  Pill,
  Accordion,
  Tabs,
  StepNumber,
  AppFrame,
  Marquee,
  accent,
  asList
} from '../components/marketing/kit';
import {
  InboxVisual,
  WidgetVisual,
  AnalyticsVisual,
  RoutingVisual,
  AutomationVisual,
  ProactiveVisual,
  AiVisual
} from '../components/marketing/visuals';
import { HOME_TABS, USE_CASES, FEATURE_TONE, FEATURE_ICON } from './marketing/features';

/**
 * The closing tag of an embed snippet, assembled rather than written whole.
 *
 * These snippets are text the customer copies. A literal closing script tag in
 * a file that is ever inlined into an HTML `<script>` block would terminate
 * that block early. It used to be written `<\/script>`, which reads as a guard
 * but is not one — a backslash before `/` is not an escape sequence in a
 * JavaScript string, so the character emitted was identical. Splitting it is
 * the version that actually holds.
 */
const CLOSE_SCRIPT = `<${'/'}script>`;

const ICONS = { MessageSquare, GitBranch, Zap, Send, BarChart3, Sparkles };
const USE_CASE_ICON = { ecommerce: Store, saas: Rocket, agency: Briefcase, service: Wrench };

/* ------------------------------------------------------------------- hero */

const Hero = ({ t, routes }: { t?: any; routes?: any; [prop: string]: any }) => (
  <section className="pt-32 pb-16 sm:pt-40 sm:pb-24 px-5 sm:px-8">
    <div className="max-w-6xl mx-auto">
      <div className="max-w-3xl">
        {/*
          Başlığın üstünde rozet YOK. Orada yuvarlak köşeli, içinde yeşil nokta
          atan bir "Kurulum 2 dakika · Kredi kartı istenmez" çipi duruyordu.
          Aynı bilgi butonların altındaki maddelerde zaten var; çip yalnızca
          sayfanın hazır bir şablondan çıktığını ele veriyordu.
        */}
        <h1
          className="text-[40px] sm:text-[60px] font-semibold tracking-[-0.038em]
          leading-[1.04] text-gray-900 dark:text-white"
        >
          {t('landing.home.heroTitle')}{' '}
          <span className="text-indigo-600 dark:text-indigo-400">
            {t('landing.home.heroTitleAccent')}
          </span>
        </h1>

        <p className="mt-6 text-[18px] sm:text-[19px] leading-[1.6] text-gray-600 dark:text-gray-400 max-w-[54ch]">
          {t('landing.home.heroDesc')}
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button to={routes.register} size="lg" arrow>
            {t('landing.home.btnStart')}
          </Button>
          <Button to={routes.features} variant="secondary" size="lg">
            {t('landing.home.btnTour')}
          </Button>
        </div>

        <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
          {['free', 'card', 'setup'].map((k) => (
            <li
              key={k}
              className="flex items-center gap-1.5 text-[13.5px] text-gray-600 dark:text-gray-400"
            >
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-500 shrink-0" />
              {t('landing.home.trust.' + k)}
            </li>
          ))}
        </ul>
      </div>

      {/* ---- ürün görseli: panel + ziyaretçinin gördüğü balon ---- */}
      <div className="mt-14 sm:mt-16">
        <div className="relative">
          {/*
            Sağ kenar payı balonun genişliğine göre verilir (268px + nefes
            payı). Önceden `lg:mr-40` yazıyordu: balon panelin 100 pikselini
            örtüyor ve açık konuşmadaki cümleyi tam ortasından kesiyordu.
            Şimdi yalnızca panelin boş kenarına biniyor.
          */}
          <AppFrame label={t('viz.inbox.frame')} className="lg:mr-[254px]">
            <InboxVisual />
          </AppFrame>

          {/* Ziyaretçi tarafı panelin üstüne biner: iki tarafın aynı anda
              görünmesi, ürünün ne olduğunu tek bakışta anlatan şey. */}
          <div className="hidden lg:block absolute right-0 -bottom-14">
            <WidgetVisual />
          </div>
        </div>

        <div className="lg:hidden mt-8 flex justify-center">
          <WidgetVisual />
        </div>
      </div>
    </div>
  </section>
);

/* -------------------------------------------------------------- problem */

const Problem = ({ t }: { t?: any; [prop: string]: any }) => {
  const items = t('landing.home.problem.items', { returnObjects: true });
  const list = Array.isArray(items) ? items : [];
  return (
    <Section tone="subtle" bordered size="md">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] gap-12 lg:gap-16 items-center">
        <div>
          <SectionHead
            eyebrow={t('landing.home.problem.eyebrow')}
            eyebrowTone="rose"
            title={t('landing.home.problem.title')}
            description={t('landing.home.problem.desc')}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((item, i) => (
            <div key={i}>
              <Card className="p-4 h-full">
                <AlertTriangle
                  className="w-[18px] h-[18px] text-rose-500 dark:text-rose-400"
                  strokeWidth={2}
                />
                <p className="mt-3 text-[14.5px] font-medium text-gray-900 dark:text-white">
                  {item.title}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {item.body}
                </p>
              </Card>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div
          className="mt-12 rounded-2xl border border-indigo-200 dark:border-indigo-500/25
          bg-indigo-50/70 dark:bg-indigo-500/[0.08] px-6 py-7 sm:px-8 flex flex-wrap items-center gap-6"
        >
          <SolidIcon icon={Inbox} tone="indigo" />
          <p
            className="flex-1 min-w-[260px] text-[17px] sm:text-[19px] font-medium leading-snug
            text-gray-900 dark:text-white"
          >
            {t('landing.home.problem.answer')}
          </p>
        </div>
      </div>
    </Section>
  );
};

/* ------------------------------------------------------------ nasıl çalışır */

const HowItWorks = ({ t }: { t?: any; [prop: string]: any }) => {
  const steps = t('landing.home.steps', { returnObjects: true });
  const list = Array.isArray(steps) ? steps : [];
  const visuals = [
    // Balon kendi genişliğinde sabit; geniş kolonun içinde ortalanır, yoksa
    // sola yapışıp sağında kocaman bir boşluk bırakıyordu.
    {
      node: (
        <div className="flex justify-center">
          <WidgetVisual />
        </div>
      ),
      tone: 'indigo'
    },
    {
      node: (
        <AppFrame label={t('viz.inbox.frame')}>
          <InboxVisual compact />
        </AppFrame>
      ),
      tone: 'violet'
    },
    {
      node: (
        <AppFrame label={t('viz.routing.frame')} tone="emerald">
          <RoutingVisual />
        </AppFrame>
      ),
      tone: 'emerald'
    },
    {
      node: (
        <AppFrame label={t('viz.analytics.frame')} tone="sky">
          <AnalyticsVisual />
        </AppFrame>
      ),
      tone: 'sky'
    }
  ];

  return (
    <Section bordered>
      <SectionHead
        eyebrow={t('landing.home.how.eyebrow')}
        title={t('landing.home.how.title')}
        description={t('landing.home.how.desc')}
      />

      <div className="mt-16 space-y-20 sm:space-y-24">
        {list.map((step, i) => {
          const v = visuals[i] || visuals[0];
          const flip = i % 2 === 1;
          return (
            <div key={i}>
              <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                <div className={flip ? 'lg:order-2' : ''}>
                  <div className="flex items-center gap-3">
                    <StepNumber n={i + 1} tone={v.tone} />
                    <span
                      className={[
                        'text-[12.5px] font-semibold uppercase tracking-wider',
                        accent(v.tone).text
                      ].join(' ')}
                    >
                      {step.kicker}
                    </span>
                  </div>
                  <h3
                    className="mt-5 text-[25px] sm:text-[30px] font-semibold tracking-[-0.028em]
                    leading-[1.15] text-gray-900 dark:text-white max-w-[18ch]"
                  >
                    {step.title}
                  </h3>
                  <p className="mt-4 text-[16px] leading-[1.65] text-gray-600 dark:text-gray-400 max-w-[52ch]">
                    {step.body}
                  </p>
                  <ul className="mt-6 space-y-2.5">
                    {(step.points || []).map((point: any, j: number) => (
                      <li key={j} className="flex gap-2.5">
                        <Check
                          className={['w-4 h-4 mt-1 shrink-0', accent(v.tone).text].join(' ')}
                        />
                        <span className="text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                          {point}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className={flip ? 'lg:order-1' : ''}>{v.node}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
};

/* -------------------------------------------------------- özellik sekmeleri */

const FeatureTour = ({ t, routes }: { t?: any; routes?: any; [prop: string]: any }) => {
  const [active, setActive] = React.useState(HOME_TABS[0]);

  const panels = {
    'live-chat': (
      <AppFrame label={t('viz.inbox.frame')}>
        <InboxVisual compact />
      </AppFrame>
    ),
    routing: (
      <AppFrame label={t('viz.routing.frame')} tone="emerald">
        <RoutingVisual />
      </AppFrame>
    ),
    automation: (
      <AppFrame label={t('viz.automation.frame')} tone="emerald">
        <AutomationVisual />
      </AppFrame>
    ),
    proactive: (
      <AppFrame label={t('viz.proactive.frame')} tone="amber">
        <ProactiveVisual />
      </AppFrame>
    ),
    analytics: (
      <AppFrame label={t('viz.analytics.frame')} tone="sky">
        <AnalyticsVisual />
      </AppFrame>
    ),
    'ai-assist': (
      <AppFrame label={t('viz.ai.frame')} tone="violet">
        <AiVisual />
      </AppFrame>
    )
  };

  const tabs = HOME_TABS.map((id) => ({
    id,
    label: t('featuresPage.items.' + id + '.title'),
    tone: FEATURE_TONE[id as keyof typeof FEATURE_TONE],
    icon: ICONS[FEATURE_ICON[id as keyof typeof FEATURE_ICON] as keyof typeof ICONS]
  }));

  const tone = FEATURE_TONE[active as keyof typeof FEATURE_TONE];

  return (
    <Section tone="subtle" bordered>
      <SectionHead
        eyebrow={t('landing.home.tour.eyebrow')}
        eyebrowTone="violet"
        title={t('landing.home.tour.title')}
        description={t('landing.home.tour.desc')}
      />

      <div className="mt-10">
        <Tabs items={tabs} active={active} onChange={setActive} />
      </div>

      <div
        role="tabpanel"
        id={'panel-' + active}
        aria-labelledby={'tab-' + active}
        className="mt-7 grid lg:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)] gap-8 lg:gap-12 items-center"
      >
        <div key={active} className="animate-rise">
          <Pill>{t('featuresPage.items.' + active + '.setup')}</Pill>
          <h3
            className="mt-4 text-[24px] sm:text-[28px] font-semibold tracking-[-0.026em]
            leading-[1.18] text-gray-900 dark:text-white"
          >
            {t('featuresPage.items.' + active + '.title')}
          </h3>
          <p className="mt-3.5 text-[15.5px] leading-[1.65] text-gray-600 dark:text-gray-400">
            {t('featuresPage.items.' + active + '.plain')}
          </p>
          <ul className="mt-5 space-y-2.5">
            {asList(t('featuresPage.items.' + active + '.benefits', { returnObjects: true })).map(
              (b, i) => (
                <li key={i} className="flex gap-2.5">
                  <Check className={['w-4 h-4 mt-1 shrink-0', accent(tone).text].join(' ')} />
                  <span className="text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                    {b}
                  </span>
                </li>
              )
            )}
          </ul>
          <TextLink to={routes.features + '/' + active} tone={tone} className="mt-6">
            {t('landing.home.tour.detail')}
          </TextLink>
        </div>

        <div key={active + '-v'} className="animate-rise">
          {panels[active as keyof typeof panels]}
        </div>
      </div>
    </Section>
  );
};

/* ------------------------------------------------------------- sektörler */

const UseCases = ({ t }: { t?: any; [prop: string]: any }) => {
  const [active, setActive] = React.useState(USE_CASES[0]);
  const tones = { ecommerce: 'indigo', saas: 'violet', agency: 'amber', service: 'emerald' };

  return (
    <Section bordered>
      <SectionHead
        eyebrow={t('landing.home.cases.eyebrow')}
        eyebrowTone="amber"
        title={t('landing.home.cases.title')}
        description={t('landing.home.cases.desc')}
      />

      <div className="mt-10 grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-8 lg:gap-14">
        {/* seçim listesi */}
        <ul className="space-y-2">
          {USE_CASES.map((id) => {
            const Icon = USE_CASE_ICON[id as keyof typeof USE_CASE_ICON];
            const a = accent(tones[id as keyof typeof tones]);
            const on = id === active;
            return (
              <li key={id}>
                <button
                  onClick={() => setActive(id)}
                  aria-pressed={on}
                  className={[
                    'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left transition-all',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                    on
                      ? ['bg-white dark:bg-white/[0.05] border shadow-panel', a.border].join(' ')
                      : 'border border-transparent hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                  ].join(' ')}
                >
                  <AccentIcon icon={Icon} tone={tones[id as keyof typeof tones]} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-medium text-gray-900 dark:text-white">
                      {t('landing.home.cases.items.' + id + '.name')}
                    </span>
                    <span className="block text-[12.5px] text-gray-500 dark:text-gray-400 truncate">
                      {t('landing.home.cases.items.' + id + '.tag')}
                    </span>
                  </span>
                  <ArrowRight
                    className={[
                      'w-4 h-4 shrink-0 transition-all',
                      on
                        ? a.text + ' translate-x-0 opacity-100'
                        : 'text-gray-300 dark:text-gray-600 -translate-x-1 opacity-0'
                    ].join(' ')}
                  />
                </button>
              </li>
            );
          })}
        </ul>

        {/* seçilen sektörün anlatımı */}
        <Card key={active} className="p-6 sm:p-8 animate-rise">
          <h3
            className="text-[22px] sm:text-[26px] font-semibold tracking-[-0.025em]
            leading-snug text-gray-900 dark:text-white max-w-[24ch]"
          >
            {t('landing.home.cases.items.' + active + '.headline')}
          </h3>
          <p className="mt-4 text-[15.5px] leading-[1.7] text-gray-600 dark:text-gray-400 max-w-[58ch]">
            {t('landing.home.cases.items.' + active + '.body')}
          </p>

          <div className="mt-7 grid sm:grid-cols-3 gap-4">
            {asList(t('landing.home.cases.items.' + active + '.wins', { returnObjects: true })).map(
              (w, i) => (
                <div key={i} className="rounded-xl bg-gray-50 dark:bg-white/[0.04] p-4">
                  <p
                    className={[
                      'text-[13px] font-semibold',
                      accent(tones[active as keyof typeof tones]).text
                    ].join(' ')}
                  >
                    {w.label}
                  </p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                    {w.body}
                  </p>
                </div>
              )
            )}
          </div>
        </Card>
      </div>
    </Section>
  );
};

/* -------------------------------------------------------------- kurulum */

const Setup = ({ t, routes }: { t?: any; routes?: any; [prop: string]: any }) => {
  const [copied, setCopied] = React.useState(false);
  const origin = import.meta.env.VITE_API_URL || window.location.origin;
  const snippet =
    '<script\n  src="' +
    origin +
    '/widget.js"\n  data-site-key="SITE_ANAHTARINIZ"\n  async>' +
    CLOSE_SCRIPT;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Pano izni yoksa sessiz kal; kod zaten ekranda ve seçilebilir.
    }
  };

  const platforms = t('landing.home.setup.platforms', { returnObjects: true });

  return (
    <Section tone="subtle" bordered>
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        <div>
          <SectionHead
            eyebrow={t('landing.home.setup.eyebrow')}
            eyebrowTone="emerald"
            title={t('landing.home.setup.title')}
            description={t('landing.home.setup.desc')}
          />

          <ol className="mt-9 space-y-6">
            {asList(t('landing.home.setup.steps', { returnObjects: true })).map((s, i) => (
              <li key={i} className="flex gap-4">
                <StepNumber n={i + 1} tone="emerald" />
                <div className="pt-1">
                  <p className="text-[15.5px] font-semibold text-gray-900 dark:text-white">
                    {s.title}
                  </p>
                  <p className="mt-1 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[46ch]">
                    {s.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button to={routes.register} arrow>
              {t('landing.home.setup.cta')}
            </Button>
            <Button to={routes.docs} variant="secondary">
              {t('landing.home.btnDocs')}
            </Button>
          </div>
        </div>

        <div>
          {/*
            Kod bloğu artık hero'da değil burada. Ana sayfanın en üstünde bir
            <script> etiketi görmek, teknik olmayan alıcıya "bu benim işim
            değil" dedirtiyordu. Burada ise bir kurulum adımının yanında
            duruyor ve altındaki not "bunu yapıştıracak birine ihtiyacınız
            yoksa bize sorun" diyor.
          */}
          <div
            className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10
            bg-gray-950 shadow-panel"
          >
            <div className="flex items-center justify-between px-4 h-11 border-b border-white/[0.07]">
              <span className="flex items-center gap-2 text-[12px] font-mono text-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                {t('landing.home.setup.file')}
              </span>
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px]
                  font-medium text-gray-300 hover:text-white hover:bg-white/10 transition"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied ? t('common.copied') : t('common.copy')}
              </button>
            </div>
            <pre className="overflow-x-auto p-5 text-[13px] leading-[1.8] text-gray-200">
              <code>{snippet}</code>
            </pre>
          </div>

          <p className="mt-4 flex items-start gap-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
            <PlugZap className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            {t('landing.home.setup.note')}
          </p>

          <div className="mt-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-gray-400 dark:text-gray-500">
              {t('landing.home.setup.worksWith')}
            </p>
            <Marquee className="mt-4">
              {(Array.isArray(platforms) ? platforms : []).map((p) => (
                <span
                  key={p}
                  className="text-[15px] font-medium text-gray-400 dark:text-gray-500 whitespace-nowrap"
                >
                  {p}
                </span>
              ))}
            </Marquee>
          </div>
        </div>
      </div>
    </Section>
  );
};

/* -------------------------------------------------------------- güvenlik */

const Security = ({ t }: { t?: any; [prop: string]: any }) => {
  const items = t('landing.home.security.items', { returnObjects: true });
  const icons = [ShieldCheck, Users, Globe, Clock];
  return (
    <Section bordered>
      <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] gap-12 lg:gap-16">
        <SectionHead
          eyebrow={t('landing.home.security.eyebrow')}
          eyebrowTone="emerald"
          title={t('landing.home.security.title')}
          description={t('landing.home.security.desc')}
        />

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-7">
          {(Array.isArray(items) ? items : []).map((item, i) => {
            const Icon = icons[i % icons.length];
            return (
              <div key={i}>
                <AccentIcon icon={Icon} tone="emerald" />
                <h3 className="mt-3.5 text-[15.5px] font-semibold text-gray-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {item.body}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </Section>
  );
};

/* ------------------------------------------------------------ fiyat kısayolu */

const PricingTeaser = ({ t, routes }: { t?: any; routes?: any; [prop: string]: any }) => (
  <Section tone="subtle" bordered>
    <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-center">
      <SectionHead
        eyebrow={t('landing.home.plans.eyebrow')}
        title={t('landing.home.plans.title')}
        description={t('landing.home.plans.desc')}
      />

      <div className="grid sm:grid-cols-3 gap-3">
        {['free', 'pro', 'enterprise'].map((id, i) => (
          <Card
            key={id}
            hover
            className={[
              'p-4',
              i === 1 ? 'ring-2 ring-indigo-500/25 border-indigo-200 dark:border-indigo-500/30' : ''
            ].join(' ')}
          >
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {t('pricingPage.plans.' + id + '.name')}
            </p>
            <p className="mt-2 text-[20px] font-semibold tracking-tight text-gray-900 dark:text-white tabular-nums">
              {t('landing.home.plans.price.' + id)}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-500 dark:text-gray-400">
              {t('landing.home.plans.note.' + id)}
            </p>
          </Card>
        ))}
        <div className="sm:col-span-3">
          <TextLink to={routes.pricing}>{t('landing.home.plans.link')}</TextLink>
        </div>
      </div>
    </div>
  </Section>
);

/* ------------------------------------------------------------------- SSS */

const Faq = ({ t }: { t?: any; [prop: string]: any }) => {
  const items = t('landing.home.faq.items', { returnObjects: true });
  return (
    <Section bordered>
      <div className="grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-16 items-start">
        {/* Başlık kaydırma boyunca sabit kalır; aksi halde uzun akordeonun
            yanında yarım ekranlık boş bir sütun duruyordu. */}
        <div className="lg:sticky lg:top-28">
          <SectionHead
            title={t('landing.home.faq.title')}
            description={t('landing.home.faq.desc')}
          />
        </div>
        <Accordion items={Array.isArray(items) ? items : []} />
      </div>
    </Section>
  );
};

/* ------------------------------------------------------------------- CTA */

const FinalCta = ({ t, routes }: { t?: any; routes?: any; [prop: string]: any }) => (
  // Düz koyu şerit. İçinde bulanık mor bir parıltı ve maskelenmiş bir ızgara
  // vardı; ikisi de yalnızca dekorasyondu ve bölümü hazır şablon gibi
  // gösteriyordu. Kontrast zaten renk değişiminden geliyor.
  <section className="px-5 sm:px-8 py-24 sm:py-28 bg-gray-950 dark:bg-black">
    <div className="max-w-3xl mx-auto text-center">
      <h2 className="text-[34px] sm:text-[46px] font-semibold tracking-[-0.035em] leading-[1.08] text-white">
        {t('landing.home.ctaTitle')}
      </h2>
      <p className="mt-5 text-[17px] leading-relaxed text-gray-300 max-w-[50ch] mx-auto">
        {t('landing.home.ctaDesc')}
      </p>
      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Button to={routes.register} variant="inverse" size="lg" arrow>
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
      <p className="mt-6 text-[13.5px] text-gray-400">{t('landing.home.ctaNote')}</p>
    </div>
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
        <Problem t={t} />
        <HowItWorks t={t} />
        <FeatureTour t={t} routes={routes} />
        <UseCases t={t} />
        <Setup t={t} routes={routes} />
        <Security t={t} />
        <PricingTeaser t={t} routes={routes} />
        <Faq t={t} />
        <FinalCta t={t} routes={routes} />
      </Shell>
    </>
  );
};

export default Home;
