'use strict';

// Personal data (plan §16):
//
//  - the owner can download everything the organization stored, without
//    password hashes or sealed keys
//  - a visitor's IP and device details are dropped 90 days after the visit
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { generateId } from '../src/db/objectId';
import { sweepOnce, PERSONAL_DATA_DAYS } from '../src/db/retention';
import { BASE } from './helpers/widget';
import { signUp } from './helpers/accounts';

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

function sessionCookie(res: { headers: Headers }): string {
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

test.after(async () => {
  await getPool().end();
});

test('the owner downloads the organization’s data, without secrets', async () => {
  const email = `owner${stamp()}@privacy.test`;
  const reg = await signUp({ name: 'Privacy Owner', email, password: 'E2ePassw0rd!' });
  assert.equal(reg.status, 201);
  const token = sessionCookie(reg);
  const site = await fetch(`${BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: 'Export site', domain: `e${stamp()}.example` })
  });
  assert.equal(site.status, 201);

  const res = await fetch(`${BASE}/api/account/export`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  assert.equal(res.status, 200);
  assert.match(
    res.headers.get('content-disposition') || '',
    /attachment; filename="supportio-export-/
  );
  const text = await res.text();
  const data = JSON.parse(text);
  assert.equal(data.sites.length, 1);
  assert.equal(data.sites[0].name, 'Export site');
  assert.equal(data.users[0].email, email);
  for (const key of ['users', 'conversations', 'messages', 'visitors', 'faqs', 'auditLogs']) {
    assert.ok(Array.isArray(data[key]), `${key} is listed`);
  }
  assert.ok(!('password' in data.users[0]), 'no password hash');
  assert.ok(!('integrations' in data.sites[0]), 'no sealed integration keys');

  const anonymous = await fetch(`${BASE}/api/account/export`);
  assert.equal(anonymous.status, 401);
});

test(`a visitor’s IP and device are dropped ${PERSONAL_DATA_DAYS} days after the visit`, async () => {
  const { rows: sites } = await query('SELECT id, organization_id FROM sites LIMIT 1');
  assert.ok(sites[0], 'a site exists');
  const oldId = generateId();
  const recentId = generateId();
  await query(
    `INSERT INTO visitors (id, site_id, organization_id, visitor_id, ip, browser, os, last_active_at)
     VALUES ($1, $3, $4, $5, '203.0.113.7', 'Chrome', 'Windows', now() - interval '91 days'),
            ($2, $3, $4, $6, '203.0.113.8', 'Firefox', 'Linux', now() - interval '3 days')`,
    [oldId, recentId, sites[0].id, sites[0].organization_id, `v_${stamp()}`, `v_${stamp()}`]
  );
  try {
    await sweepOnce();
    const { rows } = await query('SELECT id, ip, browser, os FROM visitors WHERE id = ANY($1)', [
      [oldId, recentId]
    ]);
    const old = rows.find((r) => r.id === oldId);
    const recent = rows.find((r) => r.id === recentId);
    assert.deepEqual([old?.ip, old?.browser, old?.os], [null, null, null]);
    assert.equal(recent?.ip, '203.0.113.8', 'a recent visit keeps its details');
  } finally {
    await query('DELETE FROM visitors WHERE id = ANY($1)', [[oldId, recentId]]);
  }
});
