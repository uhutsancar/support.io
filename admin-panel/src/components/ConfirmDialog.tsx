/** A yes/no question before something that cannot be undone, on the shared Modal. */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

/** The accent a dialog is drawn with. */
export type ConfirmDialogTone = 'danger' | 'warning' | 'info';

const TONES: Record<ConfirmDialogTone, { badge: string; icon: string; button: string }> = {
  danger: {
    badge: 'bg-red-100 dark:bg-red-900/30',
    icon: 'text-red-600 dark:text-red-400',
    button: 'bg-red-600 hover:bg-red-700'
  },
  warning: {
    badge: 'bg-yellow-100 dark:bg-yellow-900/30',
    icon: 'text-yellow-600 dark:text-yellow-400',
    button: 'bg-yellow-700 hover:bg-yellow-800'
  },
  info: {
    badge: 'bg-blue-100 dark:bg-blue-900/30',
    icon: 'text-blue-600 dark:text-blue-400',
    button: 'bg-blue-600 hover:bg-blue-700'
  }
};

const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  type = 'danger'
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: React.ReactNode;
  message?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  /** Picks the accent: danger, warning or info. */
  type?: ConfirmDialogTone;
}) => {
  const { t } = useTranslation();
  const tone = TONES[type];
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={title}
      closeLabel={t('common.close')}
      icon={
        <span
          className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${tone.badge}`}
        >
          <AlertTriangle className={`w-6 h-6 ${tone.icon}`} aria-hidden="true" />
        </span>
      }
      footer={
        <>
          {/* The safe answer takes the focus first. */}
          <button
            type="button"
            data-autofocus
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelText ?? t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className={`px-5 py-2.5 rounded-lg font-medium text-white transition-colors ${tone.button}`}
          >
            {confirmText ?? t('common.ok')}
          </button>
        </>
      }
    >
      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">{message}</p>
    </Modal>
  );
};

export default ConfirmDialog;
