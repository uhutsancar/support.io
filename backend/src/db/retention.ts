'use strict';

// The event and automation log collections used to expire through a TTL index.
// PostgreSQL has no equivalent, so the same 30 day retention is applied by a
// periodic sweep.
import { query } from './pool';
import { errorText } from '../http/errors';
import { reconcileSubscriptions } from '../services/billing';

const RETENTION_DAYS = 30;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

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
    // A paid period that ended after cancellation, or a payment grace period
    // that ran out, changes the plan with no webhook; write it down.
    await reconcileSubscriptions();
  } catch (error) {
    console.error('Subscription reconciliation failed:', errorText(error));
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

export { startRetentionSweeps, stopRetentionSweeps, sweepOnce, RETENTION_DAYS };
