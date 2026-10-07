// The set-up mails a new owner gets (plan v10 PRD-08).
//
//   welcome            once the address is verified: where the install code is
//   widget_live        the first time the widget is seen on a page
//   install_reminder   a day on, if the widget has not been seen anywhere
//   faq_assistant      three days on, if there are no FAQs or the assistant is off
//   invite_team        a week on, if the owner is still alone
//
// They are about setting up the account and nothing else — transactional, not
// marketing (plan LEG-06) — and the owner can switch them off
// (preferences.activationEmails = false). Each is claimed in
// organizations.activation before it is sent, so it goes out once.

import { query } from '../db/pool';
import { appBaseUrl, mail } from './mail';

export type ActivationStep =
  'welcome' | 'widget_live' | 'install_reminder' | 'faq_assistant' | 'invite_team';

const LINKS: Record<ActivationStep, string> = {
  welcome: '/dashboard/sites',
  widget_live: '/dashboard/conversations',
  install_reminder: '/dashboard/sites',
  faq_assistant: '/dashboard/faqs',
  invite_team: '/dashboard/team'
};

interface OwnerRow {
  organization_id: string;
  email: string;
  name: string;
  preferences: { activationEmails?: boolean; locale?: string } | null;
}

/** Claims and sends one step for one organization; false if already sent. */
export async function sendActivation(
  organizationId: string,
  step: ActivationStep
): Promise<boolean> {
  const { rows } = await query<OwnerRow>(
    `SELECT o.id AS organization_id, u.email, u.name, u.preferences
       FROM organizations o
       JOIN users u ON u.id = o.owner_user_id AND u.is_active AND u.email_verified_at IS NOT NULL
      WHERE o.id = $1 AND o.is_active`,
    [organizationId]
  );
  const owner = rows[0];
  if (!owner || owner.preferences?.activationEmails === false) return false;
  const claimed = await query(
    `UPDATE organizations SET activation = activation || jsonb_build_object($2::text, now()::text)
      WHERE id = $1 AND NOT (activation ? $2::text)`,
    [organizationId, step]
  );
  if (!claimed.rowCount) return false;
  void mail.sendActivation(owner.email, {
    step,
    name: owner.name,
    link: `${appBaseUrl()}${LINKS[step]}`,
    settingsLink: `${appBaseUrl()}/dashboard/settings#notifications`,
    locale: owner.preferences?.locale === 'en' ? 'en' : 'tr'
  });
  return true;
}

/**
 * The time-based steps, for workspaces up to a month old. Runs from the
 * hourly retention sweep. `now` lets a test look ahead.
 */
export async function sweepActivation({
  now = new Date(),
  organizationId = null
}: { now?: Date; organizationId?: string | null } = {}): Promise<number> {
  // Only workspaces with a step due, newest first: a backlog of old ones
  // never keeps this week's sign-ups from their mails.
  const { rows } = await query<{
    id: string;
    age_days: number;
    activation: Record<string, string>;
    installed: boolean;
    faqs: number;
    assistant_on: boolean;
    seats: number;
  }>(
    `WITH recent AS (
       SELECT o.id, o.created_at,
              extract(epoch FROM ($1::timestamptz - o.created_at)) / 86400 AS age_days,
              o.activation,
              EXISTS (SELECT 1 FROM sites s WHERE s.organization_id = o.id
                       AND s.installation ->> 'verifiedAt' IS NOT NULL) AS installed,
              (SELECT count(*)::int FROM faqs f JOIN sites s ON s.id = f.site_id
                WHERE s.organization_id = o.id) AS faqs,
              EXISTS (SELECT 1 FROM sites s WHERE s.organization_id = o.id
                       AND s.assistant_enabled) AS assistant_on,
              ((SELECT count(*) FROM users WHERE organization_id = o.id AND is_active)
                + (SELECT count(*) FROM teams WHERE organization_id = o.id AND is_active)
                + (SELECT count(*) FROM invitations i WHERE i.organization_id = o.id
                    AND i.accepted_at IS NULL AND i.revoked_at IS NULL))::int AS seats
         FROM organizations o
         JOIN users u ON u.id = o.owner_user_id AND u.is_active
                     AND u.email_verified_at IS NOT NULL
                     AND coalesce((u.preferences ->> 'activationEmails')::boolean, true)
        WHERE o.is_active AND o.created_at > $1::timestamptz - interval '30 days'
          AND ($2::text IS NULL OR o.id = $2))
     SELECT * FROM recent
      WHERE NOT (activation ? 'welcome')
         OR (age_days >= 1 AND NOT installed AND NOT (activation ? 'install_reminder'))
         OR (age_days >= 3 AND (faqs = 0 OR NOT assistant_on) AND NOT (activation ? 'faq_assistant'))
         OR (age_days >= 7 AND seats <= 1 AND NOT (activation ? 'invite_team'))
      ORDER BY created_at DESC
      LIMIT 500`,
    [now, organizationId]
  );
  let sent = 0;
  for (const org of rows) {
    const done = org.activation || {};
    const due: ActivationStep[] = [];
    if (!done.welcome) due.push('welcome');
    if (org.age_days >= 1 && !org.installed && !done.install_reminder) due.push('install_reminder');
    if (org.age_days >= 3 && (org.faqs === 0 || !org.assistant_on) && !done.faq_assistant) {
      due.push('faq_assistant');
    }
    if (org.age_days >= 7 && org.seats <= 1 && !done.invite_team) due.push('invite_team');
    // One mail per workspace per pass: a late first pass must not send three.
    const step = due[0];
    // eslint-disable-next-line no-await-in-loop
    if (step && (await sendActivation(org.id, step))) sent += 1;
  }
  return sent;
}
