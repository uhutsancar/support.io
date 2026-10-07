/**
 * "Ziyaretçiyi engelle" (plan v10 SEC-09). Konuşmanın ziyaretçisini bu sitede
 * seçilen süre boyunca engeller; açık widget'ı hemen kapanır ve nazik bir
 * mesaj gösterir. Engeller Siteler → Sohbet ayarları'ndan kaldırılır.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Ban } from 'lucide-react';
import { visitorsAPI } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';

const PERIODS = [1, 7, 30, 90];

const BlockVisitor = ({ conversationId }: { conversationId: string }) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await visitorsAPI.block({ conversationId, days, reason: reason.trim() || undefined });
      toast.success(t('visitorBlocks.blocked'));
      setOpen(false);
      setReason('');
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
      >
        <Ban className="w-3.5 h-3.5" />
        {t('visitorBlocks.block')}
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/10 p-3 space-y-2">
      <p className="text-xs text-gray-700 dark:text-gray-200">{t('visitorBlocks.explain')}</p>
      <label className="block">
        <span className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
          {t('visitorBlocks.period')}
        </span>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white"
        >
          {PERIODS.map((d) => (
            <option key={d} value={d}>
              {t('visitorBlocks.days', { count: d })}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-[11px] font-medium text-gray-600 dark:text-gray-400 mb-1">
          {t('visitorBlocks.reason')}
        </span>
        <input
          value={reason}
          maxLength={200}
          onChange={(e) => setReason(e.target.value)}
          className="w-full px-2 py-1.5 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-xs text-gray-900 dark:text-white"
        />
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-medium disabled:opacity-50"
        >
          {t('visitorBlocks.confirm')}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 rounded border border-gray-300 dark:border-gray-600 text-xs text-gray-700 dark:text-gray-200"
        >
          {t('common.cancel')}
        </button>
      </div>
    </div>
  );
};

export default BlockVisitor;
