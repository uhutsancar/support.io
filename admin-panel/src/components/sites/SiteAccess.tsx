// Where a site's widget may run, whether it is running, and its key.
//
// The widget only gets a session on a page whose origin is listed here
// (backend config/siteOrigins.ts), so this is the first thing to check when
// a freshly installed widget stays invisible. Regenerating the key ends every
// widget session issued under the old one at once; the confirmation says so.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { X, RefreshCw } from 'lucide-react';
import { sitesAPI } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import { formatDateTime } from '../../lib/format';
import { publicOrigin, publicSocketOrigin } from '../../lib/publicOrigin';
import SiteIntegrations from './SiteIntegrations';
import type { Site } from '../../types/api';

/** A widget heard from within this window counts as connected. */
const CONNECTED_WITHIN_MS = 24 * 60 * 60 * 1000;

export type InstallState = 'not-installed' | 'connected' | 'stale';

/** Not installed / connected / last seen a while ago, from the installation record. */
export function installState(site: Site, now = Date.now()): InstallState {
  const seen = site.installation?.lastSeenAt || site.installation?.verifiedAt;
  if (!seen) return 'not-installed';
  return now - new Date(seen).getTime() <= CONNECTED_WITHIN_MS ? 'connected' : 'stale';
}

/** The three-state badge the site card and this dialog share. */
export const InstallBadge = ({ site }: { site: Site }) => {
  const { t } = useTranslation();
  const state = installState(site);
  const tone =
    state === 'connected'
      ? 'text-green-700 dark:text-green-400'
      : state === 'stale'
        ? 'text-amber-700 dark:text-amber-400'
        : 'text-gray-500 dark:text-gray-400';
  const dot =
    state === 'connected' ? 'bg-green-500' : state === 'stale' ? 'bg-amber-500' : 'bg-gray-400';
  const seen = site.installation?.lastSeenAt || site.installation?.verifiedAt;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${tone}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {state === 'not-installed'
        ? t('sites.access.notInstalled')
        : state === 'connected'
          ? t('sites.access.connected')
          : t('sites.access.lastSeen', { when: formatDateTime(seen) })}
    </span>
  );
};

export interface SiteAccessProps {
  site: Site;
  onClose: () => void;
  onSaved: (site: Site) => void;
}

const SiteAccess = ({ site, onClose, onSaved }: SiteAccessProps) => {
  const { t } = useTranslation();
  const [text, setText] = useState((site.allowedOrigins || []).join('\n'));
  const [busy, setBusy] = useState<'save' | 'rekey' | null>(null);
  const origin = publicOrigin();
  const socketOrigin = publicSocketOrigin();

  const save = async () => {
    setBusy('save');
    try {
      const allowedOrigins = text
        .split(/[\n,]/)
        .map((line) => line.trim())
        .filter(Boolean);
      const { data } = await sitesAPI.update(site._id, { allowedOrigins });
      setText((data.site.allowedOrigins || []).join('\n'));
      onSaved(data.site);
      toast.success(t('sites.access.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('sites.access.saveError')));
    } finally {
      setBusy(null);
    }
  };

  const regenerate = async () => {
    if (!window.confirm(t('sites.access.rekeyConfirm'))) return;
    setBusy('rekey');
    try {
      const { data } = await sitesAPI.regenerateKey(site._id);
      onSaved(data.site);
      toast.success(t('sites.access.rekeyed'));
    } catch (error) {
      toast.error(errorMessage(error, t('sites.access.rekeyError')));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-access-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2
              id="site-access-title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              {t('sites.access.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{site.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <section className="mb-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {t('sites.access.installation')}
          </h3>
          <InstallBadge site={site} />
          {site.installation?.origin && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t('sites.access.seenOn', {
                origin: site.installation.origin,
                path: site.installation.path || '/'
              })}
            </p>
          )}
        </section>

        <section className="mb-5">
          <label
            htmlFor="allowed-origins"
            className="block text-sm font-semibold text-gray-900 dark:text-white mb-1"
          >
            {t('sites.access.originsLabel')}
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('sites.access.originsHelp')}
          </p>
          <textarea
            id="allowed-origins"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            spellCheck={false}
            placeholder="https://www.example.com"
            className="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={save}
              disabled={busy !== null}
              className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {t('sites.access.save')}
            </button>
          </div>
        </section>

        <section className="mb-5">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {t('sites.access.cspTitle')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('sites.access.cspHelp')}
          </p>
          <pre className="text-xs bg-gray-50 dark:bg-gray-700 dark:text-white px-3 py-2 rounded border border-gray-200 dark:border-gray-600 overflow-x-auto">
            {`script-src ${origin};\nconnect-src ${origin} ${socketOrigin};\nimg-src ${origin} data:;`}
          </pre>
        </section>

        <div className="mb-5 pt-4 border-t border-gray-200 dark:border-gray-700">
          <SiteIntegrations site={site} onChanged={onSaved} />
        </div>

        <section className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            {t('sites.access.rekeyTitle')}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            {t('sites.access.rekeyHelp')}
          </p>
          <button
            type="button"
            onClick={regenerate}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-red-300 dark:border-red-500/40 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
            {t('sites.access.rekey')}
          </button>
        </section>
      </div>
    </div>
  );
};

export default SiteAccess;
