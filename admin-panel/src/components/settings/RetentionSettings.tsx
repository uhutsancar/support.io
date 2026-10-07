/**
 * Konuşma saklama süresi (plan v10 SEC-17). Son mesajından bu kadar gün
 * geçen konuşma, mesajları ve ekleriyle birlikte her gece silinir. Pencere
 * plana göre: Ücretsiz 90 gün (seçim yok), Pro 30 gün–1 yıl, Kurumsal
 * 30 gün–5 yıl. Yalnızca sahip ve yöneticiler değiştirir.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { api } from '../../services/http';
import { errorMessage } from '../../hooks/useAsync';

interface Retention {
  plan: 'FREE' | 'PRO' | 'ENTERPRISE';
  days: number;
  defaultDays: number;
  minDays: number;
  maxDays: number;
  fixed: boolean;
}

const CHOICES = [30, 90, 180, 365, 730, 1095, 1830];

const RetentionSettings = () => {
  const { t } = useTranslation();
  const [retention, setRetention] = useState<Retention | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api
      .get<Retention>('/data-retention', { cache: false })
      .then(({ data }) => setRetention(data))
      .catch(() => setRetention(null));
  }, []);

  if (!retention) return null;

  const label = (days: number) =>
    days % 365 === 0 || days === 1830
      ? t('retention.years', { count: Math.round(days / 365) })
      : t('retention.days', { count: days });

  const save = async (days: number) => {
    setBusy(true);
    try {
      const { data } = await api.put<Retention>('/data-retention', { days });
      setRetention(data);
      toast.success(t('retention.saved'));
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  const choices = CHOICES.filter((d) => d >= retention.minDays && d <= retention.maxDays);
  if (!choices.includes(retention.days)) choices.push(retention.days);
  choices.sort((a, b) => a - b);

  return (
    <div className="mt-5 pt-5 border-t border-gray-200 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        {t('retention.title')}
      </h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t('retention.description')}</p>
      {retention.fixed ? (
        <p className="mt-3 text-sm text-gray-700 dark:text-gray-300">
          {t('retention.fixed', { period: label(retention.days) })}{' '}
          <Link
            to="/dashboard/billing"
            className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            {t('retention.upgrade')}
          </Link>
        </p>
      ) : (
        <label className="mt-3 flex flex-wrap items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
          {t('retention.keep')}
          <select
            value={retention.days}
            disabled={busy}
            onChange={(e) => save(Number(e.target.value))}
            className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
          >
            {choices.map((d) => (
              <option key={d} value={d}>
                {label(d)}
                {d === retention.defaultDays ? ` (${t('retention.default')})` : ''}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
};

export default RetentionSettings;
