/**
 * Ayarlar → API anahtarları (plan v10 PRD-12).
 *
 * Anahtar yalnızca oluşturulduğu anda bir kez gösterilir; sunucu yalnızca
 * özetini saklar. Kapsamlar: okuma (GET) ve yazma. Kurumsal planda.
 */
import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import api from '../../services/api';
import Modal from '../Modal';
import ConfirmDialog from '../ConfirmDialog';
import { errorMessage } from '../../hooks/useAsync';
import { formatDateTime } from '../../lib/format';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { usePlans } from '../../hooks/usePlans';
import { marketingRoutes } from '../../lib/marketingPaths';

interface ApiKey {
  _id: string;
  name: string;
  prefix: string;
  scopes: Array<'read' | 'write'>;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

const field =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';

const ApiKeysSettings = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const { plans } = usePlans();
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  // Asked of the plan list, not of the API: a refused request would open the
  // upgrade dialog the moment Settings opens.
  const current = plans?.find((p) => p.type === (user?.organization?.planType || 'FREE'));
  const allowed = current ? current.features.includes('api') : null;
  const locked = allowed === false;
  const [name, setName] = useState('');
  const [write, setWrite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const nameId = useId();

  const load = async () => {
    try {
      const { data } = await api.get<{ keys: ApiKey[] }>('/api-keys', { cache: false });
      setKeys(data.keys);
    } catch {
      setKeys([]);
    }
  };

  useEffect(() => {
    if (allowed) void load();
  }, [allowed]);

  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const { data } = await api.post<{ key: ApiKey; secret: string }>('/api-keys', {
        name,
        scopes: write ? ['read', 'write'] : ['read']
      });
      setSecret(data.secret);
      setName('');
      setWrite(false);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('apiKeys.error')));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (!revoking) return;
    try {
      await api.delete(`/api-keys/${revoking._id}`);
      toast.success(t('apiKeys.revoked'));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('apiKeys.error')));
    }
  };

  const docs = marketingRoutes(language === 'en' ? 'en' : 'tr').apiDocs;

  return (
    <section className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors duration-200">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-1">
        <KeyRound className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        {t('apiKeys.title')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        {t('apiKeys.description')}{' '}
        <Link
          to={docs}
          className="text-indigo-700 dark:text-indigo-300 underline underline-offset-2"
        >
          {t('apiKeys.docs')}
        </Link>
      </p>

      {locked ? (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300">{t('apiKeys.planOnly')}</p>
      ) : (
        <>
          <form onSubmit={create} className="mt-5 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor={nameId}
                className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
              >
                {t('apiKeys.name')}
              </label>
              <input
                id={nameId}
                required
                maxLength={60}
                value={name}
                placeholder={t('apiKeys.namePlaceholder')}
                onChange={(e) => setName(e.target.value)}
                className={field}
              />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 sm:pb-2">
              <input type="checkbox" checked={write} onChange={(e) => setWrite(e.target.checked)} />
              {t('apiKeys.write')}
            </label>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {t('apiKeys.create')}
            </button>
          </form>

          {keys && keys.length > 0 && (
            <ul className="mt-5 divide-y divide-gray-100 dark:divide-gray-700">
              {keys.map((key) => (
                <li
                  key={key._id}
                  className="py-3 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {key.name}{' '}
                      <code className="ml-1 text-xs text-gray-600 dark:text-gray-400">
                        {key.prefix}…
                      </code>
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {key.scopes.includes('write')
                        ? t('apiKeys.readWrite')
                        : t('apiKeys.readOnly')}{' '}
                      ·{' '}
                      {key.revokedAt
                        ? t('apiKeys.revokedAt', { time: formatDateTime(key.revokedAt) })
                        : key.lastUsedAt
                          ? t('apiKeys.lastUsed', { time: formatDateTime(key.lastUsedAt) })
                          : t('apiKeys.neverUsed')}
                    </p>
                  </div>
                  {!key.revokedAt && (
                    <button
                      type="button"
                      onClick={() => setRevoking(key)}
                      className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      {t('apiKeys.revoke')}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Modal
        open={Boolean(secret)}
        onClose={() => setSecret(null)}
        title={t('apiKeys.secretTitle')}
        closeLabel={t('common.close')}
        footer={
          <button
            type="button"
            onClick={() => setSecret(null)}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            {t('apiKeys.done')}
          </button>
        }
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">{t('apiKeys.secretHelp')}</p>
        <div className="mt-3 flex gap-2">
          <code className="flex-1 min-w-0 break-all rounded-lg bg-gray-100 dark:bg-gray-900 px-3 py-2 text-xs text-gray-900 dark:text-gray-100">
            {secret}
          </code>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(secret || '');
              toast.success(t('apiKeys.copied'));
            }}
            className="px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-800 dark:text-gray-100"
          >
            {t('apiKeys.copy')}
          </button>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={Boolean(revoking)}
        onClose={() => setRevoking(null)}
        onConfirm={revoke}
        title={t('apiKeys.revokeTitle')}
        message={t('apiKeys.revokeMessage', { name: revoking?.name ?? '' })}
        confirmText={t('apiKeys.revoke')}
        cancelText={t('common.cancel')}
        type="danger"
      />
    </section>
  );
};

export default ApiKeysSettings;
