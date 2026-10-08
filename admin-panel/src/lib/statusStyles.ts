// The colours a status, priority or presence state is drawn in.
//
// Kept apart from `format.ts` on purpose: that module turns values into text,
// this one turns values into Tailwind classes. Mixing the two is what produced
// the situation these tables replace — `getStatusColor` meant a badge in
// Conversations, a dot in Team, and `getStatusBadge` in Dashboard was a third
// palette for the same six statuses, so one conversation could be amber in the
// inbox and yellow on the dashboard.
//
// Every lookup falls back to a neutral entry rather than returning undefined: a
// status the server adds later renders in grey instead of unstyled.
//
// Text on the light badges is the 700/800 shade: the 600 ones fell below the
// 4.5:1 contrast WCAG asks of small text (axe, plan v10 UX-02).

import type { ConversationStatus, PresenceStatus, Priority } from '../types/api';

/** A badge: background, text colour, both themes. */
type BadgeClasses = string;

const CONVERSATION_STATUS_BADGES: Record<ConversationStatus, BadgeClasses> = {
  open: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  unassigned: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  assigned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  pending: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  closed: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
};

const NEUTRAL_BADGE = CONVERSATION_STATUS_BADGES.closed;

export function conversationStatusBadge(status: string | null | undefined): BadgeClasses {
  return CONVERSATION_STATUS_BADGES[status as ConversationStatus] ?? NEUTRAL_BADGE;
}

const PRIORITY_BADGES: Record<Priority, BadgeClasses> = {
  low: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
};

export function priorityBadge(priority: string | null | undefined): BadgeClasses {
  return PRIORITY_BADGES[priority as Priority] ?? PRIORITY_BADGES.normal;
}

/** The little presence dot next to an agent's name. */
const PRESENCE_DOTS: Record<PresenceStatus, string> = {
  online: 'bg-green-500',
  busy: 'bg-yellow-500',
  away: 'bg-gray-400',
  offline: 'bg-red-500'
};

export function presenceDot(status: string | null | undefined): string {
  return PRESENCE_DOTS[status as PresenceStatus] ?? PRESENCE_DOTS.offline;
}

/**
 * How urgent an SLA countdown looks, from the minutes left on the clock.
 *
 * A null or negative value is already breached and shows red; the thresholds
 * below it are the same ones the inbox has always used.
 */
export function slaUrgencyClass(minutesRemaining: number | null | undefined): string {
  if (minutesRemaining === null || minutesRemaining === undefined || minutesRemaining < 0) {
    return 'text-red-700 dark:text-red-400';
  }
  // Dark enough for the small type on the selected (indigo-50) row too.
  if (minutesRemaining < 5) return 'text-red-700 dark:text-red-400';
  if (minutesRemaining < 10) return 'text-yellow-800 dark:text-yellow-400';
  return 'text-green-800 dark:text-green-400';
}
