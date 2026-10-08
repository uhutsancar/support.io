/**
 * The reply box with saved replies (plan v10 PRD-03): typing "/" opens a list
 * of the organization's replies, filtered by what follows; ↑/↓ move, Enter
 * or Tab inserts, Esc closes. Variables are filled in as the reply goes in:
 * {{visitor.name}}, {{agent.name}}, {{site.name}}.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/http';

export interface SavedReply {
  _id: string;
  siteId: string | null;
  shortcut: string;
  title: string;
  body: string;
  usageCount: number;
}

export function fillVariables(
  text: string,
  vars: { visitorName?: string; agentName?: string; siteName?: string }
): string {
  return text
    .replace(/\{\{\s*visitor\.name\s*\}\}/g, vars.visitorName || '')
    .replace(/\{\{\s*agent\.name\s*\}\}/g, vars.agentName || '')
    .replace(/\{\{\s*site\.name\s*\}\}/g, vars.siteName || '');
}

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onChange: (value: string) => void;
  siteId?: string | null;
  vars: { visitorName?: string; agentName?: string; siteName?: string };
};

const SavedReplyInput = ({ value, onChange, siteId, vars, ...input }: Props) => {
  const { t } = useTranslation();
  const [replies, setReplies] = useState<SavedReply[] | null>(null);
  const [active, setActive] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  const field = useRef<HTMLInputElement>(null);

  const query = value.startsWith('/') ? value.slice(1).toLowerCase() : null;
  const open = query !== null && !dismissed && !value.includes(' ');

  // Loaded the first time "/" is typed, per site.
  useEffect(() => {
    if (!open || replies !== null) return;
    api
      .get<{ replies: SavedReply[] }>('/saved-replies', {
        params: siteId ? { siteId } : {},
        cache: false
      })
      .then(({ data }) => setReplies(data.replies))
      .catch(() => setReplies([]));
  }, [open, replies, siteId]);
  useEffect(() => setReplies(null), [siteId]);

  const matches = useMemo(() => {
    if (!open || !replies) return [];
    return replies
      .filter(
        (r) => r.shortcut.startsWith(query || '') || r.title.toLowerCase().includes(query || '')
      )
      .slice(0, 8);
  }, [open, replies, query]);

  const insert = (reply: SavedReply) => {
    onChange(fillVariables(reply.body, vars));
    setDismissed(false);
    api.post(`/saved-replies/${reply._id}/use`).catch(() => undefined);
    field.current?.focus();
  };

  return (
    <div className="relative flex-1 min-w-0">
      <input
        {...input}
        ref={field}
        value={value}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-autocomplete="list"
        aria-controls="saved-reply-list"
        onChange={(e) => {
          setDismissed(false);
          setActive(0);
          onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (!open || !matches.length) return;
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((i) => (i + 1) % matches.length);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((i) => (i - 1 + matches.length) % matches.length);
          } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            insert(matches[active]);
          } else if (e.key === 'Escape') {
            // Only the list closes; a second Esc leaves the box (inbox shortcuts).
            e.preventDefault();
            setDismissed(true);
          }
        }}
        className={`w-full ${input.className || ''}`}
      />
      {open && replies !== null && (
        <ul
          id="saved-reply-list"
          role="listbox"
          className="absolute bottom-full mb-2 left-0 right-0 max-h-64 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg z-20"
        >
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              {t('savedReplies.none')}
            </li>
          ) : (
            matches.map((reply, i) => (
              <li
                key={reply._id}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insert(reply);
                }}
                className={`px-3 py-2 cursor-pointer ${i === active ? 'bg-indigo-50 dark:bg-indigo-500/15' : ''}`}
              >
                <span className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
                  /{reply.shortcut}
                </span>{' '}
                <span className="text-sm text-gray-900 dark:text-white">{reply.title}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">
                  {reply.body}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SavedReplyInput;
