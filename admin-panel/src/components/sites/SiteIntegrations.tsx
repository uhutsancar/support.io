// Customer identity verification for one site.
//
// The shop's server signs a signed-in customer's id with a key only it and
// we know (a short-lived, site-bound userHash assertion) and passes both to
// SupportChat.identify(). The key is created on the server and shown here
// exactly once, in the response that created it; reopening this section says
// "set", never the key.

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

const buttonClass =
  'px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition';

/** How a shop's server signs a customer; shown next to a freshly generated key. */
const IDENTITY_EXAMPLE = `// Sunucunuzda (Node.js)
const userHash = crypto.createHmac('sha256', SUPPORTIO_IDENTITY_KEY)
  .update(user.id).digest('hex');

// Sayfada
SupportChat.identify({ userId: user.id, userHash, name: user.name });`;

const SiteIntegrations = ({ site, onChanged }: SiteIntegrationsProps) => {
  const { t } = useTranslation();
  const [secret, setSecret] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const configured = Boolean(site.integrations?.identity.configured);

  const generate = async () => {
    if (configured && !window.confirm(t('identity.regenerateConfirm'))) return;
    setBusy(true);
    try {
      const { data } = await sitesAPI.generateIdentitySecret(site._id);
      setSecret(data.secret);
      onChanged(data.site);
    } catch (error) {
      toast.error(errorMessage(error, t('identity.error')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
        {t('identity.title')}{' '}
        <span
          className={`ml-1 text-[11px] font-medium ${configured ? 'text-green-700 dark:text-green-400' : 'text-gray-500'}`}
        >
          {configured ? t('identity.configured') : t('identity.notConfigured')}
        </span>
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('identity.help')}</p>
      <button type="button" onClick={generate} disabled={busy} className={buttonClass}>
        {configured ? t('identity.regenerate') : t('identity.generate')}
      </button>
      {secret && (
        <div className="mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
          <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">
            {t('identity.secretOnce')}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all text-gray-900 dark:text-white">{secret}</code>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(secret);
                toast.success(t('common.copied'));
              }}
              aria-label={t('common.copy')}
              className="p-1.5 rounded hover:bg-amber-100 dark:hover:bg-amber-500/20"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <pre className="mt-3 text-[11px] bg-gray-900 text-gray-100 rounded p-2 overflow-x-auto">
            {IDENTITY_EXAMPLE}
          </pre>
        </div>
      )}
    </section>
  );
};

export default SiteIntegrations;
