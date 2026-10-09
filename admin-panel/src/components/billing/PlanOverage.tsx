/**
 * After a downgrade below what the workspace uses (BIL-04): which sites and
 * members are on hold, and the owner's choice of which stay active. Nothing
 * is deleted; an upgrade brings everything back.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { PauseCircle } from 'lucide-react';
import { billingAPI } from '../../services/api';
import { errorMessage, useAsync } from '../../hooks/useAsync';
import type { PlanOverage as Overage } from '../../types/api';

const toggle = (list: string[], id: string, max: number) =>
  list.includes(id) ? list.filter((x) => x !== id) : list.length < max ? [...list, id] : list;

const Pill = ({ suspended }: { suspended: boolean }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`ml-auto shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${
        suspended
          ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
          : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
      }`}
    >
      {suspended ? t('overage.suspended') : t('overage.active')}
    </span>
  );
};

const PlanOverage = ({ upgradeLink }: { upgradeLink: string }) => {
  const { t } = useTranslation();
  const state = useAsync<Overage | null>(() => billingAPI.overage().then((r) => r.data), [], {
    initial: null,
    fallbackMessage: t('common.loadError', 'Yüklenemedi')
  });
  const [sites, setSites] = useState<string[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const data = state.data;

  useEffect(() => {
    if (!data) return;
    setSites(data.sites.filter((s) => !s.suspendedAt).map((s) => s.id));
    setMembers(data.members.filter((m) => !m.owner && !m.suspendedAt).map((m) => m.id));
  }, [data]);

  if (!data?.over) return null;
  const seatsForOthers = Math.max(0, data.limits.agents - 1);

  const save = async () => {
    setSaving(true);
    try {
      const { data: next } = await billingAPI.keep(sites, members);
      state.setData(next);
      toast.success(t('overage.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('overage.saveError')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby="overage-title"
      className="mt-6 rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-gray-800 p-6"
    >
      <h2
        id="overage-title"
        className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white"
      >
        <PauseCircle className="w-5 h-5 text-amber-500" />
        {t('overage.title')}
      </h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        {t('overage.description', { sites: data.limits.sites, agents: data.limits.agents })}
      </p>

      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <fieldset>
          <legend className="text-sm font-medium text-gray-900 dark:text-white">
            {t('overage.sites', { chosen: sites.length, limit: data.limits.sites })}
          </legend>
          <ul className="mt-3 space-y-2">
            {data.sites.map((site) => (
              <li key={site.id}>
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm cursor-pointer has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={sites.includes(site.id)}
                    disabled={!sites.includes(site.id) && sites.length >= data.limits.sites}
                    onChange={() => setSites((list) => toggle(list, site.id, data.limits.sites))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900 dark:text-white">
                      {site.name}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {site.domain}
                    </span>
                  </span>
                  <Pill suspended={Boolean(site.suspendedAt)} />
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        <fieldset>
          <legend className="text-sm font-medium text-gray-900 dark:text-white">
            {t('overage.members', { chosen: members.length + 1, limit: data.limits.agents })}
          </legend>
          <ul className="mt-3 space-y-2">
            {data.members.map((member) => (
              <li key={member.id}>
                <label className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm cursor-pointer has-[:disabled]:cursor-not-allowed">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    checked={member.owner || members.includes(member.id)}
                    disabled={
                      member.owner ||
                      (!members.includes(member.id) && members.length >= seatsForOthers)
                    }
                    onChange={() => setMembers((list) => toggle(list, member.id, seatsForOthers))}
                  />
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-gray-900 dark:text-white">
                      {member.name}
                    </span>
                    <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                      {member.owner ? t('overage.owner') : member.email}
                    </span>
                  </span>
                  <Pill suspended={Boolean(member.suspendedAt)} />
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? t('common.saving') : t('overage.save')}
        </button>
        <Link
          to={upgradeLink}
          className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          {t('overage.upgrade')}
        </Link>
      </div>
    </section>
  );
};

export default PlanOverage;
