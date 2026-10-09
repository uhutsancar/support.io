// The weekly report mail (plan v10 PRD-22): every Monday from 08:00
// (Europe/Istanbul), the owner and the admins and managers of each workspace
// get the last seven days in a few lines — conversations, resolved, first
// response time, SLA, satisfaction, what the assistant answered, the busiest
// hour and who resolved most. Once per workspace and week, however often the
// hourly sweep runs; a quiet week sends nothing; anyone can turn it off in
// the notification settings.

import { query } from '../db/pool';
import { weekSummary } from '../db/reportQueries';
import { appBaseUrl, mail } from './mail';

const ZONE = 'Europe/Istanbul';
const SEND_FROM_HOUR = 8;

interface Recipient {
  email: string;
  name: string;
  preferences: { weeklyReport?: boolean; locale?: string } | null;
}

/**
 * Sends the reports that are due at `at`. `only` limits it to some
 * workspaces (tests); the hourly sweep passes neither.
 */
export async function sweepWeeklyReports({
  at = new Date(),
  only
}: { at?: Date; only?: string[] } = {}): Promise<{ sent: number; quiet: number }> {
  // Monday 00:00 of `at`'s week, in Istanbul, as a moment.
  const { rows: week } = await query<{ start: Date; due: boolean }>(
    `SELECT date_trunc('week', $1::timestamptz AT TIME ZONE $2) AT TIME ZONE $2 AS start,
            $1::timestamptz >= (date_trunc('week', $1::timestamptz AT TIME ZONE $2)
                                + make_interval(hours => $3)) AT TIME ZONE $2 AS due`,
    [at, ZONE, SEND_FROM_HOUR]
  );
  if (!week[0].due) return { sent: 0, quiet: 0 };
  const weekStart = week[0].start;

  const { rows: due } = await query<{ id: string; name: string }>(
    `SELECT o.id, o.name FROM organizations o
      WHERE o.is_active
        AND (o.weekly_report_sent_at IS NULL OR o.weekly_report_sent_at < $1)
        AND ($2::text[] IS NULL OR o.id = ANY($2::text[]))
      ORDER BY o.id
      LIMIT 200`,
    [weekStart, only ?? null]
  );

  let sent = 0;
  let quiet = 0;
  for (const organization of due) {
    // eslint-disable-next-line no-await-in-loop
    const claimed = await query(
      `UPDATE organizations SET weekly_report_sent_at = $3
        WHERE id = $1 AND (weekly_report_sent_at IS NULL OR weekly_report_sent_at < $2)`,
      [organization.id, weekStart, at]
    );
    if (!claimed.rowCount) continue;
    // eslint-disable-next-line no-await-in-loop
    const figures = await weekSummary(organization.id, ZONE);
    if (figures.conversations === 0) {
      quiet += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const { rows: recipients } = await query<Recipient>(
      `SELECT email, name, preferences FROM users
        WHERE organization_id = $1 AND is_active AND email_verified_at IS NOT NULL
          AND role IN ('owner', 'admin', 'manager') AND seat_suspended_at IS NULL
       UNION ALL
       SELECT email, name, preferences FROM teams
        WHERE organization_id = $1 AND is_active
          AND role IN ('owner', 'admin', 'manager') AND seat_suspended_at IS NULL`,
      [organization.id]
    );
    for (const person of recipients) {
      if (person.preferences?.weeklyReport === false) continue;
      const locale = person.preferences?.locale === 'en' ? 'en' : 'tr';
      const prefix = locale === 'en' ? '/en' : '';
      void mail.sendWeeklyReport(person.email, {
        name: person.name,
        workspace: organization.name,
        figures,
        link: `${appBaseUrl()}${prefix}/dashboard/analytics`,
        settingsLink: `${appBaseUrl()}${prefix}/dashboard/settings#notifications`,
        locale
      });
      sent += 1;
    }
  }
  return { sent, quiet };
}
