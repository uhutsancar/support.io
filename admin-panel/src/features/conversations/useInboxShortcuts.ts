// The inbox's keyboard shortcuts (plan v10 PRD-07):
//
//   j / k   next / previous conversation     e   mark as resolved
//   a       assign to yourself               s   snooze
//   /       go to the reply box, saved replies open      ?   this list
//
// They never fire while a text box, a list or a dialog has the keyboard: a
// "j" typed into a reply is a letter. Esc in a box leaves it, so the keys
// work again.

import { useEffect, useRef } from 'react';

export type InboxShortcut =
  'next' | 'previous' | 'resolve' | 'assign' | 'snooze' | 'reply' | 'help';

const KEYS: Record<string, InboxShortcut> = {
  j: 'next',
  k: 'previous',
  e: 'resolve',
  a: 'assign',
  s: 'snooze',
  '/': 'reply',
  '?': 'help'
};

/** The key list, in the order the help dialog shows it. */
export const INBOX_SHORTCUTS: Array<{ keys: string[]; action: InboxShortcut }> = [
  { keys: ['j'], action: 'next' },
  { keys: ['k'], action: 'previous' },
  { keys: ['e'], action: 'resolve' },
  { keys: ['a'], action: 'assign' },
  { keys: ['s'], action: 'snooze' },
  { keys: ['/'], action: 'reply' },
  { keys: ['?'], action: 'help' }
];

const typingIn = (target: EventTarget | null): target is HTMLElement =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function useInboxShortcuts(handlers: Record<InboxShortcut, () => void>, enabled = true) {
  const current = useRef(handlers);
  useEffect(() => {
    current.current = handlers;
  });

  useEffect(() => {
    if (!enabled) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (typingIn(event.target)) {
        if (event.key === 'Escape' && event.target.closest('[data-inbox]')) event.target.blur();
        return;
      }
      if (document.querySelector('[aria-modal="true"]')) return;
      const action = KEYS[event.key];
      if (!action) return;
      event.preventDefault();
      current.current[action]();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
