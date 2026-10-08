// What can be done to the conversations ticked in the inbox list (plan v10
// PRD-07): resolve, close, take them, tag or snooze them in one go. The
// server applies each conversation's own rules and says which ones failed.

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCheck, Lock, Tag, UserCheck, X } from 'lucide-react';
import SnoozeMenu from './SnoozeMenu';
import type { ConversationTag } from '../../types/api';

export type BulkMove =
  | { action: 'status'; status: string }
  | { action: 'assign'; agentId: string | null }
  | { action: 'tag'; tag: string }
  | { action: 'snooze'; until: string };

const BUTTON =
  'inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-indigo-200 dark:border-indigo-500/40 bg-white dark:bg-gray-800 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-gray-700 disabled:opacity-50';

const BulkBar = ({
  count,
  selfId,
  catalog,
  busy,
  onMove,
  onClear
}: {
  count: number;
  selfId: string;
  catalog: ConversationTag[];
  busy: boolean;
  onMove: (move: BulkMove) => void;
  onClear: () => void;
}) => {
  const { t } = useTranslation();
  const [tagging, setTagging] = useState(false);
  const [tag, setTag] = useState('');
  const [snoozing, setSnoozing] = useState(false);
  const listId = useId();

  return (
    <div
      role="region"
      aria-label={t('inboxTools.bulk.selected', { n: count })}
      className="p-2 border-b border-indigo-100 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10"
    >
      <div className="flex items-center justify-between gap-2">
        <p
          className="text-xs font-semibold text-indigo-900 dark:text-indigo-100"
          aria-live="polite"
        >
          {t('inboxTools.bulk.selected', { n: count })}
        </p>
        <button
          type="button"
          onClick={onClear}
          aria-label={t('inboxTools.bulk.clear')}
          className="p-1 rounded text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-500/20"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <button
          type="button"
          disabled={busy}
          className={BUTTON}
          onClick={() => onMove({ action: 'status', status: 'resolved' })}
        >
          <CheckCheck className="w-3.5 h-3.5" aria-hidden="true" />
          {t('inboxTools.bulk.resolve')}
        </button>
        <button
          type="button"
          disabled={busy}
          className={BUTTON}
          onClick={() => onMove({ action: 'status', status: 'closed' })}
        >
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          {t('inboxTools.bulk.close')}
        </button>
        <button
          type="button"
          disabled={busy || !selfId}
          className={BUTTON}
          onClick={() => onMove({ action: 'assign', agentId: selfId })}
        >
          <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
          {t('inboxTools.bulk.assignMe')}
        </button>
        <button
          type="button"
          disabled={busy}
          aria-expanded={tagging}
          className={BUTTON}
          onClick={() => setTagging((open) => !open)}
        >
          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
          {t('inboxTools.bulk.tag')}
        </button>
        <SnoozeMenu
          open={snoozing}
          onOpenChange={setSnoozing}
          align="left"
          onSnooze={(until) => onMove({ action: 'snooze', until })}
        />
      </div>
      {tagging && (
        <form
          className="mt-2 flex gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            const name = tag.trim();
            if (!name) return;
            onMove({ action: 'tag', tag: name });
            setTag('');
            setTagging(false);
          }}
        >
          <input
            list={listId}
            value={tag}
            onChange={(event) => setTag(event.target.value)}
            maxLength={32}
            // The box was opened by this very click; typing goes straight in.
            autoFocus
            placeholder={t('inboxTools.bulk.tagPlaceholder')}
            aria-label={t('inboxTools.bulk.tagPlaceholder')}
            className="min-w-0 flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          />
          <datalist id={listId}>
            {catalog.map((entry) => (
              <option key={entry._id} value={entry.name} />
            ))}
          </datalist>
          <button type="submit" disabled={!tag.trim() || busy} className={BUTTON}>
            {t('inboxTools.bulk.tag')}
          </button>
        </form>
      )}
    </div>
  );
};

export default BulkBar;
