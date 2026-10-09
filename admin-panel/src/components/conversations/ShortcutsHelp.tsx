// The list behind "?" in the inbox (plan v10 PRD-07).

import { useTranslation } from 'react-i18next';
import { Keyboard } from 'lucide-react';
import Modal from '../Modal';
import { INBOX_SHORTCUTS } from '../../features/conversations/useInboxShortcuts';

const ShortcutsHelp = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const { t } = useTranslation();
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title={t('inboxTools.shortcuts.title')}
      closeLabel={t('inboxTools.shortcuts.close')}
      icon={
        <Keyboard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden="true" />
      }
    >
      <dl className="space-y-2">
        {INBOX_SHORTCUTS.map(({ keys, action }) => (
          <div key={action} className="flex items-center justify-between gap-4">
            <dt className="text-sm text-gray-700 dark:text-gray-200">
              {t(`inboxTools.shortcuts.${action}`)}
            </dt>
            <dd>
              {keys.map((key) => (
                <kbd
                  key={key}
                  className="inline-flex min-w-[1.75rem] justify-center px-1.5 py-0.5 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 font-mono text-xs text-gray-800 dark:text-gray-100"
                >
                  {key}
                </kbd>
              ))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
        {t('inboxTools.shortcuts.hint')}
      </p>
    </Modal>
  );
};

export default ShortcutsHelp;
