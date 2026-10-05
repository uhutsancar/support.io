// A paid screen on a plan that does not include it.
//
// The menu shows these screens on every plan, marked PRO, so the free plan can
// see what an upgrade buys. Opening one shows what it does and the plan that
// has it, with the way there — instead of an empty page and an error toast.
// What a plan includes comes from GET /api/plans (domain/plans.ts).

import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { usePlans } from '../../hooks/usePlans';
import type { PlanInfo, PlanType } from '../../types/api';

/** The first plan, cheapest first, that includes `feature`. */
export function planWith(plans: PlanInfo[] | null, feature: string): PlanType | null {
  return plans?.find((p) => p.features.includes(feature))?.type ?? null;
}

/** Whether the signed-in organization's plan includes `feature`; null while loading. */
export function useHasFeature(feature: string): boolean | null {
  const { user } = useAuth();
  const { plans } = usePlans();
  if (!plans) return null;
  const plan = plans.find((p) => p.type === (user?.organization?.planType || 'FREE'));
  return Boolean(plan?.features.includes(feature));
}

const PlanGate = ({ feature, children }: { feature: string; children: React.ReactNode }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { plans } = usePlans();
  const has = useHasFeature(feature);
  // Loading, or the plan table could not be read: the server still decides,
  // so show the page rather than block it.
  if (has !== false) return <>{children}</>;

  const base = `${language === 'en' ? '/en' : ''}/dashboard`;
  const needed = planWith(plans, feature) ?? 'PRO';
  const planName = t('pricingPage.plans.' + needed.toLowerCase() + '.name');
  const isOwner = user?.role === 'owner';

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16">
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-8 text-center">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
          <Lock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </span>
        <h1 className="mt-5 text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
          {t('upgrade.gate.title', {
            feature: t(`upgrade.features.${feature}.name`),
            plan: planName
          })}
        </h1>
        <p className="mt-3 text-gray-600 dark:text-gray-300">
          {t(`upgrade.features.${feature}.benefit`)}
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {isOwner ? t('upgrade.gate.body') : t('upgrade.askOwner')}
        </p>
        {isOwner && (
          <div className="mt-7 flex flex-col sm:flex-row justify-center gap-2">
            <Link
              to={`${base}/upgrade?plan=${needed}`}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
            >
              {t('upgrade.gate.cta', { plan: planName })} <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              to={`${base}/billing`}
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              {t('upgrade.gate.compare')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanGate;
