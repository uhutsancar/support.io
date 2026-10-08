'use strict';

// A site blocked for abuse (plan v10 LEG-05): `site:disable --reason …` stops
// the widget — no new session, and a page already open is refused from its
// next message — and the owner cannot switch it back on from the panel, nor
// reply on it, nor read the support note. `--enable` lifts it.
//
// Needs the running API; the command runs against the same database.
// Run: npm run test:compose -- --test tests/siteBlock.e2e.test.ts

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import path from 'node:path';
import { promisify } from 'node:util';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getPool, query } from '../src/db/pool';
import { BASE, joinAsVisitor, widgetSession } from './helpers/widget';
import { signUp } from './helpers/accounts';

const run = promisify(execFile);
const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;
const sockets: Socket[] = [];

test.after(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await getPool().end();
});

function sessionCookie(res: { headers: Headers }): string {
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

async function api(path: string, token: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  return { status: res.status, body: (await res.json().catch(() => null)) as any };
}

/** The support command, as the operator runs it, against the test database. */
async function siteDisable(...args: string[]) {
  const backend = path.join(__dirname, '..');
  return run(process.execPath, ['--import', 'tsx', 'src/cli/disableSite.ts', ...args], {
    cwd: backend,
    env: process.env
  });
}

const send = (socket: Socket, payload: Record<string, unknown>) =>
  socket.timeout(10_000).emitWithAck('send-message', {
    clientMessageId: crypto.randomUUID(),
    ...payload
  }) as Promise<{ ok: boolean; code?: string; message?: any }>;

test('a blocked site stays off until support lifts the block', async () => {
  const reg = await signUp({
    name: 'Block Owner',
    email: `owner${stamp()}@block.test`,
    password: 'E2ePassw0rd!'
  });
  assert.equal(reg.status, 201);
  const token = sessionCookie(reg);
  const created = await api('/api/sites', token, 'POST', {
    name: 'Blocked',
    domain: `b${stamp()}.example`
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const site = created.body.site;

  const visitor = await joinAsVisitor(site.siteKey);
  sockets.push(visitor.socket);
  const first = await send(visitor.socket, { content: 'Merhaba' });
  assert.equal(first.ok, true, JSON.stringify(first));

  const usage = await siteDisable(site.siteKey).catch((error) => error);
  assert.notEqual(usage.code ?? 0, 0, 'blocking without a reason is refused');

  const blocked = await siteDisable(site.siteKey, '--reason', 'phishing page');
  assert.match(blocked.stdout, /blocked/);

  // No new session; the open page is refused from its next message.
  assert.notEqual((await widgetSession(site.siteKey)).status, 200);
  const after = await send(visitor.socket, { content: 'Hâlâ orada mısınız?' });
  assert.equal(after.ok, false);

  // The owner reads it, sees it is blocked, cannot switch it back on or reply.
  const list = await api('/api/sites', token);
  const listed = list.body.sites.find((s: any) => s._id === site._id);
  assert.ok(listed.blockedAt, 'the panel sees that it is blocked');
  assert.equal('blockedReason' in listed, false, 'but not the support note');
  const reopen = await api(`/api/sites/${site._id}`, token, 'PUT', { isActive: true });
  assert.equal(reopen.status, 403);
  assert.equal(reopen.body.code, 'SITE_BLOCKED');

  const agent = connect(`${BASE}/admin`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token }
  });
  sockets.push(agent);
  await new Promise<void>((resolve, reject) => {
    agent.once('connect', () => resolve());
    agent.once('connect_error', reject);
  });
  const reply = await send(agent, {
    conversationId: String(first.message.conversationId),
    content: 'Yanıt'
  });
  assert.equal(reply.ok, false);
  assert.equal(reply.code, 'SITE_BLOCKED');

  const { rows } = await query(
    `SELECT metadata FROM audit_logs WHERE entity_id = $1 AND action = 'SITE_UPDATED'
      ORDER BY created_at DESC LIMIT 1`,
    [site._id]
  );
  assert.equal(rows[0].metadata.blocked, true);
  assert.equal(rows[0].metadata.reason, 'phishing page');

  await siteDisable(site.siteKey, '--enable');
  assert.equal((await widgetSession(site.siteKey)).status, 200);
});
