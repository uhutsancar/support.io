// "Upgrade your plan", offered the moment the server refuses something for
// the plan — a fourth site on a plan with three, a paid feature on the free
// plan. The request interceptor (services/http.ts) announces the refusal; this
// dialog, mounted once in the dashboard layout, turns it into a way forward.
// Only the owner can change the plan; anyone else is told to ask them.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Rocket, X } from 'lucide-react';
import { PLAN_REQUIRED_EVENT } from '../../services/http';
import { useAuth } from '../../contexts/AuthContext';

interface PlanRequired {
  code: 'PLAN_UPGRADE_REQUIRED' | 'PLAN_LIMIT_REACHED';
  details: { resource?: string } | null;
}

const UpgradeDialog = ({ base }: { base: string }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [open, setOpen] = useState<PlanRequired | null>(null);

  useEffect(() => {
    const onRequired = (event: Event) => setOpen((event as CustomEvent<PlanRequired>).detail);
    window.addEventListener(PLAN_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(PLAN_REQUIRED_EVENT, onRequired);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;
  const isOwner = user?.role === 'owner';
  const resource = open.details?.resource;
  const reason =
    open.code === 'PLAN_LIMIT_REACHED'
      ? t(resource ? `upgrade.limit.${resource}` : 'upgrade.limitReached', {
          defaultValue: t('upgrade.limitReached')
        })
      : t('upgrade.featureLocked');

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-dialog-title"
      onClick={() => setOpen(null)}
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-800 shadow-2xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(null)}
          aria-label={t('common.close')}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <X className="w-4 h-4" />
        </button>
        <span className="w-11 h-11 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center">
          <Rocket className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </span>
        <h2
          id="upgrade-dialog-title"
          className="mt-4 text-lg font-bold text-gray-900 dark:text-white"
        >
          {t('upgrade.dialogTitle')}
        </h2>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-200">{reason}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {isOwner ? t('upgrade.body') : t('upgrade.askOwner')}
        </p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(null)}
            className="px-4 py-2 text-sm rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            {t('upgrade.notNow')}
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={() => {
                setOpen(null);
                navigate(`${base}/upgrade`);
              }}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
            >
              {t('upgrade.seePlans')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UpgradeDialog;
