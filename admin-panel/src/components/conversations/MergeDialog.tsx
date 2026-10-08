// Merging two conversations of one visitor (plan v10 PRD-07): the server
// lists the visitor's other conversations on the site; the one picked
// receives this one's messages and notes, and this one closes.

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import { conversationsAPI } from '../../services/api';
import { errorMessage } from '../../hooks/useAsync';
import { formatDateTime } from '../../lib/format';
import type { Conversation, MergeCandidate } from '../../types/api';

const MergeDialog = ({
  open,
  siteId,
  conversation,
  statusLabel,
  onClose,
  onMerged
}: {
  open: boolean;
  siteId: string;
  conversation: Conversation;
  statusLabel: (status: string) => string;
  onClose: () => void;
  onMerged: (merged: Conversation) => void;
}) => {
  const { t } = useTranslation();
  const [candidates, setCandidates] = useState<MergeCandidate[] | null>(null);
  const [chosen, setChosen] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCandidates(null);
    setChosen(null);
    conversationsAPI
      .mergeCandidates(siteId, conversation._id)
      .then(({ data }) => setCandidates(data.conversations))
      .catch((error) => {
        toast.error(errorMessage(error, t('inboxTools.merge.error')));
        setCandidates([]);
      });
  }, [open, siteId, conversation._id, t]);

  const merge = async () => {
    if (!chosen) return;
    setSaving(true);
    try {
      const { data } = await conversationsAPI.merge(conversation._id, chosen);
      toast.success(t('inboxTools.merge.done'));
      onMerged(data.conversation);
      onClose();
    } catch (error) {
      toast.error(errorMessage(error, t('inboxTools.merge.error')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('inboxTools.merge.title')}
      closeLabel={t('common.close')}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            {t('inboxTools.merge.cancel')}
          </button>
          <button
            type="button"
            onClick={merge}
            disabled={!chosen || saving}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
          >
            {t('inboxTools.merge.confirm')}
          </button>
        </>
      }
    >
      <p className="text-sm text-gray-600 dark:text-gray-300">
        {t('inboxTools.merge.description')}
      </p>
      {candidates === null ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {t('inboxTools.merge.loading')}
        </p>
      ) : candidates.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {t('inboxTools.merge.none')}
        </p>
      ) : (
        <fieldset className="mt-4 space-y-2">
          <legend className="sr-only">{t('inboxTools.merge.title')}</legend>
          {candidates.map((candidate) => (
            <label
              key={candidate._id}
              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer ${
                chosen === candidate._id
                  ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <input
                type="radio"
                name="merge-into"
                value={candidate._id}
                checked={chosen === candidate._id}
                onChange={() => setChosen(candidate._id)}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-gray-900 dark:text-white">
                  {candidate.ticketId || candidate._id.slice(-6)}
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  {statusLabel(candidate.status)} ·{' '}
                  {formatDateTime(candidate.lastMessageAt || candidate.createdAt || '')}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </Modal>
  );
};

export default MergeDialog;
