// Plan and billing — the owner's page (plan §9.3).
//
// What it shows comes from the server (GET /api/billing): the plan in force,
// this month's usage against the plan's limits, and the subscription Paddle
// last reported. Changing the plan happens on the checkout page; payment
// method, invoices and cancellation in Paddle's customer portal.

import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowRight, CreditCard, ExternalLink, Rocket, Building2, Store } from 'lucide-react';
import { billingAPI } from '../services/api';
import { errorMessage, useAsync } from '../hooks/useAsync';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePlans } from '../hooks/usePlans';
import { formatDateTime } from '../lib/format';
import type { BillingOverview } from '../types/api';

const PLAN_ICON = { FREE: Store, PRO: Rocket, ENTERPRISE: Building2 } as const;

const Meter = ({
  label,
  used,
  limit,
  locale
}: {
  label: string;
  used: number;
  limit: number;
  locale: string;
}) => {
  const { t } = useTranslation();
  const share = limit > 0 ? Math.min(1, used / limit) : 0;
  const fmt = new Intl.NumberFormat(locale);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-gray-700 dark:text-gray-200">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
          {t('billing.ofLimit', { used: fmt.format(used), limit: fmt.format(limit) })}
        </span>
      </div>
      <div className="mt-1.5 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <div
          className={`h-full rounded-full ${share >= 1 ? 'bg-red-500' : share >= 0.8 ? 'bg-amber-500' : 'bg-indigo-500'}`}
          style={{ width: `${Math.max(share * 100, used ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
};

const Billing = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  const base = `${language === 'en' ? '/en' : ''}/dashboard`;
  const { plans } = usePlans();
  const [opening, setOpening] = useState(false);
  const isOwner = user?.role === 'owner';

  const overview = useAsync<BillingOverview | null>(
    () => (isOwner ? billingAPI.overview().then((r) => r.data) : Promise.resolve(null)),
    [isOwner],
    { initial: null, fallbackMessage: t('common.loadError', 'Yüklenemedi') }
  );
  const data = overview.data;

  const openPortal = async () => {
    setOpening(true);
    try {
      const { data: portal } = await billingAPI.portal();
      window.open(portal.url, '_blank', 'noopener');
    } catch (error) {
      toast.error(errorMessage(error, t('billing.portalError')));
    } finally {
      setOpening(false);
    }
  };

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-600 dark:text-gray-300">
        {t('billing.ownerOnly')}
      </div>
    );
  }

  const planInfo = plans?.find((p) => p.type === data?.plan);
  const Icon = PLAN_ICON[data?.plan ?? 'FREE'];
  const price = planInfo?.price.monthly ?? null;
  const money = (amount: number, currency: string) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      amount
    );
  const sub = data?.subscription;
  const date = (value: string | null) => (value ? formatDateTime(value).split(' ')[0] : '');

  return (
    <>
      <Helmet>
        <title>{`${t('billing.title')} — Support.io`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {t('billing.title')}
        </h1>
        <p className="mt-2 mb-8 text-gray-600 dark:text-gray-400">{t('billing.subtitle')}</p>

        {overview.error && (
          <p className="mb-6 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            {overview.error}
          </p>
        )}

        {!data ? (
          <div className="grid gap-4 md:grid-cols-2 animate-pulse motion-reduce:animate-none">
            <div className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800" />
            <div className="h-48 rounded-2xl bg-gray-100 dark:bg-gray-800" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {/* ------------------------------------------------ mevcut plan */}
            <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('billing.currentPlan')}
              </p>
              <div className="mt-3 flex items-center gap-3">
                <span className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </span>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {t('pricingPage.plans.' + data.plan.toLowerCase() + '.name')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {price === null || price === 0
                      ? t('billing.free')
                      : `${money(price, planInfo!.price.currency)} ${t('billing.perMonth')}`}
                  </p>
                </div>
                {sub && (
                  <span
                    className={`ml-auto px-2.5 py-1 rounded-full text-xs font-medium ${
                      sub.status === 'active' || sub.status === 'trialing'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                    }`}
                  >
                    {t('billing.status.' + sub.status)}
                  </span>
                )}
              </div>

              {sub?.currentPeriodEnd && (
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-300">
                  {sub.cancelAtPeriodEnd || sub.status === 'canceled'
                    ? t('billing.endsAt', { date: date(sub.currentPeriodEnd) })
                    : t('billing.renews', { date: date(sub.currentPeriodEnd) })}
                </p>
              )}
              {sub?.status === 'past_due' && sub.graceEndsAt && (
                <p className="mt-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
                  {t('billing.graceUntil', { date: date(sub.graceEndsAt) })}
                </p>
              )}

              <div className="mt-6 flex flex-wrap gap-2">
                {data.plan !== 'ENTERPRISE' && (
                  <Link
                    to={`${base}/upgrade?plan=${data.plan === 'PRO' ? 'ENTERPRISE' : 'PRO'}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                  >
                    {t('billing.upgrade')} <ArrowRight className="w-4 h-4" />
                  </Link>
                )}
                {sub?.manageable && (
                  <button
                    type="button"
                    onClick={openPortal}
                    disabled={opening}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    <CreditCard className="w-4 h-4" /> {t('billing.manage')}
                    <ExternalLink className="w-3.5 h-3.5 opacity-60" />
                  </button>
                )}
              </div>
              {sub?.manageable && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {t('billing.manageHelp')}
                </p>
              )}
            </section>

            {/* ------------------------------------------------- kullanım */}
            <section className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {t('billing.usageTitle')}
              </p>
              <div className="mt-4 space-y-4">
                <Meter
                  label={t('billing.usage.sites')}
                  used={data.usage.sites}
                  limit={data.limits.sites}
                  locale={locale}
                />
                <Meter
                  label={t('billing.usage.seats')}
                  used={data.usage.seats}
                  limit={data.limits.agents}
                  locale={locale}
                />
                <Meter
                  label={t('billing.usage.conversations')}
                  used={data.usage.conversations}
                  limit={data.limits.monthlyConversations}
                  locale={locale}
                />
                <Meter
                  label={t('billing.usage.assistant')}
                  used={data.usage.assistantReplies}
                  limit={data.limits.assistant.monthlyReplies}
                  locale={locale}
                />
              </div>
              <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">{t('billing.resets')}</p>
            </section>
          </div>
        )}
      </div>
    </>
  );
};

export default Billing;
