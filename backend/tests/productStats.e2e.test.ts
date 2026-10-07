'use strict';

// The owner's numbers (plan v10 OBS-07): org:stats aggregates, and the
// weekly report goes to OPS_REPORT_EMAIL on Monday morning (UTC), once a
// week however many processes run the sweep, and never on another day.
//
// Runs on the e2e database. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool } from '../src/db/pool';
import { closeRedisClient, getRedisClient } from '../src/config/redis';
import { setMailTransport } from '../src/services/mail';
import { productStats, statsText, weeklyReport } from '../src/services/productStats';
import type { OutgoingMail } from '../src/services/mail';

const caught: OutgoingMail[] = [];
setMailTransport({
  name: 'test',
  async send(mail) {
    caught.push(mail);
  }
});
const saved = process.env.OPS_REPORT_EMAIL;

test.after(async () => {
  if (saved === undefined) delete process.env.OPS_REPORT_EMAIL;
  else process.env.OPS_REPORT_EMAIL = saved;
  await closeRedisClient();
  await getPool().end();
});

test('the numbers come back whole, and as text', async () => {
  const stats = await productStats(30);
  assert.equal(stats.days, 30);
  for (const key of [
    'workspaces',
    'activeWorkspaces',
    'liveWidgets',
    'signups',
    'newPaying',
    'canceled'
  ]) {
    assert.ok(Number.isInteger((stats as any)[key]) && (stats as any)[key] >= 0, key);
  }
  for (const rate of [stats.verifiedRate, stats.activationRate, stats.assistant.resolvedRate]) {
    assert.ok(rate >= 0 && rate <= 100);
  }
  assert.equal(stats.estimatedMrr.currency, 'TRY');
  const text = statsText(stats);
  assert.match(text, /Son 30 gün/);
  assert.match(text, /Tahmini MRR/);
  assert.doesNotMatch(text, /@/, 'no addresses in the report');
});

test('the weekly report goes out on Monday morning, once', async () => {
  process.env.OPS_REPORT_EMAIL = 'owner-report@example.com';
  // A Monday far ahead, so a real week's key is never touched.
  const monday = new Date(Date.UTC(2031, 0, 6, 6, 30));
  assert.equal(monday.getUTCDay(), 1);
  const week = `2031-${Math.ceil((monday.getTime() - Date.UTC(2031, 0, 1)) / 604_800_000)}`;
  const redis = await getRedisClient();
  await redis?.del(`ops-report:${week}`);

  assert.equal(await weeklyReport(new Date(Date.UTC(2031, 0, 7, 6, 30))), false, 'Tuesday: no');
  assert.equal(await weeklyReport(new Date(Date.UTC(2031, 0, 6, 12, 0))), false, 'Monday noon: no');
  assert.equal(await weeklyReport(monday), true);
  assert.equal(await weeklyReport(new Date(monday.getTime() + 60_000)), false, 'once a week');
  const mails = caught.filter((m) => m.to === 'owner-report@example.com');
  assert.equal(mails.length, 1);
  assert.match(mails[0].subject, /haftalık rapor/);
  assert.match(mails[0].text, /Son 7 gün/);
  await redis?.del(`ops-report:${week}`);
});
