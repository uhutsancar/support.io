/**
 * Yapay zekâ asistanı sayfası (`/yapay-zeka`, `/en/ai`).
 *
 * Buradaki her cümle backend'deki gerçek davranışa karşılık gelir
 * (services/ai/autoReply.ts, replyPolicy.ts, orderLookup.ts; ai/README.md):
 * üç mod, kodla yapılan ön ve son denetimler, devralmada susma, yalnızca
 * doğrulanmış müşteri için imzalı sipariş sorgusu, barındırılan modele geri
 * düşüş olmaması. Yeni bir iddia eklenecekse önce oradaki karşılığı olmalı.
 */

import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import {
  Ban,
  Check,
  Clock,
  Hand,
  HardDrive,
  Languages,
  HelpCircle,
  Package,
  PenLine,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Waves,
  Smile,
  BookOpen,
  KeyRound,
  Truck
} from 'lucide-react';
import Shell, { useMarketingRoutes } from '../components/marketing/Shell';
import {
  Accordion,
  AppFrame,
  Button,
  Card,
  Eyebrow,
  Reveal,
  Section,
  SectionHead,
  asList
} from '../components/marketing/kit';
import { AiVisual } from '../components/marketing/visuals';
import ChatPlayer from '../components/marketing/ChatPlayer';

const DOES_ICONS = [Waves, BookOpen, Package, Ban, Clock, UserRoundCheck];
const COPILOT_ICONS = [ScrollText, PenLine, Smile, Languages, Sparkles, HelpCircle];
const ORDER_ICONS = [KeyRound, ShieldCheck, Truck];

const AiAssistant = () => {
  const { t } = useTranslation();
  const routes = useMarketingRoutes();
  const list = <T,>(k: string) => asList<T>(t('aiPage.' + k, { returnObjects: true }));

  const modes = list<{ name: string; tag: string; body: string; points: string[] }>('modes');
  const does = list<{ title: string; body: string }>('does');
  const never = list<string>('never');
  const copilot = list<string>('copilot');
  const orderSteps = list<{ title: string; body: string }>('orderSteps');
  const requirements = list<{ label: string; value: string }>('requirements');

  return (
    <Shell darkHero>
      <Helmet>
        <title>{t('aiPage.meta.title') + ' — Support.io'}</title>
        <meta name="description" content={t('aiPage.meta.description')} />
      </Helmet>

      {/* ------------------------------------------------------------ hero */}
      <section className="relative overflow-hidden pt-32 sm:pt-40 pb-20 sm:pb-28 px-5 sm:px-8 bg-[#0b0d17] text-white">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] gap-14 items-center">
          <Reveal>
            <Eyebrow tone="violet" className="!text-violet-300">
              {t('aiPage.eyebrow')}
            </Eyebrow>
            <h1 className="mt-5 text-[40px] sm:text-[60px] font-bold tracking-[-0.045em] leading-[1.02] text-balance">
              {t('aiPage.title')}
            </h1>
            <p className="mt-6 text-[17.5px] leading-[1.65] text-gray-400 max-w-[56ch]">{t('aiPage.desc')}</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Button to={routes.register} size="lg" arrow>
                {t('aiPage.ctaPrimary')}
              </Button>
              <Button
                to={routes.docs}
                size="lg"
                className="bg-white/10 text-white border border-white/20 hover:bg-white/[0.16] shadow-none"
              >
                {t('aiPage.ctaSecondary')}
              </Button>
            </div>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
              {list<string>('heroPoints').map((p) => (
                <li key={p} className="flex items-center gap-1.5 text-[13.5px] text-gray-300">
                  <Check className="w-4 h-4 text-violet-300" /> {p}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal y={36} delay={0.1}>
            <div className="dark mx-auto max-w-[380px]">
              <ChatPlayer script="ai" height={420} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ modlar */}
      <Section tone="plain" wide>
        <SectionHead
          index={1}
          eyebrow={t('aiPage.modesEyebrow')}
          eyebrowTone="violet"
          title={t('aiPage.modesTitle')}
          description={t('aiPage.modesDesc')}
          align="center"
        />
        <div className="mt-12 grid md:grid-cols-3 gap-4">
          {modes.map((m, i) => (
            <Reveal key={m.name} delay={i * 0.07}>
              <Card
                className={[
                  'p-7 h-full',
                  i === 2 ? 'ring-2 ring-violet-500 border-transparent dark:border-transparent' : ''
                ].join(' ')}
              >
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-violet-600 dark:text-violet-400">
                  {m.tag}
                </span>
                <h3 className="mt-2 text-[22px] font-bold tracking-[-0.02em] text-gray-950 dark:text-white">
                  {m.name}
                </h3>
                <p className="mt-2.5 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">{m.body}</p>
                <ul className="mt-5 space-y-2 border-t border-gray-100 dark:border-white/[0.07] pt-5">
                  {(m.points || []).map((p) => (
                    <li key={p} className="flex gap-2 text-[13.5px] text-gray-700 dark:text-gray-300">
                      <Check className="w-4 h-4 mt-0.5 shrink-0 text-violet-600 dark:text-violet-400" /> {p}
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------ ne yapar / yapmaz */}
      <Section tone="mist" wide>
        <SectionHead index={2} eyebrow={t('aiPage.doesEyebrow')} eyebrowTone="violet" title={t('aiPage.doesTitle')} />
        <div className="mt-12 grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
          <div className="grid sm:grid-cols-2 gap-3">
            {does.map((d, i) => {
              const Icon = DOES_ICONS[i % DOES_ICONS.length];
              return (
                <Reveal key={d.title} delay={i * 0.05}>
                  <Card className="p-5 h-full">
                    <Icon className="w-5 h-5 text-violet-600 dark:text-violet-400" strokeWidth={1.8} />
                    <h3 className="mt-3 text-[15px] font-semibold text-gray-950 dark:text-white">{d.title}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">{d.body}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
          <Reveal delay={0.1}>
            <div className="h-full rounded-3xl bg-[#0b0d17] text-white p-7">
              <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-300">
                <Hand className="w-4 h-4" /> {t('aiPage.neverTitle')}
              </span>
              <ul className="mt-6 space-y-4">
                {never.map((n) => (
                  <li key={n} className="flex gap-3 text-[14.5px] leading-relaxed text-gray-300">
                    <Ban className="w-4 h-4 mt-1 shrink-0 text-rose-400" /> {n}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------------- yardımcı */}
      <Section tone="plain" wide>
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <SectionHead
              index={3}
              eyebrow={t('aiPage.copilotEyebrow')}
              eyebrowTone="violet"
              title={t('aiPage.copilotTitle')}
              description={t('aiPage.copilotDesc')}
            />
            <div className="mt-8 grid grid-cols-2 gap-2.5">
              {copilot.map((c, i) => {
                const Icon = COPILOT_ICONS[i % COPILOT_ICONS.length];
                return (
                  <Reveal key={c} delay={i * 0.04}>
                    <span className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl border border-gray-200 dark:border-white/10 text-[13.5px] font-medium text-gray-800 dark:text-gray-200">
                      <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" strokeWidth={1.8} />
                      {c}
                    </span>
                  </Reveal>
                );
              })}
            </div>
          </div>
          <Reveal y={30}>
            <AppFrame label={t('viz.ai.frame')} tone="violet">
              <AiVisual />
            </AppFrame>
          </Reveal>
        </div>
      </Section>

      {/* ----------------------------------------------------- sipariş */}
      <Section tone="cream" wide>
        <div className="grid lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)] gap-12 lg:gap-16 items-center">
          <Reveal y={30} className="order-2 lg:order-1">
            <div className="mx-auto max-w-[360px]">
              <ChatPlayer script="story" height={340} />
            </div>
          </Reveal>
          <div className="order-1 lg:order-2">
            <SectionHead
              index={4}
              eyebrow={t('aiPage.orderEyebrow')}
              title={t('aiPage.orderTitle')}
              description={t('aiPage.orderDesc')}
            />
            <ol className="mt-9 space-y-5">
              {orderSteps.map((s, i) => {
                const Icon = ORDER_ICONS[i % ORDER_ICONS.length];
                return (
                  <Reveal as="li" key={s.title} delay={i * 0.07} className="flex gap-4">
                    <span className="w-10 h-10 shrink-0 rounded-xl bg-white dark:bg-white/[0.05] border border-gray-200 dark:border-white/10 flex items-center justify-center">
                      <Icon className="w-[18px] h-[18px] text-indigo-600 dark:text-indigo-400" strokeWidth={1.8} />
                    </span>
                    <span>
                      <span className="block text-[15.5px] font-semibold text-gray-950 dark:text-white">
                        {i + 1}. {s.title}
                      </span>
                      <span className="block mt-1 text-[14.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                        {s.body}
                      </span>
                    </span>
                  </Reveal>
                );
              })}
            </ol>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- gizlilik */}
      <Section tone="deep" wide>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <Reveal>
            <Eyebrow index={5} tone="violet" className="!text-violet-300">
              {t('aiPage.privacyEyebrow')}
            </Eyebrow>
            <h2 className="mt-4 text-[31px] sm:text-[44px] font-bold tracking-[-0.035em] leading-[1.06] text-white">
              {t('aiPage.privacyTitle')}
            </h2>
            <p className="mt-5 text-[16.5px] leading-[1.65] text-gray-400 max-w-[54ch]">{t('aiPage.privacyDesc')}</p>
          </Reveal>
          <Reveal delay={0.1}>
            <dl className="rounded-3xl border border-white/10 bg-white/[0.03] divide-y divide-white/[0.08]">
              {requirements.map((r) => (
                <div key={r.label} className="flex items-center justify-between gap-4 px-6 py-5">
                  <dt className="flex items-center gap-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-gray-400">
                    <HardDrive className="w-4 h-4 text-violet-300" /> {r.label}
                  </dt>
                  <dd className="text-[15px] font-semibold text-white text-right">{r.value}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------------------ SSS */}
      <Section tone="plain" wide>
        <div className="grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-16">
          <SectionHead index={6} eyebrow={t('homePage.faq.eyebrow')} title={t('aiPage.faqTitle')} />
          <Reveal>
            <Accordion items={list('faq')} numbered />
          </Reveal>
        </div>
      </Section>
    </Shell>
  );
};

export default AiAssistant;
