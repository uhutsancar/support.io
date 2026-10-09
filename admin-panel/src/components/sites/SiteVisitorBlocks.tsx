/**
 * Bir sitede yürürlükteki ziyaretçi engelleri (plan v10 SEC-09): ne zaman,
 * hangi gerekçeyle, ne zamana kadar. Engel buradan kaldırılır.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { visitorsAPI } from '../../services/api';
import type { VisitorBlock } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';

const SiteVisitorBlocks = ({ siteId }: { siteId: string }) => {
  const { t, i18n } = useTranslation();
  const [blocks, setBlocks] = useState<VisitorBlock[] | null>(null);

  const load = () =>
    visitorsAPI
      .blocks(siteId)
      .then(({ data }) => setBlocks(data.blocks))
      .catch(() => setBlocks([]));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId]);

  const unblock = async (id: string) => {
    try {
      await visitorsAPI.unblock(id);
      toast.success(t('visitorBlocks.unblocked'));
      await load();
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    }
  };

  const date = (value: string) =>
    new Date(value).toLocaleDateString(i18n.language === 'en' ? 'en-GB' : 'tr-TR');

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
        {t('visitorBlocks.listTitle')}
      </p>
      {!blocks || blocks.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('visitorBlocks.empty')}</p>
      ) : (
        <ul className="divide-y divide-gray-200 dark:divide-gray-700 text-xs">
          {blocks.map((b) => (
            <li key={b._id} className="py-2 flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-gray-900 dark:text-white truncate">
                  {b.reason || t('visitorBlocks.noReason')}
                </p>
                <p className="text-gray-500 dark:text-gray-400">
                  {t('visitorBlocks.range', { from: date(b.createdAt), to: date(b.expiresAt) })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => unblock(b._id)}
                className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200"
              >
                {t('visitorBlocks.unblock')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default SiteVisitorBlocks;
