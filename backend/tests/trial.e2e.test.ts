'use strict';

// The free Pro trial (plan v10 PRD-15): every new workspace gets Pro for 14
// days with no card; three days before the end the owner is reminded, at the
// end they are told; the plan in force falls back to Free by the clock, paid
// features lock, and nothing is deleted. Each mail goes out once.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { sweepTrials } from '../src/services/trial';
import { outboxFor } from '../src/services/mail/console';
import { getPlan } from '../src/services/entitlements';
import { outbox } from './helpers/accounts';
import { call, tenant } from './helpers/idor';

test.after(async () => {
  await closeRedisClient();
  await getPool().end();
});

const DAY = 86_400_000;

/** The API's hourly sweep may send it before this process does; either counts. */
async function mailed(email: string, subject: RegExp): Promise<number> {
  const here = outboxFor(email).filter((m) => subject.test(m.subject)).length;
  const there = (await outbox(email)).filter((m) => subject.test(m.subject)).length;
  return here + there;
}

async function trialAudits(organizationId: string, action: string): Promise<number> {
  const { rows } = await query(
    'SELECT count(*)::int AS n FROM audit_logs WHERE organization_id = $1 AND action = $2',
    [organizationId, action]
  );
  return rows[0].n;
}

test('a new workspace is on Pro for fourteen days, with no card', async () => {
  const t = await tenant('trialnew');
  const { rows } = await query('SELECT plan_type, trial_ends_at FROM organizations WHERE id = $1', [
    t.organizationId
  ]);
  assert.equal(rows[0].plan_type, 'FREE', 'nothing was bought');
  const left = new Date(rows[0].trial_ends_at).getTime() - Date.now();
  assert.ok(left > 13.9 * DAY && left <= 14 * DAY, `${left / DAY} days`);
  assert.equal(await getPlan(t.organizationId), 'PRO');
  assert.equal(await trialAudits(t.organizationId, 'TRIAL_STARTED'), 1);
  const { rows: subs } = await query(
    'SELECT count(*)::int AS n FROM subscriptions WHERE organization_id = $1',
    [t.organizationId]
  );
  assert.equal(subs[0].n, 0, 'no subscription, no payment details');
});

test('three days before the end a reminder, at the end a notice, each once', async () => {
  const t = await tenant('trialend');
  const pro = await call(t.token, '/api/departments', 'POST', {
    name: 'Satış',
    siteId: t.site._id
  });
  assert.equal(pro.status, 201, `a Pro feature is open during the trial: ${pro.text}`);

  await query(`UPDATE organizations SET trial_ends_at = now() + interval '2 days' WHERE id = $1`, [
    t.organizationId
  ]);
  await sweepTrials();
  await sweepTrials();
  const { rows: reminded } = await query(
    'SELECT trial_reminder_sent_at FROM organizations WHERE id = $1',
    [t.organizationId]
  );
  assert.ok(reminded[0].trial_reminder_sent_at, 'reminded');
  assert.equal(await mailed(t.email, /deneme sürenizin bitmesine 2 gün/i), 1, 'one reminder');
  assert.equal(await getPlan(t.organizationId), 'PRO', 'still Pro until the end');

  await query(
    `UPDATE organizations SET trial_ends_at = now() - interval '1 minute' WHERE id = $1`,
    [t.organizationId]
  );
  assert.equal(await getPlan(t.organizationId), 'FREE', 'Free by the clock alone');
  await sweepTrials();
  await sweepTrials();
  assert.equal(await trialAudits(t.organizationId, 'TRIAL_ENDED'), 1);
  assert.equal(await mailed(t.email, /deneme/i), 2, 'the reminder and one notice');

  // Paid features lock; nothing was deleted.
  const locked = await call(t.token, '/api/departments', 'POST', {
    name: 'Destek',
    siteId: t.site._id
  });
  assert.equal(locked.status, 403);
  assert.equal(JSON.parse(locked.text).code, 'PLAN_UPGRADE_REQUIRED');
  const sites = await call(t.token, '/api/sites');
  assert.equal(sites.status, 200);
  assert.ok(sites.text.includes(t.site._id), 'the site is still there');
  const departments = await call(t.token, `/api/departments/site/${t.site._id}`);
  assert.ok(departments.text.includes('Satış'), 'what was made on Pro is kept');
});

test('a workspace that bought a plan hears nothing about the trial', async () => {
  const t = await tenant('trialpaid');
  await query(
    `UPDATE organizations SET plan_type = 'PRO', trial_ends_at = now() - interval '1 minute'
      WHERE id = $1`,
    [t.organizationId]
  );
  await sweepTrials();
  assert.equal(await mailed(t.email, /deneme/i), 0);
  assert.equal(await trialAudits(t.organizationId, 'TRIAL_ENDED'), 0);
  assert.equal(await getPlan(t.organizationId), 'PRO');
});
