// "Snooze until…" (plan v10 PRD-07): four usual times and a date picker.
// The menu is controlled by the page so the "s" shortcut can open it.

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlarmClock } from 'lucide-react';
import { formatDateTime } from '../../lib/format';

/** The usual snooze times, from `now`, in the browser's time zone. */
export function snoozePresets(now = new Date()): Array<{ key: string; at: Date }> {
  const inHours = (hours: number) => new Date(now.getTime() + hours * 60 * 60 * 1000);
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const monday = new Date(now);
  // Days until the coming Monday; on a Monday, the next one.
  monday.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7));
  monday.setHours(9, 0, 0, 0);
  return [
    { key: 'oneHour', at: inHours(1) },
    { key: 'threeHours', at: inHours(3) },
    { key: 'tomorrow', at: tomorrow },
    { key: 'nextWeek', at: monday }
  ];
}

/** `datetime-local` wants local time without a zone: 2026-10-08T14:30. */
const localInput = (date: Date) =>
  new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

const SnoozeMenu = ({
  open,
  onOpenChange,
  onSnooze,
  align = 'right'
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** An ISO time to snooze until. */
  onSnooze: (until: string) => void;
  align?: 'left' | 'right';
}) => {
  const { t } = useTranslation();
  const [custom, setCustom] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    box.current?.querySelector<HTMLElement>('[data-preset]')?.focus();
    const onDown = (event: MouseEvent) => {
      if (!box.current?.contains(event.target as Node)) onOpenChange(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onOpenChange(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  const choose = (at: Date) => {
    onSnooze(at.toISOString());
    onOpenChange(false);
    setCustom('');
  };

  return (
    <div ref={box} className="relative inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => onOpenChange(!open)}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
      >
        <AlarmClock className="w-3.5 h-3.5" aria-hidden="true" />
        {t('inboxTools.snooze.button')}
      </button>
      {open && (
        <div
          role="group"
          aria-label={t('inboxTools.snooze.title')}
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full mt-1 z-30 w-60 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg p-2`}
        >
          <p className="px-2 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
            {t('inboxTools.snooze.title')}
          </p>
          {snoozePresets().map(({ key, at }) => (
            <button
              key={key}
              type="button"
              data-preset
              onClick={() => choose(at)}
              className="w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded text-gray-800 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <span>{t(`inboxTools.snooze.${key}`)}</span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">
                {formatDateTime(at.toISOString())}
              </span>
            </button>
          ))}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const at = new Date(custom);
              if (!Number.isNaN(at.getTime())) choose(at);
            }}
            className="mt-1 border-t border-gray-200 dark:border-gray-700 pt-2 px-2"
          >
            <label className="block text-xs text-gray-600 dark:text-gray-300">
              {t('inboxTools.snooze.custom')}
              <input
                type="datetime-local"
                value={custom}
                min={localInput(new Date(Date.now() + 5 * 60_000))}
                onChange={(event) => setCustom(event.target.value)}
                className="mt-1 w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </label>
            <button
              type="submit"
              disabled={!custom}
              className="mt-2 w-full px-2 py-1.5 text-xs font-medium rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {t('inboxTools.snooze.apply')}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SnoozeMenu;
