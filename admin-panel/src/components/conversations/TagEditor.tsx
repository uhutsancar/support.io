// A conversation's tags (plan v10 PRD-07): chips with the colour the
// workspace gave each tag, a remove button on each, and a box that suggests
// the workspace's tags and coins a new one when the name is new.

import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import type { ConversationTag } from '../../types/api';

/** A tag name with its colour as a dot; the text keeps the panel's contrast. */
export const TagChip = ({
  name,
  color,
  onRemove,
  removeLabel
}: {
  name: string;
  color?: string;
  onRemove?: () => void;
  removeLabel?: string;
}) => (
  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-[11px] text-gray-700 dark:text-gray-200 max-w-full">
    <span
      aria-hidden="true"
      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color || '#9CA3AF' }}
    />
    <span className="truncate">{name}</span>
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="-mr-0.5 p-0.5 rounded text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
      >
        <X className="w-3 h-3" aria-hidden="true" />
      </button>
    )}
  </span>
);

const TagEditor = ({
  tags,
  catalog,
  onChange,
  disabled = false
}: {
  tags: string[];
  catalog: ConversationTag[];
  /** Saves the new list; the page talks to the API and reports failures. */
  onChange: (tags: string[]) => Promise<void> | void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const listId = useId();
  const colorOf = (name: string) => catalog.find((tag) => tag.name === name)?.color;

  const add = async () => {
    const name = text.trim().replace(/\s+/g, ' ');
    if (!name) return;
    // Same name in another case: the server keeps one; nothing to send.
    const same = (a: string) => a.toLocaleLowerCase('tr') === name.toLocaleLowerCase('tr');
    if (!tags.some(same)) await onChange([...tags, name]);
    setText('');
  };

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap gap-1">
        {tags.length === 0 ? (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {t('inboxTools.tags.none')}
          </span>
        ) : (
          tags.map((tag) => (
            <TagChip
              key={tag}
              name={tag}
              color={colorOf(tag)}
              onRemove={disabled ? undefined : () => onChange(tags.filter((x) => x !== tag))}
              removeLabel={t('inboxTools.tags.remove', { name: tag })}
            />
          ))
        )}
      </div>
      {!disabled && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void add();
          }}
          className="mt-1.5 flex gap-1"
        >
          <input
            list={listId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={32}
            placeholder={t('inboxTools.tags.placeholder')}
            aria-label={t('inboxTools.tags.add')}
            className="min-w-0 flex-1 min-h-[44px] sm:min-h-0 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
          />
          <datalist id={listId}>
            {catalog
              .filter((tag) => !tags.includes(tag.name))
              .map((tag) => (
                <option key={tag._id} value={tag.name} />
              ))}
          </datalist>
          <button
            type="submit"
            disabled={!text.trim()}
            aria-label={t('inboxTools.tags.add')}
            className="min-w-[44px] sm:min-w-0 min-h-[44px] sm:min-h-0 px-1.5 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </form>
      )}
    </div>
  );
};

export default TagEditor;
