import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Minus, ArrowRight } from 'lucide-react';

import Shell, { PageHero, Section, useMarketingRoutes } from '../components/marketing/Shell';

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

const PLANS = [
  { id: 'free', monthly: 0, yearly: 0, highlight: false },
  { id: 'pro', monthly: 490, yearly: 392, highlight: true },
  { id: 'enterprise', monthly: null, yearly: null, highlight: false }
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

const Cell = ({ value, yesLabel, noLabel }) => {
  if (value === true) {
    return (
      <>
        <Check className="w-4 h-4 mx-auto text-green-600 dark:text-green-500" aria-hidden="true" />
        <span className="sr-only">{yesLabel}</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus className="w-4 h-4 mx-auto text-gray-300 dark:text-gray-700" aria-hidden="true" />
        <span className="sr-only">{noLabel}</span>
      </>
    );
  }
  return <span className="text-[13.5px] text-gray-900 dark:text-white tabular-nums">{value}</span>;
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

  return (
    <Shell>
      <Helmet>
        <title>{`${t('pricingPage.meta.title')} — Support.io`}</title>
        <meta name="description" content={t('pricingPage.meta.description')} />
      </Helmet>

      <PageHero title={t('pricingPage.title')} description={t('pricingPage.description')}>
        <div className="mt-8 inline-flex items-center gap-1 p-1 rounded-lg bg-gray-100 dark:bg-gray-900"
             role="radiogroup" aria-label={t('pricingPage.billing')}>
          {[
            { value: false, label: t('pricingPage.monthly') },
            { value: true, label: t('pricingPage.yearly') }
          ].map((option) => (
            <button
              key={String(option.value)}
              role="radio"
              aria-checked={yearly === option.value}
              onClick={() => setYearly(option.value)}
              className={`px-3.5 py-1.5 rounded-md text-[13.5px] font-medium transition
                ${yearly === option.value
                  ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
            >
              {option.label}
            </button>
          ))}
          <span className="ml-1.5 mr-1 px-2 py-0.5 rounded text-[11px] font-medium
            bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400">
            {t('pricingPage.discount')}
          </span>
        </div>
      </PageHero>

      {/* ----------------------------------------------------- plan kartları */}
      <Section bordered>
        <div className="grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan) => {
            const price = yearly ? plan.yearly : plan.monthly;
            const features = t(`pricingPage.plans.${plan.id}.features`, { returnObjects: true });
            const list = Array.isArray(features) ? features : [];

            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-6 flex flex-col
                  ${plan.highlight
                    ? 'border-gray-900 dark:border-white'
                    : 'border-gray-200 dark:border-gray-800'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white">
                    {t(`pricingPage.plans.${plan.id}.name`)}
                  </h2>
                  {plan.highlight && (
                    <span className="px-2 py-0.5 rounded text-[10.5px] font-semibold uppercase tracking-wide
                      bg-gray-900 dark:bg-white text-white dark:text-gray-900">
                      {t('pricingPage.popular')}
                    </span>
                  )}
                </div>

                <p className="mt-2 text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400 min-h-[42px]">
                  {t(`pricingPage.plans.${plan.id}.tagline`)}
                </p>

                <div className="mt-5">
                  {price === null ? (
                    <span className="text-[30px] font-semibold tracking-[-0.03em] text-gray-900 dark:text-white">
                      {t('pricingPage.custom')}
                    </span>
                  ) : (
                    <>
                      <span className="text-[36px] font-semibold tracking-[-0.035em] text-gray-900 dark:text-white tabular-nums">
                        {currency.format(price)}
                      </span>
                      <span className="ml-1.5 text-[13.5px] text-gray-500 dark:text-gray-400">
                        {t('pricingPage.perSeat')}
                      </span>
                    </>
                  )}
                </div>
                <p className="mt-1.5 text-[12px] text-gray-500 dark:text-gray-500 min-h-[18px]">
                  {price === null
                    ? t('pricingPage.contactNote')
                    : yearly
                      ? t('pricingPage.billedYearly')
                      : t('pricingPage.billedMonthly')}
                </p>

                <Link
                  to={plan.id === 'enterprise' ? routes.about : routes.register}
                  className={`mt-6 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
                    text-[14px] font-medium transition
                    ${plan.highlight
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                      : 'border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-900'}`}
                >
                  {t(`pricingPage.plans.${plan.id}.cta`)}
                  {plan.highlight && <ArrowRight className="w-3.5 h-3.5" />}
                </Link>

                <ul className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-900 space-y-2.5">
                  {list.map((item, i) => (
                    <li key={i} className="flex gap-2.5">
                      <Check className="w-3.5 h-3.5 mt-1 shrink-0 text-green-600 dark:text-green-500" />
                      <span className="text-[13.5px] leading-relaxed text-gray-600 dark:text-gray-400">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Section>

      {/* --------------------------------------------- karşılaştırma tablosu */}
      <Section title={t('pricingPage.compareTitle')} bordered>
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left">
            <caption className="sr-only">{t('pricingPage.compareTitle')}</caption>
            <thead>
              <tr>
                <th scope="col" className="pb-3 text-[11.5px] font-semibold uppercase tracking-wider
                  text-gray-400 dark:text-gray-500">
                  {t('pricingPage.feature')}
                </th>
                {PLANS.map((plan) => (
                  <th key={plan.id} scope="col" className="pb-3 w-[110px] text-center text-[13px] font-semibold
                    text-gray-900 dark:text-white">
                    {t(`pricingPage.plans.${plan.id}.name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((row) => (
                <tr key={row.key} className="border-t border-gray-100 dark:border-gray-900">
                  <th scope="row" className="py-3 pr-4 text-[13.5px] font-normal text-gray-700 dark:text-gray-300">
                    {t(`pricingPage.matrix.${row.key}`)}
                  </th>
                  {['free', 'pro', 'enterprise'].map((plan) => (
                    <td key={plan} className="py-3 text-center">
                      <Cell
                        value={row[plan]}
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

      {/* ------------------------------------------------------------- SSS */}
      <Section title={t('pricingPage.faqTitle')} bordered={false}>
        <div className="mt-8 max-w-3xl">
          {['q1', 'q2', 'q3', 'q4', 'q5'].map((key) => (
            <details
              key={key}
              className="group border-b border-gray-100 dark:border-gray-900"
            >
              <summary className="flex items-center justify-between gap-6 py-4 cursor-pointer
                text-[15px] font-medium text-gray-900 dark:text-white list-none">
                {t(`pricingPage.faq.${key}.q`)}
                <span className="shrink-0 text-gray-400 transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="pb-5 text-[14px] leading-relaxed text-gray-600 dark:text-gray-400 max-w-[64ch]">
                {t(`pricingPage.faq.${key}.a`)}
              </p>
            </details>
          ))}
        </div>
      </Section>
    </Shell>
  );
};

export default Pricing;
