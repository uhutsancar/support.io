// The site's public help center (plan v10 PRD-10): on or off, its address,
// whether search engines may list it, and the language of the page. The
// articles are this page's FAQ entries that are active and site-wide.

import { useEffect, useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { BookOpen, ExternalLink } from 'lucide-react';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { errorMessage } from '../../hooks/useAsync';

interface Settings {
  enabled: boolean;
  noindex: boolean;
  title: string | null;
  language: 'tr' | 'en';
}

interface HelpCenterAnswer {
  settings: Settings;
  slug: string | null;
  suggestedSlug: string;
}

const field =
  'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none';

const HelpCenterCard = ({ siteId }: { siteId: string }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const canEdit = user?.role === 'owner' || user?.role === 'admin';
  const [data, setData] = useState<HelpCenterAnswer | null>(null);
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const ids = { slug: useId(), title: useId(), language: useId() };

  useEffect(() => {
    let live = true;
    api
      .get<HelpCenterAnswer>(`/sites/${siteId}/help-center`, { cache: false })
      .then(({ data: answer }) => {
        if (!live) return;
        setData(answer);
        setSlug(answer.slug ?? answer.suggestedSlug);
        setTitle(answer.settings.title ?? '');
      })
      .catch((error) => console.error('[help-center] could not load', error));
    return () => {
      live = false;
    };
  }, [siteId]);

  if (!data) return null;
  const address = `${window.location.origin}/help/${data.slug ?? slug}`;

  const save = async (patch: Partial<Settings> & { slug?: string }) => {
    setSaving(true);
    try {
      const { data: answer } = await api.put<HelpCenterAnswer>(`/sites/${siteId}/help-center`, {
        ...patch
      });
      setData(answer);
      setSlug(answer.slug ?? answer.suggestedSlug);
      toast.success(t('helpCenter.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('helpCenter.error')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby={`${ids.slug}-title`}
      className="mb-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <BookOpen
            className="w-5 h-5 mt-0.5 text-indigo-600 dark:text-indigo-400"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h2
              id={`${ids.slug}-title`}
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              {t('helpCenter.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('helpCenter.description')}
            </p>
          </div>
        </div>
        {data.settings.enabled && data.slug && (
          <a
            href={`/help/${data.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('helpCenter.open')}
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        )}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor={ids.slug}
            className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
          >
            {t('helpCenter.address')}
          </label>
          <div className="flex items-center gap-1 text-sm">
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">/help/</span>
            <input
              id={ids.slug}
              value={slug}
              onChange={(event) => setSlug(event.target.value.toLowerCase())}
              disabled={!canEdit}
              maxLength={40}
              pattern="[a-z0-9][a-z0-9-]{1,38}[a-z0-9]"
              className={field}
            />
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-all">{address}</p>
        </div>
        <div>
          <label
            htmlFor={ids.title}
            className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
          >
            {t('helpCenter.pageTitle')}
          </label>
          <input
            id={ids.title}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            disabled={!canEdit}
            maxLength={80}
            placeholder={t('helpCenter.pageTitlePlaceholder')}
            className={field}
          />
        </div>
        <div>
          <label
            htmlFor={ids.language}
            className="block text-sm font-medium text-gray-900 dark:text-white mb-1"
          >
            {t('helpCenter.language')}
          </label>
          <select
            id={ids.language}
            value={data.settings.language}
            disabled={!canEdit || saving}
            onChange={(event) => save({ language: event.target.value as 'tr' | 'en' })}
            className={field}
          >
            {/* i18n-ignore: each language by its own name */}
            <option value="tr">Türkçe</option>
            <option value="en">English</option>
          </select>
        </div>
        <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 md:mt-7">
          <input
            type="checkbox"
            checked={data.settings.noindex}
            disabled={!canEdit || saving}
            onChange={(event) => save({ noindex: event.target.checked })}
            className="mt-0.5"
          />
          {t('helpCenter.noindex')}
        </label>
      </div>

      {canEdit && (
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => save({ enabled: true, slug, title })}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {data.settings.enabled ? t('helpCenter.save') : t('helpCenter.publish')}
          </button>
          {data.settings.enabled && (
            <button
              type="button"
              disabled={saving}
              onClick={() => save({ enabled: false })}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              {t('helpCenter.unpublish')}
            </button>
          )}
        </div>
      )}
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400" role="status">
        {data.settings.enabled ? t('helpCenter.live') : t('helpCenter.off')}
      </p>
    </section>
  );
};

export default HelpCenterCard;
