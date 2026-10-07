// The checkout page: choose a plan and billing period, review the order,
// pay on Paddle's secure overlay.
//
// The page never opens a plan itself. Paying only starts the purchase;
// the plan changes when Paddle's signed webhook reaches the server
// (services/billing.ts), and this page then sees it by asking the server
// again (GET /api/billing) until the new plan shows up.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowLeft,
  Check,
  Loader2,
  Lock,
  Rocket,
  Building2,
  PartyPopper,
  Mail
} from 'lucide-react';
import { billingAPI } from '../services/api';
import { errorMessage, useAsync } from '../hooks/useAsync';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePlans, PLAN_FEATURE_ORDER } from '../hooks/usePlans';
import { openCheckout, releaseCheckout } from '../lib/paddle';
import type { BillingOverview, PlanInfo } from '../types/api';
import { SUPPORT_EMAIL } from '../lib/contact';

type Paid = 'PRO' | 'ENTERPRISE';
type Cycle = 'monthly' | 'yearly';
type Phase = 'idle' | 'opening' | 'waiting' | 'done' | 'slow';

const ICON = { PRO: Rocket, ENTERPRISE: Building2 } as const;
const CONTACT = `mailto:${SUPPORT_EMAIL}?subject=Plan%20y%C3%BCkseltme`;

const Upgrade = () => {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const { language } = useLanguage();
  const locale = language === 'en' ? 'en-US' : 'tr-TR';
  const base = `${language === 'en' ? '/en' : ''}/dashboard`;
  const [params] = useSearchParams();
  const { plans } = usePlans();
  const [plan, setPlan] = useState<Paid>(
    params.get('plan') === 'ENTERPRISE' ? 'ENTERPRISE' : 'PRO'
  );
  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [phase, setPhase] = useState<Phase>('idle');
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);
  const isOwner = user?.role === 'owner';

  const overview = useAsync<BillingOverview | null>(
    () => (isOwner ? billingAPI.overview().then((r) => r.data) : Promise.resolve(null)),
    [isOwner],
    { initial: null, fallbackMessage: t('common.loadError', 'Yüklenemedi') }
  );
  const data = overview.data;

  useEffect(
    () => () => {
      releaseCheckout();
      if (polling.current) clearInterval(polling.current);
    },
    []
  );

  const paid = useMemo(
    () => (plans ?? []).filter((p): p is PlanInfo & { type: Paid } => p.type !== 'FREE'),
    [plans]
  );
  const selected = paid.find((p) => p.type === plan);
  const fmt = new Intl.NumberFormat(locale);
  const money = (amount: number, currency = 'TRY') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      amount
    );
  const perMonth = (p: PlanInfo) => (cycle === 'yearly' ? p.price.yearly : p.price.monthly) ?? 0;
  const saving = (p: PlanInfo) =>
    p.price.monthly && p.price.yearly
      ? Math.round((1 - p.price.yearly / p.price.monthly) * 100)
      : 0;

  const bullets = (p: PlanInfo) => [
    t('pricingPage.units.sites', { count: p.sites }),
    t('pricingPage.units.agents', { count: p.agents }),
    t('pricingPage.units.conversations', { n: fmt.format(p.monthlyConversations) }),
    t('pricingPage.units.assistant', { n: fmt.format(p.assistant.monthlyReplies) }),
    t('pricingPage.units.assistantDepth', { count: p.assistant.repliesPerConversation }),
    ...PLAN_FEATURE_ORDER.filter((f) => p.features.includes(f)).map((f) =>
      t('pricingPage.matrix.' + f)
    )
  ];

  const purchasable = data?.billing.purchasable[plan]?.[cycle] ?? false;
  const liveSub =
    data?.subscription && ['active', 'trialing', 'past_due'].includes(data.subscription.status);
  const onPlan = data?.plan === plan;
  const blocker = !data
    ? null
    : onPlan
      ? t('checkout.alreadyOn')
      : liveSub
        ? t('checkout.hasSubscription')
        : !data.emailVerified
          ? t('checkout.verifyFirst')
          : !purchasable
            ? 'closed'
            : null;

  const waitForPlan = () => {
    setPhase('waiting');
    const started = Date.now();
    polling.current = setInterval(async () => {
      try {
        const { data: fresh } = await billingAPI.overview();
        if (fresh.plan === plan) {
          if (polling.current) clearInterval(polling.current);
          overview.setData(fresh);
          await refresh();
          setPhase('done');
          return;
        }
      } catch {
        /* keep waiting; the webhook decides */
      }
      if (Date.now() - started > 90_000) {
        if (polling.current) clearInterval(polling.current);
        setPhase('slow');
      }
    }, 3000);
  };

  const pay = async () => {
    setPhase('opening');
    try {
      const { data: session } = await billingAPI.checkout(plan, cycle);
      await openCheckout(session, language === 'en' ? 'en' : 'tr', (event) => {
        if (event.name === 'checkout.completed') waitForPlan();
        if (event.name === 'checkout.closed') setPhase((p) => (p === 'opening' ? 'idle' : p));
      });
      setPhase((p) => (p === 'opening' ? 'idle' : p));
    } catch (error) {
      setPhase('idle');
      toast.error(errorMessage(error, t('checkout.error')));
    }
  };

  if (!isOwner) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-gray-600 dark:text-gray-300">
        {t('billing.ownerOnly')}
      </div>
    );
  }

  if (phase === 'done' || phase === 'waiting' || phase === 'slow') {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <span className="mx-auto w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
          {phase === 'done' ? (
            <PartyPopper className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <Loader2 className="w-6 h-6 text-indigo-600 dark:text-indigo-400 animate-spin" />
          )}
        </span>
        <h1 className="mt-5 text-2xl font-bold text-gray-900 dark:text-white">
          {phase === 'done' ? t('checkout.success') : t('checkout.waiting')}
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-300">
          {phase === 'done'
            ? t('checkout.successBody')
            : phase === 'slow'
              ? t('checkout.slow')
              : ''}
        </p>
        <Link
          to={base}
          className="mt-8 inline-flex px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          {t('checkout.goDashboard')}
        </Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${t('checkout.title')} — Support.io`}</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link
          to={`${base}/billing`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> {t('checkout.back')}
        </Link>
        <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {t('checkout.title')}
        </h1>
        <p className="mt-2 mb-8 text-gray-600 dark:text-gray-400">{t('checkout.subtitle')}</p>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
          {/* ------------------------------------------------ seçim */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {t('checkout.choosePlan')}
              </p>
              <div
                role="radiogroup"
                aria-label={t('checkout.cycle')}
                className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-800"
              >
                {(['monthly', 'yearly'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={cycle === c}
                    onClick={() => setCycle(c)}
                    className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition ${
                      cycle === c
                        ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-300'
                    }`}
                  >
                    {t('checkout.' + c)}
                    {c === 'yearly' && selected && saving(selected) > 0 && (
                      <span className="ml-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        {t('checkout.save', { percent: saving(selected) })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div
              className="mt-4 grid gap-4 sm:grid-cols-2"
              role="radiogroup"
              aria-label={t('checkout.choosePlan')}
            >
              {paid.map((p) => {
                const Icon = ICON[p.type];
                const active = p.type === plan;
                return (
                  <button
                    key={p.type}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setPlan(p.type)}
                    className={`text-left rounded-2xl border-2 p-5 transition bg-white dark:bg-gray-800 ${
                      active
                        ? 'border-indigo-600 shadow-sm'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
                        <Icon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 dark:text-white">
                          {t('pricingPage.plans.' + p.type.toLowerCase() + '.name')}
                        </p>
                        {data?.plan === p.type && (
                          <p className="text-xs text-indigo-600 dark:text-indigo-400">
                            {t('checkout.current')}
                          </p>
                        )}
                      </div>
                      <span
                        className={`ml-auto w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          active
                            ? 'border-indigo-600 bg-indigo-600'
                            : 'border-gray-300 dark:border-gray-600'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-white" />}
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
                      {money(perMonth(p), p.price.currency)}
                      <span className="ml-1 text-sm font-medium text-gray-500">
                        {t('checkout.perMonth')}
                      </span>
                    </p>
                    <ul className="mt-4 space-y-2">
                      {bullets(p).map((item) => (
                        <li
                          key={item}
                          className="flex gap-2 text-sm text-gray-600 dark:text-gray-300"
                        >
                          <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ------------------------------------------------ özet */}
          <aside className="lg:sticky lg:top-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('checkout.summary')}
            </p>
            {selected && (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">
                    {t('checkout.plan', {
                      plan: t('pricingPage.plans.' + plan.toLowerCase() + '.name')
                    })}
                  </dt>
                  <dd className="font-medium text-gray-900 dark:text-white tabular-nums">
                    {money(perMonth(selected), selected.price.currency)} {t('checkout.perMonth')}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-600 dark:text-gray-300">{t('checkout.cycle')}</dt>
                  <dd className="text-gray-900 dark:text-white">
                    {cycle === 'yearly' ? t('checkout.billedYearly') : t('checkout.billedMonthly')}
                  </dd>
                </div>
                {cycle === 'yearly' && selected.price.monthly && selected.price.yearly && (
                  <div className="flex justify-between gap-3">
                    <dt className="text-emerald-700 dark:text-emerald-400">
                      {t('checkout.yearlySaving')}
                    </dt>
                    <dd className="font-medium text-emerald-700 dark:text-emerald-400 tabular-nums">
                      {money(
                        (selected.price.monthly - selected.price.yearly) * 12,
                        selected.price.currency
                      )}
                    </dd>
                  </div>
                )}
                <div className="pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between gap-3">
                  <dt className="font-semibold text-gray-900 dark:text-white">
                    {t('checkout.total')}
                  </dt>
                  <dd className="text-lg font-bold text-gray-900 dark:text-white tabular-nums">
                    {cycle === 'yearly'
                      ? `${money(perMonth(selected) * 12, selected.price.currency)} ${t('checkout.perYear')}`
                      : `${money(perMonth(selected), selected.price.currency)} ${t('checkout.perMonth')}`}
                  </dd>
                </div>
              </dl>
            )}

            {blocker === 'closed' ? (
              <div className="mt-5 space-y-3">
                <p className="rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2.5 text-sm text-indigo-800 dark:text-indigo-200">
                  {t('checkout.closed')}
                </p>
                <a
                  href={CONTACT}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
                >
                  <Mail className="w-4 h-4" /> {t('checkout.contact')}
                </a>
              </div>
            ) : (
              <>
                {blocker && (
                  <p className="mt-5 rounded-lg bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 text-sm text-amber-800 dark:text-amber-300">
                    {blocker}
                  </p>
                )}
                <button
                  type="button"
                  onClick={pay}
                  disabled={!data || Boolean(blocker) || phase === 'opening'}
                  className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {phase === 'opening' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  {phase === 'opening' ? t('checkout.opening') : t('checkout.pay')}
                </button>
              </>
            )}
            <p className="mt-4 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
              {t('checkout.instant')}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {t('checkout.methods')}
            </p>
            <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {t('checkout.secure')}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('checkout.cancelAnytime')}
            </p>
          </aside>
        </div>
      </div>
    </>
  );
};

export default Upgrade;
