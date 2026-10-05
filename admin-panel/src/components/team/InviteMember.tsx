// Inviting someone to the team, and the invitations still waiting for an
// answer. The invited person chooses their own password on the page the
// e-mail opens (pages/AcceptInvitation.tsx); nobody types one for them.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Mail, RotateCw, X } from 'lucide-react';
import { invitationsAPI } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import { formatDateTime } from '../../lib/format';
import type { Invitation, Site } from '../../types/api';

/** The roles a caller may hand out: below their own; the owner gives any. */
export function assignableRoles(callerRole: string | undefined): string[] {
  if (callerRole === 'owner') return ['agent', 'manager', 'admin'];
  if (callerRole === 'admin') return ['agent', 'manager'];
  if (callerRole === 'manager') return ['agent'];
  return [];
}

/** A plan-limit refusal reads as what to do about it. */
export function limitMessage(error: unknown, fallback: string, t: (k: string) => string): string {
  const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
  if (code === 'PLAN_LIMIT_REACHED') return t('team.invite.limitReached');
  return errorMessage(error, fallback);
}

export const InviteModal = ({
  sites,
  callerRole,
  onClose,
  onSent
}: {
  sites: Site[];
  callerRole?: string;
  onClose: () => void;
  onSent: () => void;
}) => {
  const { t, i18n } = useTranslation();
  const roles = assignableRoles(callerRole);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(roles[0] || 'agent');
  const [assignedSites, setAssignedSites] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    try {
      const { data } = await invitationsAPI.create({
        email,
        role,
        assignedSites,
        locale: i18n.language
      });
      toast.success(data.sent ? t('team.invite.sent', { email }) : t('team.invite.savedNotSent'));
      onSent();
    } catch (error) {
      toast.error(limitMessage(error, t('team.invite.error'), t));
    } finally {
      setSending(false);
    }
  };

  const toggleSite = (id: string) =>
    setAssignedSites((current) =>
      current.includes(id) ? current.filter((s) => s !== id) : [...current, id]
    );

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-5">
          <h2 id="invite-title" className="text-xl font-bold text-gray-900 dark:text-white">
            {t('team.invite.title')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label
              htmlFor="invite-email"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('team.modal.email')} *
            </label>
            <input
              id="invite-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="invite-role"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              {t('team.modal.role')}
            </label>
            <select
              id="invite-role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {roles.map((r) => (
                <option key={r} value={r}>
                  {t(`team.filters.${r}`)}
                </option>
              ))}
            </select>
          </div>
          {sites.length > 1 && (
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('team.invite.sites')}
              </legend>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {t('team.invite.sitesHelp')}
              </p>
              <div className="space-y-1">
                {sites.map((site) => (
                  <label
                    key={site._id}
                    className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <input
                      type="checkbox"
                      checked={assignedSites.includes(site._id)}
                      onChange={() => toggleSite(site._id)}
                    />
                    {site.name}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">{t('team.invite.howItWorks')}</p>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
            >
              {t('team.modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={sending}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              {t('team.invite.send')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Invitations not yet answered, with resend and revoke. */
export const PendingInvitations = ({ refreshKey }: { refreshKey: number }) => {
  const { t, i18n } = useTranslation();
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const load = () =>
    invitationsAPI
      .list()
      .then(({ data }) =>
        setInvitations(data.invitations.filter((i) => i.status === 'pending' || i.status === 'expired'))
      )
      .catch(() => setInvitations([]));

  useEffect(() => {
    void load();
  }, [refreshKey]);

  if (!invitations.length) return null;

  const act = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      toast.success(success);
      await load();
    } catch (error) {
      toast.error(limitMessage(error, t('team.invite.error'), t));
    }
  };

  return (
    <section className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        {t('team.invite.pending')}
      </h2>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {invitations.map((invitation) => (
          <li
            key={invitation._id}
            className="py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm"
          >
            <span className="flex-1 text-gray-900 dark:text-white break-all">
              {invitation.email}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {t(`team.filters.${invitation.role}`)}
            </span>
            <span
              className={
                invitation.status === 'expired'
                  ? 'text-amber-700 dark:text-amber-400'
                  : 'text-gray-500 dark:text-gray-400'
              }
            >
              {invitation.status === 'expired'
                ? t('team.invite.expired')
                : t('team.invite.until', { when: formatDateTime(invitation.expiresAt) })}
            </span>
            <span className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  act(
                    () => invitationsAPI.resend(invitation._id, i18n.language),
                    t('team.invite.resent')
                  )
                }
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <RotateCw className="w-3.5 h-3.5" />
                {t('team.invite.resend')}
              </button>
              <button
                type="button"
                onClick={() =>
                  act(() => invitationsAPI.revoke(invitation._id), t('team.invite.revoked'))
                }
                className="px-2 py-1 rounded border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
              >
                {t('team.invite.revoke')}
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
