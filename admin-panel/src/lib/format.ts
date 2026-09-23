// Turning values into the text the dashboard shows.
//
// Each of these existed two or three times, defined inside a component body and
// recreated on every render. That is not just repetition — the copies had
// drifted, and the differences were all in the edge cases nobody compares:
//
//   formatMinutes(0)     "0dk" in Conversations, "-" in Dashboard, "0dk" in Analytics
//   formatMinutes(null)  "-"   in Conversations, "-" in Dashboard, "—" in Analytics
//   formatTime(null)     "-"   in Conversations and Dashboard, "" in TeamChat
//
// So the same figure read differently depending on which page you were on, and
// "-" meant both "zero minutes" and "never measured". The versions below make
// that distinction explicit and are used everywhere.

/** The locale the dashboard formats dates and numbers in. */
const LOCALE = 'tr-TR';

/** Shown where a value was never measured, as opposed to being zero. */
export const NOT_MEASURED = '—';

/**
 * A clock time, without a date: `14:30`.
 *
 * Returns `NOT_MEASURED` rather than an empty string for a missing value, so a
 * blank cell always means "we have no data" and never "the formatter fell over".
 */
export function formatTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return NOT_MEASURED;
  return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
}

/** A calendar date: `23.09.2026`. */
export function formatDate(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return NOT_MEASURED;
  return date.toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** A date and time together: `23.09.2026 14:30`. */
export function formatDateTime(value: Date | string | number | null | undefined): string {
  const date = toDate(value);
  if (!date) return NOT_MEASURED;
  return `${formatDate(date)} ${formatTime(date)}`;
}

/**
 * A timestamp as a chat client shows it: the time for today, "yesterday" for
 * yesterday, and a short date beyond that.
 *
 * `yesterdayLabel` is passed in because this module has no opinion about
 * translation; the caller has `t` and this does not.
 */
export function formatChatTimestamp(
  value: Date | string | number | null | undefined,
  yesterdayLabel: string
): string {
  const date = toDate(value);
  if (!date) return '';

  const now = new Date();
  if (isSameDay(date, now)) {
    return date.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return yesterdayLabel;

  return date.toLocaleDateString(LOCALE, { month: 'short', day: 'numeric' });
}

/**
 * A duration in minutes as `2s 15dk`.
 *
 * `null` and `undefined` mean "never measured" and render as `NOT_MEASURED`.
 * Zero is a real measurement — an instant reply — and renders as `0dk`. The
 * three copies of this disagreed on exactly that point, so an SLA of zero
 * minutes displayed as "no data" on one page and "instant" on another.
 */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || Number.isNaN(minutes)) return NOT_MEASURED;
  if (minutes < 0) return 'Süre doldu';
  if (minutes === 0) return '0dk';

  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  return hours > 0 ? `${hours}s ${rest}dk` : `${rest}dk`;
}

/** A byte count as `1.4 MB`. */
export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes < 0) return '0 Bytes';
  const units = ['Bytes', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${Math.round(value * 100) / 100} ${units[exponent]}`;
}

/** An amount of money in the organization's currency. */
export function formatCurrency(value: number | null | undefined, currency = 'TRY'): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_MEASURED;
  return new Intl.NumberFormat(LOCALE, { style: 'currency', currency }).format(value);
}

/** A percentage as `87%`, or `NOT_MEASURED` when there was nothing to divide. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return NOT_MEASURED;
  return `${Math.round(value)}%`;
}

/** The initials shown in an avatar when a person has no picture. */
export function initialsOf(name: string | null | undefined): string {
  if (!name) return '?';
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '?'
  );
}

// --------------------------------------------------------------------- helpers

/** Parses whatever the API sent, or null when it is not a usable date. */
function toDate(value: Date | string | number | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
