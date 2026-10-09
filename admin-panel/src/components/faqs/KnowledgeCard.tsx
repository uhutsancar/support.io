// What the assistant may answer from besides the FAQ (plan v10 PRD-21):
// pages of this site and PDF documents. Owners and admins add them; a page
// is read in the background (the list refreshes until it is ready), a PDF at
// once. Only the text is kept, and only public material belongs here.

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { FileText, Globe, Lock, RefreshCw, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { errorMessage } from '../../hooks/useAsync';
import ConfirmDialog from '../ConfirmDialog';

interface Source {
  _id: string;
  kind: 'page' | 'pdf';
  url: string | null;
  title: string;
  status: 'pending' | 'ready' | 'failed';
  error: string | null;
  chars: number;
  refreshedAt: string | null;
}

interface KnowledgeAnswer {
  sources: Source[];
  allowed: boolean;
  used: number;
  limit: number;
}

const field =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';
const button =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50';
const ERRORS = [
  'robots',
  'robots_unreadable',
  'not_html',
  'empty',
  'too_large',
  'unsafe',
  'not_on_site',
  'unreachable',
  'timeout',
  'too_many_redirects'
];

const KnowledgeCard = ({ siteId, domain }: { siteId: string; domain: string }) => {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === 'owner' || user?.role === 'admin';
  const [data, setData] = useState<KnowledgeAnswer | null>(null);
  const [pageUrl, setPageUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Source | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const ids = { page: useId(), pdf: useId() };
  const base = `/sites/${siteId}/knowledge`;

  const load = useCallback(async () => {
    try {
      const { data: answer } = await api.get<KnowledgeAnswer>(base, { cache: false });
      setData(answer);
    } catch {
      setData(null);
    }
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  // A page is read in the background: look again until none is pending.
  const pending = Boolean(data?.sources.some((s) => s.status === 'pending'));
  useEffect(() => {
    if (!pending) return undefined;
    const timer = window.setInterval(() => void load(), 2000);
    return () => window.clearInterval(timer);
  }, [pending, load]);

  if (!canEdit || !data) return null;

  const run = async (key: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try {
      await action();
      if (done) toast.success(done);
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('knowledge.error')));
    } finally {
      setBusy(null);
    }
  };

  const addPage = (e: React.FormEvent) => {
    e.preventDefault();
    void run(
      'page',
      () => api.post(`${base}/pages`, { url: pageUrl.trim() }),
      t('knowledge.pageAdded')
    ).then(() => setPageUrl(''));
  };
  const sitemap = `https://${domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')}/sitemap.xml`;
  const addSitemap = () =>
    run('sitemap', async () => {
      const { data: result } = await api.post<{ found: number; added: number }>(`${base}/sitemap`, {
        url: sitemap
      });
      toast.success(t('knowledge.sitemapAdded', { count: result.added }));
    });
  const uploadPdf = (file: File) => {
    const form = new FormData();
    form.append('file', file);
    void run(
      'pdf',
      () => api.post(`${base}/pdf`, form, { headers: { 'Content-Type': 'multipart/form-data' } }),
      t('knowledge.pdfAdded')
    ).then(() => {
      if (fileInput.current) fileInput.current.value = '';
    });
  };

  const prefix = i18n.language === 'en' ? '/en' : '';
  const full = data.used >= data.limit;
  return (
    <section
      className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6"
      aria-labelledby="knowledge-title"
    >
      <h2
        id="knowledge-title"
        className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2"
      >
        <Globe className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        {t('knowledge.title')}
      </h2>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('knowledge.description')}</p>

      {!data.allowed ? (
        <p className="mt-4 text-sm text-gray-700 dark:text-gray-300 flex items-center gap-2">
          <Lock className="w-4 h-4" aria-hidden="true" />
          {t('knowledge.planOnly')}{' '}
          <Link
            to={`${prefix}/dashboard/upgrade`}
            className="text-indigo-700 dark:text-indigo-300 underline underline-offset-2"
          >
            {t('knowledge.upgrade')}
          </Link>
        </p>
      ) : (
        <>
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
            {t('knowledge.usage', { used: data.used, limit: data.limit })} ·{' '}
            {t('knowledge.publicOnly')}
          </p>
          <form onSubmit={addPage} className="mt-4 flex flex-col sm:flex-row sm:items-end gap-2">
            <div className="flex-1">
              <label
                htmlFor={ids.page}
                className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
              >
                {t('knowledge.pageLabel')}
              </label>
              <input
                id={ids.page}
                type="url"
                required
                value={pageUrl}
                placeholder={`https://${domain}/…`}
                onChange={(e) => setPageUrl(e.target.value)}
                className={field}
              />
            </div>
            <button type="submit" className={button} disabled={busy !== null || full}>
              {t('knowledge.addPage')}
            </button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className={button}
              onClick={() => void addSitemap()}
              disabled={busy !== null || full}
            >
              {t('knowledge.fromSitemap')}
            </button>
            <label htmlFor={ids.pdf} className={`${button} cursor-pointer`}>
              <FileText className="w-4 h-4" aria-hidden="true" />
              {t('knowledge.uploadPdf')}
            </label>
            <input
              id={ids.pdf}
              ref={fileInput}
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={busy !== null || full}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPdf(file);
              }}
            />
          </div>
        </>
      )}

      {data.sources.length > 0 && (
        <ul className="mt-5 divide-y divide-gray-100 dark:divide-gray-700">
          {data.sources.map((s) => (
            <li key={s._id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {s.kind === 'pdf' ? (
                    <FileText className="inline w-4 h-4 mr-1 text-gray-500" aria-hidden="true" />
                  ) : (
                    <Globe className="inline w-4 h-4 mr-1 text-gray-500" aria-hidden="true" />
                  )}
                  {s.title}
                </p>
                {s.url && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{s.url}</p>
                )}
                <p className="text-xs mt-0.5">
                  {s.status === 'ready' && (
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {t('knowledge.ready', { count: s.chars })}
                    </span>
                  )}
                  {s.status === 'pending' && (
                    <span className="text-amber-700 dark:text-amber-400" role="status">
                      {t('knowledge.pending')}
                    </span>
                  )}
                  {s.status === 'failed' && (
                    <span className="text-red-700 dark:text-red-400">
                      {t(
                        `knowledge.errors.${ERRORS.includes(String(s.error)) ? s.error : 'other'}`
                      )}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                {s.kind === 'page' && data.allowed && (
                  <button
                    type="button"
                    className={button}
                    disabled={busy !== null || s.status === 'pending'}
                    onClick={() =>
                      void run(`refresh-${s._id}`, () => api.post(`${base}/${s._id}/refresh`))
                    }
                    aria-label={t('knowledge.refreshLabel', { title: s.title })}
                  >
                    <RefreshCw className="w-4 h-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  className={button}
                  onClick={() => setRemoving(s)}
                  aria-label={t('knowledge.removeLabel', { title: s.title })}
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        isOpen={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() =>
          removing
            ? run(
                `remove-${removing._id}`,
                () => api.delete(`${base}/${removing._id}`),
                t('knowledge.removed')
              )
            : undefined
        }
        title={t('knowledge.removeTitle')}
        message={t('knowledge.removeMessage', { title: removing?.title ?? '' })}
        confirmText={t('knowledge.remove')}
        cancelText={t('common.cancel')}
        type="danger"
      />
    </section>
  );
};

export default KnowledgeCard;
