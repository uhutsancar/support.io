/**
 * Fiyatlandırma.
 *
 * Planların kapsamı uydurma değil: backend'deki `planFeatures` tablosu ve
 * DashboardLayout'taki menü kapıları ne diyorsa o. Bugün gerçekten kapılı olan
 * şeyler şunlar:
 *
 *   FREE        multiUser: false, export: false, advancedAnalytics: false
 *   PRO         hepsi açık + Ziyaretçiler ve CRM menüleri
 *   ENTERPRISE  PRO + Denetim Kayıtları
 *
 * Eski sayfada "10.000'den fazla şirket güveniyor", "100 Temel Entegrasyon" ve
 * "Gelişmiş Yapay Zeka Botları" yazıyordu; hiçbirinin karşılığı yoktu.
 */

import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Check, Minus, Sparkles, Store, Rocket, Building2 } from 'lucide-react';
import Shell, { PageHero, useMarketingRoutes } from '../components/marketing/Shell';
import {
  Button, Section, SectionHead, Card, AccentIcon, Accordion, accent
} from '../components/marketing/kit';

const PLANS = [
  { id: 'free', monthly: 0, yearly: 0, tone: 'sky', icon: Store },
  { id: 'pro', monthly: 490, yearly: 392, tone: 'indigo', icon: Rocket, highlight: true },
  { id: 'enterprise', monthly: null, yearly: null, tone: 'violet', icon: Building2 }
];

/** Karşılaştırma tablosu — satır: özellik, sütun: plan. */
const MATRIX = [
  { key: 'sites', free: '1', pro: '10', enterprise: '∞' },
  { key: 'agents', free: '1', pro: '∞', enterprise: '∞' },
  { key: 'conversations', free: true, pro: true, enterprise: true },
  { key: 'widget', free: true, pro: true, enterprise: true },
  { key: 'faq', free: true, pro: true, enterprise: true },
  { key: 'departments', free: false, pro: true, enterprise: true },
  { key: 'automation', free: true, pro: true, enterprise: true },
  { key: 'proactive', free: true, pro: true, enterprise: true },
  { key: 'analytics', free: false, pro: true, enterprise: true },
  { key: 'visitors', free: false, pro: true, enterprise: true },
  { key: 'crm', free: false, pro: true, enterprise: true },
  { key: 'aiAssist', free: false, pro: true, enterprise: true },
  { key: 'export', free: false, pro: true, enterprise: true },
  { key: 'audit', free: false, pro: false, enterprise: true },
  { key: 'sso', free: false, pro: false, enterprise: true }
];

const Cell = ({ value, yesLabel, noLabel }: {
  /** true / false render a tick or a dash; anything else is shown verbatim. */
  value?: boolean | string;
  yesLabel?: string;
  noLabel?: string;
}) => {
  if (value === true) {
    return (
      <>
        <Check className="w-[18px] h-[18px] mx-auto text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
        <span className="sr-only">{yesLabel}</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="w-[18px] h-[18px] mx-auto text-gray-300 dark:text-gray-700" aria-hidden="true" />
        <span className="sr-only">{noLabel}</span>
      </>
    );
  }
  return <span className="text-[14px] font-medium text-gray-900 dark:text-white tabular-nums">{value}</span>;
};

const Pricing = () => {
  const { t, i18n } = useTranslation();
  const routes = useMarketingRoutes();
  const [yearly, setYearly] = useState(false);

  const currency = new Intl.NumberFormat(i18n.language === 'en' ? 'en-US' : 'tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0
  });

  const faq = t('pricingPage.faqItems', { returnObjects: true });

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
            <span className="ml-1 mr-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold
              bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
              {t('pricingPage.discount')}
            </span>
          </div>
        </div>
      </PageHero>

      {/* ----------------------------------------------------- plan kartları */}
      <Section size="sm">
        <div className="grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan, i) => {
            const price = yearly ? plan.yearly : plan.monthly;
            const features = t('pricingPage.plans.' + plan.id + '.features', { returnObjects: true });
            const list = Array.isArray(features) ? features : [];
            const a = accent(plan.tone);

            return (
              <div key={plan.id}>
                <div
                  className={[
                    'relative h-full rounded-2xl border p-6 flex flex-col bg-white dark:bg-white/[0.025]',
                    plan.highlight
                      ? 'border-indigo-300 dark:border-indigo-500/40 ring-2 ring-indigo-500/15 shadow-panel-lg lg:-mt-3 lg:mb-[-12px]'
                      : 'border-gray-200 dark:border-white/[0.08]'
                  ].join(' ')}
                >
                  {plan.highlight && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full
                      text-[11px] font-semibold uppercase tracking-wider bg-indigo-600 text-white
                      shadow-[0_6px_16px_-6px_rgba(79,70,229,.8)] whitespace-nowrap">
                      {t('pricingPage.popular')}
                    </span>
                  )}

                  <div className="flex items-center gap-3">
                    <AccentIcon icon={plan.icon} tone={plan.tone} />
                    <h2 className="text-[17px] font-semibold text-gray-900 dark:text-white">
                      {t('pricingPage.plans.' + plan.id + '.name')}
                    </h2>
                  </div>

                  <p className="mt-3 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 min-h-[44px]">
                    {t('pricingPage.plans.' + plan.id + '.tagline')}
                  </p>

                  <div className="mt-6 pb-6 border-b border-gray-100 dark:border-white/[0.07]">
                    {price === null ? (
                      <span className="text-[32px] font-semibold tracking-[-0.03em] text-gray-900 dark:text-white">
                        {t('pricingPage.custom')}
                      </span>
                    ) : (
                      <>
                        <span className="text-[40px] font-semibold tracking-[-0.038em]
                          text-gray-900 dark:text-white tabular-nums">
                          {currency.format(price)}
                        </span>
                        {/*
                          Ücretsiz planda "/ kullanıcı / ay" yazmıyoruz: plan
                          zaten tek kullanıcılık ve ücretsiz. "₺0 / kullanıcı /
                          ay · aylık faturalandırılır" cümlesi, faturalandırma
                          olmayan bir planda faturalandırma vaat ediyordu.
                        */}
                        {price > 0 && (
                          <span className="ml-1.5 text-[14px] text-gray-500 dark:text-gray-400">
                            {t('pricingPage.perSeat')}
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
                            ? t('pricingPage.billedYearly')
                            : t('pricingPage.billedMonthly')}
                    </p>
                  </div>

                  <Button
                    to={plan.id === 'enterprise' ? routes.about : routes.register}
                    variant={plan.highlight ? 'primary' : 'secondary'}
                    className="mt-6 w-full"
                    arrow={plan.highlight}
                  >
                    {t('pricingPage.plans.' + plan.id + '.cta')}
                  </Button>

                  <p className="mt-6 text-[11.5px] font-semibold uppercase tracking-[0.08em]
                    text-gray-400 dark:text-gray-500">
                    {t('pricingPage.plans.' + plan.id + '.includes')}
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
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          {t('pricingPage.vatNote')}
        </p>
      </Section>

      {/* ------------------------------------------- hangi plan bana uygun */}
      <Section tone="subtle" bordered>
        <SectionHead
          eyebrow={t('pricingPage.chooseEyebrow')}
          title={t('pricingPage.chooseTitle')}
          align="center"
        />
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => (
            <Card key={plan.id} className="p-5">
              <p className={['text-[13px] font-semibold', accent(plan.tone).text].join(' ')}>
                {t('pricingPage.plans.' + plan.id + '.name')}
              </p>
              <p className="mt-2.5 text-[15px] font-medium leading-snug text-gray-900 dark:text-white">
                {t('pricingPage.plans.' + plan.id + '.forWho')}
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                {t('pricingPage.plans.' + plan.id + '.forWhoBody')}
              </p>
            </Card>
          ))}
        </div>
      </Section>

      {/* --------------------------------------------- karşılaştırma tablosu */}
      <Section bordered>
        <SectionHead title={t('pricingPage.compareTitle')} description={t('pricingPage.compareDesc')} />

        <div className="mt-10 overflow-x-auto -mx-5 sm:mx-0 px-5 sm:px-0">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <caption className="sr-only">{t('pricingPage.compareTitle')}</caption>
            <thead>
              <tr>
                <th scope="col" className="pb-4 text-[11.5px] font-semibold uppercase tracking-[0.08em]
                  text-gray-400 dark:text-gray-500">
                  {t('pricingPage.feature')}
                </th>
                {PLANS.map((plan) => (
                  <th key={plan.id} scope="col"
                    className={[
                      'pb-4 w-[130px] text-center text-[14px] font-semibold',
                      plan.highlight ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-900 dark:text-white'
                    ].join(' ')}>
                    {t('pricingPage.plans.' + plan.id + '.name')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.key} className="border-t border-gray-100 dark:border-white/[0.06]
                  hover:bg-gray-50/70 dark:hover:bg-white/[0.02] transition-colors">
                  <th scope="row" className="py-3.5 pr-4 text-[14px] font-normal text-gray-700 dark:text-gray-300">
                    {t('pricingPage.matrix.' + row.key)}
                  </th>
                  {['free', 'pro', 'enterprise'].map((plan) => (
                    <td key={plan} className={[
                      'py-3.5 text-center',
                      plan === 'pro' ? 'bg-indigo-50/40 dark:bg-indigo-500/[0.05]' : ''
                    ].join(' ')}>
                      <Cell value={row[plan as keyof typeof row]} yesLabel={t('common.yes')} noLabel={t('common.no')} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ------------------------------------------------------------- SSS */}
      <Section tone="subtle" bordered>
        <div className="grid lg:grid-cols-[minmax(0,.8fr)_minmax(0,1.2fr)] gap-10 lg:gap-16">
          <SectionHead title={t('pricingPage.faqTitle')} description={t('pricingPage.faqDesc')} />
          <Accordion items={Array.isArray(faq) ? faq : []} />
        </div>
      </Section>

      {/* ------------------------------------------------------------- CTA */}
      <Section bordered>
        <div className="text-center max-w-2xl mx-auto">
          <Sparkles className="w-7 h-7 mx-auto text-indigo-600 dark:text-indigo-400" strokeWidth={1.8} />
          <h2 className="mt-5 text-[30px] sm:text-[36px] font-semibold tracking-[-0.03em]
            leading-[1.12] text-gray-900 dark:text-white">
            {t('landing.home.ctaTitle')}
          </h2>
          <p className="mt-4 text-[16.5px] leading-relaxed text-gray-600 dark:text-gray-400">
            {t('landing.home.ctaDesc')}
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button to={routes.register} size="lg" arrow>{t('landing.home.ctaBtn1')}</Button>
            <Button to={routes.docs} variant="secondary" size="lg">{t('landing.home.btnDocs')}</Button>
          </div>
        </div>
      </Section>
    </Shell>
  );
};

export default Pricing;
