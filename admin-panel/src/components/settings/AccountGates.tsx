/**
 * Two strips the dashboard layout shows above every page.
 *
 *   TrialBanner      the free Pro trial is running (PRD-15): days left and
 *                    the way to a plan, for the people who can buy one
 *   PlanOverageBanner  the plan went below what the workspace uses (BIL-04):
 *                    a member on hold reads that they cannot reply; the
 *                    owner is sent to the billing page to choose
 *   MfaRequiredGate  the organization requires two-step sign-in and this
 *                    account has none (SEC-04): the set-up takes the page's
 *                    place until it is done; the server refuses everything
 *                    else meanwhile anyway (MFA_SETUP_REQUIRED)
 */
import { lazy, Suspense, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PauseCircle, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { MFA_SETUP_REQUIRED_EVENT } from '../../services/http';
import { billingAPI } from '../../services/api';

const MfaEnrolment = lazy(() =>
  import('./SecuritySettings').then((m) => ({ default: m.MfaEnrolment }))
);

export const TrialBanner = ({ base }: { base: string }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  // Read once per mount: the count of days does not need to tick live.
  const [now] = useState(Date.now);
  const endsAt = user?.organization?.trialEndsAt;
  if (!endsAt || !user || !['owner', 'admin'].includes(user.role)) return null;
  const msLeft = new Date(endsAt).getTime() - now;
  if (msLeft <= 0) return null;
  const days = Math.ceil(msLeft / 86_400_000);
  return (
    <div
      role="status"
      className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200 text-sm"
    >
      <Sparkles className="hidden sm:block w-4 h-4 shrink-0" />
      <span className="flex-1">
        {days <= 1 ? t('account.trial.lastDay') : t('account.trial.banner', { count: days })}
      </span>
      <Link
        to={`${base}/upgrade`}
        className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 transition"
      >
        {t('account.trial.choose')}
      </Link>
    </div>
  );
};

export const PlanOverageBanner = ({ base }: { base: string }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [ownerOver, setOwnerOver] = useState(false);
  const isOwner = user?.role === 'owner';

  useEffect(() => {
    if (!isOwner) return;
    let live = true;
    billingAPI
      .overage()
      .then(({ data }) => live && setOwnerOver(data.over))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [isOwner]);

  if (!user?.seatSuspended && !ownerOver) return null;
  return (
    <div
      role="status"
      className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200 text-sm"
    >
      <PauseCircle className="hidden sm:block w-4 h-4 shrink-0" />
      <span className="flex-1">
        {user?.seatSuspended ? t('overage.seatBanner') : t('overage.ownerBanner')}
      </span>
      {!user?.seatSuspended && (
        <Link
          to={`${base}/billing`}
          className="self-start sm:self-auto px-3 py-1.5 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition"
        >
          {t('overage.choose')}
        </Link>
      )}
    </div>
  );
};

export const MfaRequiredGate = ({ children }: { children: ReactNode }) => {
  const { t } = useTranslation();
  const { user, refresh } = useAuth();
  const [flagged, setFlagged] = useState(false);

  useEffect(() => {
    const onRequired = () => setFlagged(true);
    window.addEventListener(MFA_SETUP_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(MFA_SETUP_REQUIRED_EVENT, onRequired);
  }, []);

  if (!user || !(user.mfaSetupRequired || (flagged && !user.mfaEnabled))) return <>{children}</>;

  return (
    <div className="max-w-2xl mx-auto mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h1 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white">
        <ShieldCheck className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        {t('account.security.required.title')}
      </h1>
      <p className="mt-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
        {t('account.security.required.body')}
      </p>
      <Suspense fallback={<p className="text-sm text-gray-500">{t('common.loading')}</p>}>
        <MfaEnrolment
          onEnabled={async () => {
            setFlagged(false);
            await refresh();
          }}
        />
      </Suspense>
    </div>
  );
};
