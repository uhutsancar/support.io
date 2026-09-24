// The shop's side of the assistant: identity verification and order lookup.
//
// The two keys are created on the server and shown here exactly once, in the
// response that created them. The site itself only ever says whether a key is
// set, so reopening this panel shows "set", never the key.

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Copy } from 'lucide-react';
import { sitesAPI } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import type { Site } from '../../types/api';

export interface SiteIntegrationsProps {
  site: Site;
  onChanged: (site: Site) => void;
}

const inputClass =
  'w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none';
const buttonClass =
  'px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition';

/** How a shop's server signs a customer; shown next to a freshly generated key. */
const IDENTITY_EXAMPLE = `// Sunucunuzda (Node.js)
const userHash = crypto.createHmac('sha256', SUPPORTIO_IDENTITY_KEY)
  .update(user.id).digest('hex');

// Sayfada
SupportChat.identify({ userId: user.id, userHash, name: user.name });`;

/** A key shown once, with a copy button. */
const RevealedSecret = ({ secret }: { secret: string }) => {
  const { t } = useTranslation();
  return (
    <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
      <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">
        {t('ai.integrations.secretOnce')}
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs break-all text-gray-900 dark:text-white">{secret}</code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(secret);
            toast.success(t('ai.integrations.copied'));
          }}
          aria-label={t('ai.integrations.copy')}
          className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-500/20"
        >
          <Copy className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const SiteIntegrations = ({ site, onChanged }: SiteIntegrationsProps) => {
  const { t } = useTranslation();
  const integrations = site.integrations;
  const [identitySecret, setIdentitySecret] = useState<string | null>(null);
  const [signingSecret, setSigningSecret] = useState<string | null>(null);
  const [url, setUrl] = useState(integrations?.orderLookup.url ?? '');
  const [enabled, setEnabled] = useState(Boolean(integrations?.orderLookup.enabled));
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try {
      await action();
    } catch (error) {
      toast.error(errorMessage(error, t('ai.integrations.error')));
    } finally {
      setBusy(null);
    }
  };

  const generateIdentity = () =>
    run('identity', async () => {
      if (
        integrations?.identity.configured &&
        !window.confirm(t('ai.integrations.regenerateConfirm'))
      ) {
        return;
      }
      const { data } = await sitesAPI.generateIdentitySecret(site._id);
      setIdentitySecret(data.secret);
      onChanged(data.site);
    });

  const generateSigning = () =>
    run('signing', async () => {
      const { data } = await sitesAPI.generateOrderSigningSecret(site._id);
      setSigningSecret(data.secret);
      onChanged(data.site);
    });

  const saveOrderLookup = () =>
    run('save', async () => {
      const { data } = await sitesAPI.updateOrderLookup(site._id, {
        url: url.trim() || null,
        enabled
      });
      onChanged(data.site);
      toast.success(t('ai.integrations.saved'));
    });

  const testConnection = () =>
    run('test', async () => {
      const { data } = await sitesAPI.testOrderLookup(site._id);
      if (data.ok) toast.success(t('ai.integrations.testOk'));
      else toast.error(t('ai.integrations.testFail', { reason: data.reason }));
    });

  const status = (configured: boolean | undefined) => (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${
        configured
          ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400'
          : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
      }`}
    >
      {configured ? t('ai.integrations.configured') : t('ai.integrations.notConfigured')}
    </span>
  );

  return (
    <section className="px-4 sm:px-6 py-4 border-t border-gray-200 dark:border-gray-700 space-y-5">
      <h3 className="text-base font-semibold text-gray-900 dark:text-white">
        {t('ai.integrations.title')}
      </h3>

      <div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
            {t('ai.integrations.identity')}
          </span>
          {status(integrations?.identity.configured)}
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('ai.integrations.identityHelp')}
        </p>
        <button
          type="button"
          onClick={generateIdentity}
          disabled={busy !== null}
          className={`mt-2 ${buttonClass}`}
        >
          {integrations?.identity.configured
            ? t('ai.integrations.regenerate')
            : t('ai.integrations.generate')}
        </button>
        {identitySecret && (
          <>
            <RevealedSecret secret={identitySecret} />
            <p className="mt-2 text-xs font-medium text-gray-600 dark:text-gray-400">
              {t('ai.integrations.example')}
            </p>
            <pre className="mt-1 text-xs bg-gray-50 dark:bg-gray-700 dark:text-white p-2 rounded overflow-x-auto">
              {IDENTITY_EXAMPLE}
            </pre>
          </>
        )}
      </div>

      <div>
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
          {t('ai.integrations.orderLookup')}
        </span>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {t('ai.integrations.orderHelp')}
        </p>

        <label className="block mt-3 text-sm text-gray-700 dark:text-gray-300" htmlFor="order-url">
          {t('ai.integrations.url')}
        </label>
        <input
          id="order-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://magaza.example.com/support-io/orders"
          className={`mt-1 ${inputClass}`}
        />

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {t('ai.integrations.signingKey')}
          </span>
          {status(integrations?.orderLookup.signingConfigured)}
        </div>
        <button
          type="button"
          onClick={generateSigning}
          disabled={busy !== null}
          className={`mt-2 ${buttonClass}`}
        >
          {t('ai.integrations.generateSigning')}
        </button>
        {signingSecret && <RevealedSecret secret={signingSecret} />}

        <label className="mt-3 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          {t('ai.integrations.enabled')}
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={saveOrderLookup}
            disabled={busy !== null}
            className="px-3 py-1.5 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {t('ai.integrations.save')}
          </button>
          <button
            type="button"
            onClick={testConnection}
            disabled={busy !== null || !integrations?.orderLookup.url}
            className={buttonClass}
          >
            {t('ai.integrations.test')}
          </button>
        </div>
      </div>
    </section>
  );
};

export default SiteIntegrations;
