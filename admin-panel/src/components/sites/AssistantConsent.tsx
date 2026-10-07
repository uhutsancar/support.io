/**
 * Asistanı açmadan önce site sahibinin onayı (plan v10 AI-04). Açıldığında
 * sitenin SSS içeriği ve ziyaretçi soruları, kişisel veriler maskelenerek
 * yapay zekâ hizmet sağlayıcısına gider; sahip bunu kutuyu işaretleyerek
 * onaylar. Onay zamanı ve kişi denetim kaydına yazılır (ASSISTANT_ENABLED).
 * Sağlayıcının adı burada da geçmez.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bot } from 'lucide-react';

const AssistantConsent = ({
  siteName,
  onConfirm,
  onCancel
}: {
  siteName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-[60] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="assistant-consent-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-6">
        <h2
          id="assistant-consent-title"
          className="text-lg font-bold text-gray-900 dark:text-white inline-flex items-center gap-2"
        >
          <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          {t('assistant.consent.title')}
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{siteName}</p>
        <ul className="mt-4 text-sm text-gray-700 dark:text-gray-300 list-disc pl-5 space-y-1.5">
          <li>{t('assistant.consent.point1')}</li>
          <li>{t('assistant.consent.point2')}</li>
          <li>{t('assistant.consent.point3')}</li>
        </ul>
        <label className="mt-4 flex items-start gap-2 text-sm text-gray-800 dark:text-gray-200">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
          />
          {t('assistant.consent.box')}
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-200"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            disabled={!checked}
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium disabled:opacity-50"
          >
            {t('assistant.consent.confirm')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantConsent;
