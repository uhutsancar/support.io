/**
 * Fiyatlandırma.
 *
 * Planların kapsamı burada yazılmaz: sayılar ve özellikler GET /api/plans'tan
 * gelir, yani sunucunun uyguladığı tablodan (backend/src/domain/plans.ts).
 * Eski sayfa "10 site", "sınırsız kullanıcı" ve "sınırsız konuşma" yazıyordu;
 * sunucu ise 3 site, 5 kullanıcı ve aylık konuşma kotası uyguluyordu. Artık
 * satılanla uygulanan ayrışamaz. Bu dosyada yalnızca etiketler ve görünüm var.
 */

import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Check, Minus, MessageCircle, Store, Rocket, Building2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Shell, { PageHero, useMarketingRoutes } from '../components/marketing/Shell';
import {
  Button,
  Section,
  SectionHead,
  Card,
  AccentIcon,
  Accordion,
  Reveal,
  accent,
  asList
} from '../components/marketing/kit';
import { PLAN_FEATURE_ORDER, planKey, usePlans } from '../hooks/usePlans';
import { useAuth } from '../contexts/AuthContext';
import type { PlanInfo } from '../types/api';

type T = ReturnType<typeof useTranslation>['t'];

/** Görünüm — planın kendisi sunucudan gelir. */
const PLAN_LOOK: Record<string, { tone: string; icon: LucideIcon; highlight?: boolean }> = {
  FREE: { tone: 'sky', icon: Store },
  PRO: { tone: 'indigo', icon: Rocket, highlight: true },
  ENTERPRISE: { tone: 'violet', icon: Building2 }
};
const look = (plan: PlanInfo) => PLAN_LOOK[plan.type] || PLAN_LOOK.FREE;

/** "Hangi plan size uygun" kartları sunucuya bakmadan da yazılabilir. */
const PLAN_IDS = ['free', 'pro', 'enterprise'];

/** "90 gün", "1 yıl", "5 yıl": bir planın en uzun konuşma geçmişi. */
function historyPeriod(plan: PlanInfo, t: T): string | null {
  const days = plan.retention?.maxDays;
  if (!days) return null;
  return days % 365 === 0 || days === 1830
    ? t('pricingPage.units.years', { count: Math.round(days / 365) })
    : t('pricingPage.units.days', { count: days });
}

/**
 * Bir kartın maddeleri: sınırlar, bir önceki planda olmayan özellikler ve
 * çeviride duran ek maddeler ("kurulumda birebir destek" gibi hizmetler).
 */
function planItems(
  plan: PlanInfo,
  previous: PlanInfo | undefined,
  t: T,
  number: Intl.NumberFormat
) {
  const items = [
    t('pricingPage.units.sites', { count: plan.sites }),
    t('pricingPage.units.agents', { count: plan.agents }),
    t('pricingPage.units.conversations', { n: number.format(plan.monthlyConversations) }),
    t('pricingPage.units.assistant', { n: number.format(plan.assistant.monthlyReplies) })
  ];
  const history = historyPeriod(plan, t);
  if (history) items.push(t('pricingPage.units.history', { period: history }));
  for (const feature of PLAN_FEATURE_ORDER) {
    if (plan.features.includes(feature) && !previous?.features.includes(feature)) {
      items.push(t('pricingPage.matrix.' + feature));
    }
  }
  if (!plan.branding && (previous ? previous.branding : true)) {
    items.push(t('pricingPage.matrix.noBranding'));
  }
  return items.concat(
    asList<string>(t('pricingPage.plans.' + planKey(plan) + '.extras', { returnObjects: true }))
  );
}

/** Karşılaştırma tablosu — satır: özellik, sütun: plan. */
function matrixRows(number: Intl.NumberFormat, t: T) {
  return [
    { key: 'sites', value: (p: PlanInfo) => number.format(p.sites) },
    { key: 'agents', value: (p: PlanInfo) => number.format(p.agents) },
    { key: 'conversations', value: (p: PlanInfo) => number.format(p.monthlyConversations) },
    { key: 'history', value: (p: PlanInfo) => historyPeriod(p, t) ?? '–' },
    { key: 'widget', value: () => true },
    { key: 'faq', value: () => true },
    { key: 'assistant', value: () => true },
    { key: 'assistantReplies', value: (p: PlanInfo) => number.format(p.assistant.monthlyReplies) },
    {
      key: 'assistantDepth',
      value: (p: PlanInfo) => number.format(p.assistant.repliesPerConversation)
    },
    { key: 'analytics', value: () => true },
    ...PLAN_FEATURE_ORDER.map((feature) => ({
      key: feature as string,
      value: (p: PlanInfo) => p.features.includes(feature)
    })),
    { key: 'noBranding', value: (p: PlanInfo) => !p.branding }
  ];
}

const Cell = ({
  value,
  yesLabel,
  noLabel
}: {
  /** true / false render a tick or a dash; anything else is shown verbatim. */
  value?: boolean | string;
  yesLabel?: string;
  noLabel?: string;
}) => {
  if (value === true) {
    return (
      <>
        <Check
          className="w-[18px] h-[18px] mx-auto text-emerald-600 dark:text-emerald-400"
          aria-hidden="true"
        />
        <span className="sr-only">{yesLabel}</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus
          className="w-[18px] h-[18px] mx-auto text-gray-300 dark:text-gray-700"
          aria-hidden="true"
        />
        <span className="sr-only">{noLabel}</span>
      </>
    );
  }
  return (
    <span className="text-[14px] font-medium text-gray-900 dark:text-white tabular-nums">
      {value}
    </span>
  );
};

/** Plan tablosu gelene kadar kartların yerini tutar; sayfa zıplamaz. */
const CardSkeleton = () => (
  <div className="h-[520px] rounded-3xl border border-gray-200 dark:border-white/[0.08] p-7 bg-white dark:bg-white/[0.025]">
    <div className="animate-pulse motion-reduce:animate-none space-y-4">
      <div className="h-5 w-28 rounded bg-gray-100 dark:bg-white/[0.06]" />
      <div className="h-4 w-full rounded bg-gray-100 dark:bg-white/[0.06]" />
      <div className="h-10 w-36 rounded bg-gray-100 dark:bg-white/[0.06]" />
      <div className="h-11 w-full rounded-xl bg-gray-100 dark:bg-white/[0.06]" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-3.5 w-3/4 rounded bg-gray-100 dark:bg-white/[0.06]" />
      ))}
    </div>
  </div>
);

const Pricing = () => {
  const { t, i18n } = useTranslation();
  const routes = useMarketingRoutes();
  const [yearly, setYearly] = useState(false);
  const { plans, failed } = usePlans();
  const { isAuthenticated } = useAuth();

  const locale = i18n.language === 'en' ? 'en-US' : 'tr-TR';
  const number = new Intl.NumberFormat(locale);
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      amount
    );

  // Yıllık indirim, yıllık fiyatı olan ilk ücretli plandan hesaplanır.
  const paid = plans?.find((p) => (p.price.monthly ?? 0) > 0 && p.price.yearly !== null);
  const discount = paid
    ? Math.round((1 - (paid.price.yearly as number) / (paid.price.monthly as number)) * 100)
    : 0;

  const faq = t('pricingPage.faqItems', { returnObjects: true });
  const rows = matrixRows(number, t);

  return (
    <Shell>
      <Helmet>
        <title>{t('pricingPage.meta.title') + ' — Support.io'}</title>
        <meta name="description" content={t('pricingPage.meta.description')} />
      </Helmet>

      <PageHero
        eyebrow={t('pricingPage.eyebrow')}
        title={t('pricingPage.title')}
        description={t('pricingPage.description')}
        align="center"
      >
        <div className="mt-9 flex justify-center">
          <div
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-gray-100 dark:bg-white/[0.06]"
            role="radiogroup"
            aria-label={t('pricingPage.billing')}
          >
            {[
              { value: false, label: t('pricingPage.monthly') },
              { value: true, label: t('pricingPage.yearly') }
            ].map((option) => (
              <button
                key={String(option.value)}
                role="radio"
                aria-checked={yearly === option.value}
                onClick={() => setYearly(option.value)}
                className={[
                  'px-4 py-2 rounded-lg text-[13.5px] font-medium transition',
                  yearly === option.value
                    ? 'bg-white dark:bg-white/[0.12] text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                ].join(' ')}
              >
                {option.label}
              </button>
            ))}
            {discount > 0 && (
              <span
                className="ml-1 mr-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold
                bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
              >
                {t('pricingPage.discount', { percent: discount })}
              </span>
            )}
          </div>
        </div>
      </PageHero>

      {/* ----------------------------------------------------- plan kartları */}
      <Section size="sm">
        {failed ? (
          <p
            role="alert"
            className="max-w-xl mx-auto text-center text-[14.5px] text-gray-600 dark:text-gray-400"
          >
            {t('pricingPage.loadError')}
          </p>
        ) : (
          <div className="grid gap-5 lg:grid-cols-3">
            {!plans
              ? PLAN_IDS.map((id) => <CardSkeleton key={id} />)
              : plans.map((plan, i) => {
                  const id = planKey(plan);
                  const { tone, icon, highlight } = look(plan);
                  const price = yearly ? plan.price.yearly : plan.price.monthly;
                  const list = planItems(plan, plans[i - 1], t, number);
                  const a = accent(tone);

                  return (
                    <Reveal key={plan.type} delay={i * 0.07}>
                      <div
                        className={[
                          'relative h-full rounded-3xl border p-7 flex flex-col bg-white dark:bg-white/[0.025]',
                          highlight
                            ? 'border-indigo-300 dark:border-indigo-500/40 ring-2 ring-indigo-500/15 shadow-panel-lg lg:-mt-3 lg:mb-[-12px]'
                            : 'border-gray-200 dark:border-white/[0.08]'
                        ].join(' ')}
                      >
                        {highlight && (
                          <span
                            className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full
                            text-[11px] font-semibold uppercase tracking-wider bg-indigo-600 text-white
                            shadow-[0_6px_16px_-6px_rgba(79,70,229,.8)] whitespace-nowrap"
                          >
                            {t('pricingPage.popular')}
                          </span>
                        )}

                        <div className="flex items-center gap-3">
                          <AccentIcon icon={icon} tone={tone} />
                          <h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">
                            {t('pricingPage.plans.' + id + '.name')}
                          </h2>
                        </div>

                        <p className="mt-3 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 min-h-[44px]">
                          {t('pricingPage.plans.' + id + '.tagline')}
                        </p>

                        <div className="mt-6 pb-6 border-b border-gray-100 dark:border-white/[0.07]">
                          {price === null ? (
                            <span className="text-[32px] font-semibold tracking-[-0.03em] text-gray-900 dark:text-white">
                              {t('pricingPage.custom')}
                            </span>
                          ) : (
                            <>
                              <span
                                className="text-[40px] font-semibold tracking-[-0.038em]
                                text-gray-900 dark:text-white tabular-nums"
                              >
                                {money(price, plan.price.currency)}
                              </span>
                              {/*
                                Fiyat plan başınadır, kullanıcı başına değil;
                                ücretsiz planda "/ ay" da yazmıyoruz, çünkü
                                faturalandırılan bir şey yok.
                              */}
                              {price > 0 && (
                                <span className="ml-1.5 text-[14px] text-gray-500 dark:text-gray-400">
                                  {t('pricingPage.perMonth')}
                                </span>
                              )}
                            </>
                          )}
                          <p className="mt-2 text-[12.5px] text-gray-500 dark:text-gray-500 min-h-[18px]">
                            {price === null
                              ? t('pricingPage.contactNote')
                              : price === 0
                                ? t('pricingPage.freeNote')
                                : yearly
                                  ? t('pricingPage.billedYearly', {
                                      total: money(price * 12, plan.price.currency)
                                    })
                                  : t('pricingPage.billedMonthly')}
                          </p>
                        </div>

                        {/*
                          Signed in, a paid plan goes straight to the checkout
                          page (and the free plan to the dashboard); signed
                          out, to sign-up first.
                        */}
                        <Button
                          to={
                            !isAuthenticated
                              ? routes.register
                              : plan.type === 'FREE'
                                ? routes.dashboard
                                : `${routes.dashboard}/upgrade?plan=${plan.type}`
                          }
                          variant={highlight ? 'primary' : 'secondary'}
                          className="mt-6 w-full"
                          arrow={highlight}
                        >
                          {t('pricingPage.plans.' + id + '.cta')}
                        </Button>

                        <p
                          className="mt-6 text-[11.5px] font-semibold uppercase tracking-[0.08em]
                          text-gray-400 dark:text-gray-500"
                        >
                          {t('pricingPage.plans.' + id + '.includes')}
                        </p>
                        <ul className="mt-3 space-y-2.5 flex-1">
                          {list.map((item, j) => (
                            <li key={j} className="flex gap-2.5">
                              <Check className={['w-4 h-4 mt-0.5 shrink-0', a.text].join(' ')} />
                              <span className="text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                                {item}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </Reveal>
                  );
                })}
          </div>
        )}
      </Section>

      {/* ------------------------------------------- hangi plan bana uygun */}
      <Section tone="mist">
        <SectionHead
          index={1}
          eyebrow={t('pricingPage.chooseEyebrow')}
          title={t('pricingPage.chooseTitle')}
          align="center"
        />
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {PLAN_IDS.map((id, i) => (
            <Reveal key={id} delay={i * 0.06}>
              <Card className="p-6 h-full">
                <p
                  className={[
                    'text-[13px] font-semibold',
                    accent(PLAN_LOOK[id.toUpperCase()].tone).text
                  ].join(' ')}
                >
                  {t('pricingPage.plans.' + id + '.name')}
                </p>
                <p className="mt-2.5 text-[15px] font-medium leading-snug text-gray-900 dark:text-white">
                  {t('pricingPage.plans.' + id + '.forWho')}
                </p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                  {t('pricingPage.plans.' + id + '.forWhoBody')}
                </p>
              </Card>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------- karşılaştırma tablosu */}
      {plans && (
        <Section>
          <SectionHead
            index={2}
            eyebrow={t('pricingPage.feature')}
            title={t('pricingPage.compareTitle')}
            description={t('pricingPage.compareDesc')}
          />

          <div className="mt-10 overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <caption className="sr-only">{t('pricingPage.compareTitle')}</caption>
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="pb-4 text-[11.5px] font-semibold uppercase tracking-[0.08em]
                    text-gray-400 dark:text-gray-500"
                  >
                    {t('pricingPage.feature')}
                  </th>
                  {plans.map((plan) => (
                    <th
                      key={plan.type}
                      scope="col"
                      className={[
                        'pb-4 w-[130px] text-center text-[14px] font-semibold',
                        look(plan).highlight
                          ? 'text-indigo-600 dark:text-indigo-400'
                          : 'text-gray-900 dark:text-white'
                      ].join(' ')}
                    >
                      {t('pricingPage.plans.' + planKey(plan) + '.name')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.key}
                    className="border-t border-gray-100 dark:border-white/[0.06]
                    hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <th
                      scope="row"
                      className="py-3.5 pr-4 text-[14px] font-normal text-gray-700 dark:text-gray-300"
                    >
                      {t('pricingPage.matrix.' + row.key)}
                    </th>
                    {plans.map((plan) => (
                      <td
                        key={plan.type}
                        className={[
                          'py-3.5 text-center',
                          look(plan).highlight ? 'bg-indigo-50/40 dark:bg-indigo-500/[0.05]' : ''
                        ].join(' ')}
                      >
                        <Cell
                          value={row.value(plan)}
                          yesLabel={t('common.yes')}
                          noLabel={t('common.no')}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ------------------------------------------------------------- SSS */}
      <Section tone="cream">
        <div className="grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-16">
          <SectionHead
            index={3}
            eyebrow={t('homePage.faq.eyebrow')}
            title={t('pricingPage.faqTitle')}
            description={t('pricingPage.faqDesc')}
          />
          <Reveal>
            <Accordion items={Array.isArray(faq) ? faq : []} numbered />
          </Reveal>
        </div>
      </Section>

      {/* ------------------------------------------------------------- CTA */}
      <Section tone="deep">
        <Reveal className="text-center max-w-2xl mx-auto">
          <MessageCircle className="w-7 h-7 mx-auto text-indigo-300" strokeWidth={1.8} />
          <h2 className="mt-5 text-[32px] sm:text-[44px] font-bold tracking-[-0.04em] leading-[1.06] text-white text-balance">
            {t('landing.home.ctaTitle')}
          </h2>
          <p className="mt-5 text-[16.5px] leading-relaxed text-gray-400">
            {t('landing.home.ctaDesc')}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button to={routes.register} size="lg" arrow>
              {t('landing.home.ctaBtn1')}
            </Button>
            <Button
              to={routes.docs}
              size="lg"
              className="bg-white/10 text-white border border-white/20 hover:bg-white/[0.16] shadow-none"
            >
              {t('landing.home.btnDocs')}
            </Button>
          </div>
        </Reveal>
      </Section>
    </Shell>
  );
};

export default Pricing;
