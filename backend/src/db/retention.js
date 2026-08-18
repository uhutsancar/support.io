'use strict';

const { query } = require('./pool');

// The event and automation log collections used to expire through a TTL index.
// PostgreSQL has no equivalent, so the same 30 day retention is applied by a
// periodic sweep.
const RETENTION_DAYS = 30;
const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

const TARGETS = [
  { table: 'event_logs', column: 'timestamp' },
  { table: 'automation_logs', column: 'executed_at' }
];

async function sweepOnce() {
  for (const target of TARGETS) {
    try {
      await query(
        `DELETE FROM ${target.table} WHERE "${target.column}" < now() - interval '${RETENTION_DAYS} days'`
      );
    } catch (error) {
      console.error(`Retention sweep failed for ${target.table}:`, error.message);
    }
  }
}

let timer = null;

function startRetentionSweeps() {
  if (timer) return timer;
  sweepOnce().catch(() => {});
  timer = setInterval(() => { sweepOnce().catch(() => {}); }, SWEEP_INTERVAL_MS);
  if (timer.unref) timer.unref();
  return timer;
}

module.exports = { startRetentionSweeps, sweepOnce, RETENTION_DAYS };
