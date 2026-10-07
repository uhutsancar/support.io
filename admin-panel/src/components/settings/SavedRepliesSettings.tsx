/**
 * Ayarlar → Hazır yanıtlar (plan v10 PRD-03). Sahip ve yöneticiler ekler,
 * düzenler, siler; temsilciler yanıt kutusunda "/" ile kullanır. Bir yanıt
 * tüm sitelerde ya da tek bir sitede geçerlidir.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../services/http';
import { sitesAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { errorMessage } from '../../hooks/useAsync';
import type { SavedReply } from '../conversations/SavedReplyInput';
import type { Site } from '../../types/api';

const input =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white';

const empty = { shortcut: '', title: '', body: '', siteId: '' };
const VARIABLES = ['{{visitor.name}}', '{{agent.name}}', '{{site.name}}'];

const SavedRepliesSettings = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [replies, setReplies] = useState<SavedReply[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canManage = user && ['owner', 'admin'].includes(user.role);

  const load = () =>
    api
      .get<{ replies: SavedReply[] }>('/saved-replies', { cache: false })
      .then(({ data }) => setReplies(data.replies))
      .catch(() => setReplies([]));

  useEffect(() => {
    if (!canManage) return;
    load();
    sitesAPI
      .getAll()
      .then(({ data }) => setSites(data.sites || []))
      .catch(() => setSites([]));
  }, [canManage]);

  if (!canManage) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = { ...form, siteId: form.siteId || null };
      if (editing) await api.put(`/saved-replies/${editing}`, body);
      else await api.post('/saved-replies', body);
      toast.success(t('savedReplies.saved'));
      setForm(empty);
      setEditing(null);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/saved-replies/${id}`);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    }
  };

  return (
    <section className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-1">
        <MessageSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        {t('savedReplies.title')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {t('savedReplies.description')}
      </p>

      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 mb-6">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t('savedReplies.shortcut')}
          </span>
          <input
            className={input}
            value={form.shortcut}
            pattern="[a-z0-9][a-z0-9_-]{0,31}"
            onChange={(e) => setForm({ ...form, shortcut: e.target.value.toLowerCase() })}
            placeholder="kargo"
            required
          />
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t('savedReplies.titleLabel')}
          </span>
          <input
            className={input}
            value={form.title}
            maxLength={100}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t('savedReplies.body')}
          </span>
          <textarea
            className={input}
            rows={3}
            maxLength={5000}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            required
          />
          <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
            {t('savedReplies.variables')}{' '}
            {VARIABLES.map((v) => (
              <code key={v} className="mr-1 font-mono">
                {v}
              </code>
            ))}
          </span>
        </label>
        <label className="block">
          <span className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            {t('savedReplies.site')}
          </span>
          <select
            className={input}
            value={form.siteId}
            onChange={(e) => setForm({ ...form, siteId: e.target.value })}
          >
            <option value="">{t('savedReplies.allSites')}</option>
            {sites.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {editing ? t('savedReplies.update') : t('savedReplies.add')}
          </button>
          {editing && (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
            >
              {t('common.cancel')}
            </button>
          )}
        </div>
      </form>

      {replies.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('savedReplies.empty')}</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700">
          {replies.map((reply) => (
            <li key={reply._id} className="py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm">
                  <span className="font-mono text-indigo-600 dark:text-indigo-400">
                    /{reply.shortcut}
                  </span>{' '}
                  <span className="font-medium text-gray-900 dark:text-white">{reply.title}</span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{reply.body}</p>
              </div>
              <button
                type="button"
                aria-label={t('savedReplies.edit')}
                onClick={() => {
                  setEditing(reply._id);
                  setForm({
                    shortcut: reply.shortcut,
                    title: reply.title,
                    body: reply.body,
                    siteId: reply.siteId || ''
                  });
                }}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Pencil className="w-4 h-4 text-gray-500" />
              </button>
              <button
                type="button"
                aria-label={t('savedReplies.delete')}
                onClick={() => remove(reply._id)}
                className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-500/10"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default SavedRepliesSettings;
