// The free trial of the Pro plan (plan v10 PRD-15).
//
// Every new workspace gets Pro for TRIAL_DAYS (default 14, 0 switches the
// trial off) with no card and no Paddle involvement — the trial is ours, so
// the sign-up form never asks for payment details. When it ends nothing is
// deleted: the plan in force falls back to Free by the clock alone
// (services/entitlements.ts#getPlan) and paid features lock until the owner
// upgrades. The owner hears about it twice: three days before, and when it
// has ended.

import { getPool, query } from '../db/pool';
import { generateId } from '../db/objectId';
import { appBaseUrl, mail } from './mail';

const REMINDER_DAYS = 3;

export function trialDays(): number {
  const raw = process.env.TRIAL_DAYS;
  if (raw === undefined || raw === '') return 14;
  const days = Number(raw);
  return Number.isFinite(days) && days >= 0 ? Math.floor(days) : 14;
}

/** Whether a trial that ends at `endsAt` is running at `now`. */
export function trialRunning(endsAt: Date | string | null | undefined, now = new Date()): boolean {
  return Boolean(endsAt) && new Date(endsAt as Date).getTime() > now.getTime();
}

async function audit(
  organizationId: string,
  action: 'TRIAL_STARTED' | 'TRIAL_ENDED',
  metadata: object
) {
  await query(
    `INSERT INTO audit_logs (id, organization_id, user_id, action, entity_type, entity_id, metadata)
     VALUES ($1, $2, NULL, $3, 'organization', $2, $4)`,
    [generateId(), organizationId, action, JSON.stringify(metadata)]
  );
}

/** Starts the trial of a workspace created just now; never restarts one. */
export async function startTrial(organizationId: string): Promise<void> {
  const days = trialDays();
  if (!days) return;
  const { rowCount } = await query(
    `UPDATE organizations SET trial_ends_at = now() + make_interval(days => $2)
      WHERE id = $1 AND trial_ends_at IS NULL`,
    [organizationId, days]
  );
  if (rowCount) await audit(organizationId, 'TRIAL_STARTED', { plan: 'PRO', days });
}

interface TrialRow {
  id: string;
  name: string;
  trial_ends_at: Date;
  owner_email: string | null;
  owner_name: string | null;
}

/**
 * Sends the reminder and the "it has ended" mail where they are due. Runs
 * from the hourly retention sweep; each mail goes out once per workspace.
 * Workspaces that bought a plan (a subscription) or are on a hand-set plan
 * hear nothing.
 */
export async function sweepTrials(): Promise<{ reminded: number; ended: number }> {
  const pool = getPool();
  const base = `SELECT o.id, o.name, o.trial_ends_at, u.email AS owner_email, u.name AS owner_name
                  FROM organizations o
                  LEFT JOIN users u ON u.id = o.owner_user_id AND u.is_active
                 WHERE o.is_active AND o.trial_ends_at IS NOT NULL
                   AND o.plan_type = 'FREE' AND NOT o.billing_exempt
                   AND NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.organization_id = o.id)`;

  const reminder = await pool.query<TrialRow>(
    `${base}
       AND o.trial_reminder_sent_at IS NULL
       AND o.trial_ends_at > now()
       AND o.trial_ends_at <= now() + make_interval(days => ${REMINDER_DAYS})
     LIMIT 500`
  );
  for (const row of reminder.rows) {
    // eslint-disable-next-line no-await-in-loop
    const claimed = await pool.query(
      `UPDATE organizations SET trial_reminder_sent_at = now()
        WHERE id = $1 AND trial_reminder_sent_at IS NULL`,
      [row.id]
    );
    if (claimed.rowCount && row.owner_email) {
      const daysLeft = Math.max(
        1,
        Math.ceil((new Date(row.trial_ends_at).getTime() - Date.now()) / 86_400_000)
      );
      void mail.sendTrialEnding(row.owner_email, {
        name: row.owner_name || '',
        daysLeft,
        link: `${appBaseUrl()}/dashboard/upgrade`
      });
    }
  }

  const ended = await pool.query<TrialRow>(
    `${base}
       AND o.trial_ended_notified_at IS NULL
       AND o.trial_ends_at <= now()
     LIMIT 500`
  );
  for (const row of ended.rows) {
    // eslint-disable-next-line no-await-in-loop
    const claimed = await pool.query(
      `UPDATE organizations SET trial_ended_notified_at = now()
        WHERE id = $1 AND trial_ended_notified_at IS NULL`,
      [row.id]
    );
    if (!claimed.rowCount) continue;
    // eslint-disable-next-line no-await-in-loop
    await audit(row.id, 'TRIAL_ENDED', { plan: 'FREE' });
    if (row.owner_email) {
      void mail.sendTrialEnded(row.owner_email, {
        name: row.owner_name || '',
        link: `${appBaseUrl()}/dashboard/upgrade`
      });
    }
  }

  return { reminded: reminder.rows.length, ended: ended.rows.length };
}
