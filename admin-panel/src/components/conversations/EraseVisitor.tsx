/**
 * "Bu ziyaretçinin verilerini sil" (plan v10 SEC-17). Bir ziyaretçi KVKK
 * m.11 kapsamında verilerinin silinmesini istediğinde: o sitedeki tüm
 * konuşmaları, mesajları, ekleri, ziyaretçi kaydı ve sayfa olayları silinir.
 * Geri alınamaz; yalnızca sahip ve yöneticiler görür.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { Eraser } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import { visitorsAPI } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';

const EraseVisitor = ({
  conversationId,
  onErased
}: {
  conversationId: string;
  onErased: () => void;
}) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const erase = async () => {
    try {
      const { data } = await visitorsAPI.erase(conversationId);
      toast.success(t('visitorErase.done', { count: data.conversations }));
      onErased();
    } catch (error) {
      toast.error(errorMessage(error, t('recovery.error')));
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:underline"
      >
        <Eraser className="w-3.5 h-3.5" />
        {t('visitorErase.button')}
      </button>
      <ConfirmDialog
        isOpen={open}
        onClose={() => setOpen(false)}
        onConfirm={erase}
        title={t('visitorErase.title')}
        message={t('visitorErase.message')}
        confirmText={t('visitorErase.confirm')}
        cancelText={t('common.cancel')}
        type="danger"
      />
    </>
  );
};

export default EraseVisitor;
