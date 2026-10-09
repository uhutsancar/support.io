/**
 * Ayarlar → Tavsiye programı (plan v10 PRD-23), yalnızca hesap sahibine.
 *
 * Sahibin bağlantısı, bağlantıyla kaydolanlar, abone olanlar ve kazanılan
 * ücretsiz aylar. Ödül, tavsiye edilen işletmenin ilk ödemesinden sonra
 * sahibin bir sonraki faturasına uygulanır.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Gift } from 'lucide-react';
import { authAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface Referral {
  code: string;
  link: string;
  joined: number;
  qualified: number;
  rewarded: number;
}

const ReferralCard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [data, setData] = useState<Referral | null>(null);

  useEffect(() => {
    if (user?.role !== 'owner') return;
    let live = true;
    authAPI
      .referral()
      .then(({ data: answer }) => live && setData(answer))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [user?.role]);

  if (user?.role !== 'owner' || !data) return null;
  const copy = () => {
    void navigator.clipboard?.writeText(data.link);
    toast.success(t('referral.copied'));
  };
  const stats: Array<[number, string]> = [
    [data.joined, t('referral.joined')],
    [data.qualified, t('referral.qualified')],
    [data.rewarded, t('referral.rewarded')]
  ];
  return (
    <section
      id="referral"
      className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 scroll-mt-6"
      aria-labelledby="referral-title"
    >
      <h2
        id="referral-title"
        className="flex items-center gap-2 text-xl font-semibold text-gray-900 dark:text-white mb-1"
      >
        <Gift className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
        {t('referral.title')}
      </h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">{t('referral.description')}</p>
      <div className="mt-4 flex flex-col sm:flex-row gap-2">
        <label htmlFor="referral-link" className="sr-only">
          {t('referral.linkLabel')}
        </label>
        <input
          id="referral-link"
          readOnly
          value={data.link}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
        />
        <button
          type="button"
          onClick={copy}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
        >
          {t('referral.copy')}
        </button>
      </div>
      <dl className="mt-5 grid grid-cols-3 gap-3">
        {stats.map(([value, label]) => (
          <div key={label} className="rounded-lg bg-gray-50 dark:bg-gray-900/60 p-3 text-center">
            <dt className="text-xs text-gray-600 dark:text-gray-400">{label}</dt>
            <dd className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-gray-600 dark:text-gray-400">{t('referral.howItWorks')}</p>
    </section>
  );
};

export default ReferralCard;
