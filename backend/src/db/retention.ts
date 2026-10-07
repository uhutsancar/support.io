'use strict';

// The event and automation log collections used to expire through a TTL index.
// PostgreSQL has no equivalent, so the same 30 day retention is applied by a
// periodic sweep.
import { query } from './pool';
import { errorText } from '../http/errors';
import { reconcileSubscriptions } from '../services/billing';
import { sweepTrials } from '../services/trial';
import { reconcileAllPlanLimits } from '../services/planOverage';
import { sweepActivation } from '../services/activation';
import { deleteOrganization } from '../services/organizationDeletion';
import { nightlyPurge } from '../services/dataRetention';
import { weeklyReport } from '../services/productStats';

const RETENTION_DAYS = 30;
/** How long a visitor's IP and device details are kept after their last visit. */
const PERSONAL_DATA_DAYS = 90;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
/** How long a sign-up may wait for its verification link to be opened. */
const UNVERIFIED_SIGNUP_DAYS = 7;

const TARGETS = [
  { table: 'event_logs', column: 'timestamp' },
  { table: 'automation_logs', column: 'executed_at' }
];

async function sweepOnce() {
  try {
    // Spent or expired e-mail links are kept a week for support questions
    // ("I clicked it and nothing happened"), then dropped.
    await query(`DELETE FROM auth_tokens WHERE expires_at < now() - interval '7 days'`);
  } catch (error) {
    console.error('Retention sweep failed for auth_tokens:', errorText(error));
  }
  try {
    // Data minimisation (plan §16): a visitor's IP address and device details
    // are kept while they matter for support and dropped 90 days after they
    // were last seen; the same for the IP and browser in the audit trail.
    await query(
      `UPDATE visitors SET ip = NULL, browser = NULL, os = NULL, referrer = NULL
        WHERE last_active_at < now() - interval '${PERSONAL_DATA_DAYS} days'
          AND (ip IS NOT NULL OR browser IS NOT NULL OR os IS NOT NULL OR referrer IS NOT NULL)`
    );
    await query(
      `UPDATE audit_logs SET ip_address = NULL, user_agent = NULL
        WHERE created_at < now() - interval '${PERSONAL_DATA_DAYS} days'
          AND (ip_address IS NOT NULL OR user_agent IS NOT NULL)`
    );
  } catch (error) {
    console.error('Retention sweep failed for personal data:', errorText(error));
  }
  try {
    // A paid period that ended after cancellation, or a payment grace period
    // that ran out, changes the plan with no webhook; write it down.
    await reconcileSubscriptions();
  } catch (error) {
    console.error('Subscription reconciliation failed:', errorText(error));
  }
  try {
    // The free trial's reminder and its "it has ended" mail (PRD-15).
    await sweepTrials();
  } catch (error) {
    console.error('Trial sweep failed:', errorText(error));
  }
  try {
    // Sites and seats over the plan in force, which can change by the clock
    // alone (a trial or a paid period ending): on hold, or back (BIL-04).
    await reconcileAllPlanLimits();
  } catch (error) {
    console.error('Plan limit reconciliation failed:', errorText(error));
  }
  try {
    // The set-up mails of the first month (PRD-08).
    await sweepActivation();
  } catch (error) {
    console.error('Activation sweep failed:', errorText(error));
  }
  try {
    // A sign-up nobody confirmed within a week is not an account (SEC-06):
    // its workspace goes, so an address typed by someone else does not stay
    // reserved. Such a workspace never had a session, so it holds nothing.
    const { rows } = await query<{ organization_id: string }>(
      `SELECT u.organization_id FROM users u
         JOIN organizations o ON o.id = u.organization_id AND o.owner_user_id = u.id
        WHERE u.role = 'owner' AND u.is_active AND u.email_verified_at IS NULL
          AND u.created_at < now() - interval '${UNVERIFIED_SIGNUP_DAYS} days'
        LIMIT 200`
    );
    for (const { organization_id: organizationId } of rows) {
      // eslint-disable-next-line no-await-in-loop
      await deleteOrganization(organizationId);
    }
  } catch (error) {
    console.error('Retention sweep failed for unconfirmed sign-ups:', errorText(error));
  }
  try {
    // Conversations past the workspace's retention window, with their
    // attachments, once a night (SEC-17).
    await nightlyPurge();
  } catch (error) {
    console.error('Retention purge failed:', errorText(error));
  }
  try {
    // The owner's weekly numbers, Monday morning (OBS-07).
    await weeklyReport();
  } catch (error) {
    console.error('Weekly report failed:', errorText(error));
  }
  for (const target of TARGETS) {
    try {
      await query(
        `DELETE FROM ${target.table} WHERE "${target.column}" < now() - interval '${RETENTION_DAYS} days'`
      );
    } catch (error) {
      console.error(`Retention sweep failed for ${target.table}:`, errorText(error));
    }
  }
}

let timer: NodeJS.Timeout | null = null;

function startRetentionSweeps() {
  if (timer) return timer;
  sweepOnce().catch(() => {});
  timer = setInterval(() => {
    sweepOnce().catch(() => {});
  }, SWEEP_INTERVAL_MS);
  if (timer.unref) timer.unref();
  return timer;
}

function stopRetentionSweeps() {
  if (timer) clearInterval(timer);
  timer = null;
}

export { startRetentionSweeps, stopRetentionSweeps, sweepOnce, RETENTION_DAYS, PERSONAL_DATA_DAYS };
