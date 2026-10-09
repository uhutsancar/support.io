'use strict';

// A downgrade below what the workspace uses (plan v10 BIL-04, KARAR-BIL-1):
//
//  - nothing is deleted; sites over the limit are on hold — the widget gives
//    no session, a visitor already connected is closed, the panel may read
//    but not change them, and nobody can reply on them
//  - seats over the limit sign in and read but cannot reply or change
//    anything, and their live connection is closed so it reconnects with the
//    new rights; the owner's seat is never one of them
//  - the owner chooses which ones stay, never more than the plan allows,
//    and hears about it by mail
//  - an upgrade brings everything back
//
// Needs the running API with the console mail transport. Run: npm test

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getPool, query } from '../src/db/pool';
import { BASE, joinAsVisitor, widgetSession } from './helpers/widget';
import { outbox, setPlan, signUp, tokenFromMail } from './helpers/accounts';

const PASSWORD = 'E2ePassw0rd!';

async function api(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}
): Promise<{ status: number; body: any; headers: Headers }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json, headers: res.headers };
}

function sessionCookie(res: { headers: Headers }): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : '';
}

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

function adminSocket(token: string): Promise<Socket> {
  const socket = connect(`${BASE}/admin`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token }
  });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

const reply = (socket: Socket, conversationId: string) =>
  socket.timeout(10_000).emitWithAck('send-message', {
    conversationId,
    content: 'Hemen bakıyorum',
    clientMessageId: crypto.randomUUID()
  }) as Promise<{ ok: boolean; code?: string }>;

const disconnected = (socket: Socket) =>
  new Promise<void>((resolve) => {
    if (socket.disconnected) return resolve();
    socket.once('disconnect', () => resolve());
  });

const sockets: Socket[] = [];
test.after(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await getPool().end();
});

async function workspace() {
  const email = `owner${stamp()}@overage.test`;
  const reg = await signUp({ name: 'Overage Owner', email, password: PASSWORD });
  assert.equal(reg.status, 201);
  const organizationId = String(reg.body.user.organizationId);
  await setPlan(organizationId, 'PRO');
  const token = sessionCookie(reg);

  const sites = [];
  for (const name of ['first', 'second', 'third']) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api('/api/sites', {
      method: 'POST',
      token,
      body: { name, domain: `${name}${stamp()}.example` }
    });
    assert.equal(res.status, 201, JSON.stringify(res.body));
    sites.push(res.body.site);
  }

  const agents = [];
  for (const name of ['Ayşe', 'Mehmet']) {
    const agentEmail = `agent${stamp()}@overage.test`;
    // eslint-disable-next-line no-await-in-loop
    const sent = await api('/api/invitations', {
      method: 'POST',
      token,
      body: { email: agentEmail, role: 'agent' }
    });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    // eslint-disable-next-line no-await-in-loop
    const invite = await tokenFromMail(agentEmail, '/invite/accept');
    // eslint-disable-next-line no-await-in-loop
    const accepted = await api('/api/invitations/accept', {
      method: 'POST',
      body: { token: invite, name, password: PASSWORD }
    });
    assert.equal(accepted.status, 201, JSON.stringify(accepted.body));
    agents.push({ id: String(accepted.body.user.id), token: sessionCookie(accepted) });
  }
  return { email, organizationId, token, sites, agents };
}

async function openConversation(siteKey: string) {
  const visitor = await joinAsVisitor(siteKey);
  sockets.push(visitor.socket);
  const sent: any = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Merhaba',
    clientMessageId: crypto.randomUUID()
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  return { socket: visitor.socket, conversationId: String(sent.message.conversationId) };
}

test('a downgrade puts what is over the plan on hold, deletes nothing, and an upgrade brings it back', async () => {
  const org = await workspace();
  const [first, second, third] = org.sites;
  const onFirst = await openConversation(first.siteKey);
  const onSecond = await openConversation(second.siteKey);
  const agentLive = await adminSocket(org.agents[0].token);

  // Nothing over the limit yet: nothing on hold, nothing to choose.
  const before = await api('/api/billing/overage', { token: org.token });
  assert.equal(before.status, 200, JSON.stringify(before.body));
  assert.equal(before.body.over, false);

  // Free allows one site and one seat, the owner's.
  await setPlan(org.organizationId, 'FREE');
  const tooMany = await api('/api/billing/overage', {
    method: 'POST',
    token: org.token,
    body: { keepSiteIds: [first._id, second._id] }
  });
  assert.equal(tooMany.status, 400);
  assert.equal(tooMany.body.code, 'OVER_PLAN_LIMIT');
  const foreign = await api('/api/billing/overage', {
    method: 'POST',
    token: org.token,
    body: { keepSiteIds: ['0123456789abcdef01234567'] }
  });
  assert.equal(foreign.status, 400);

  const agentGone = disconnected(agentLive);
  const visitorGone = disconnected(onFirst.socket);
  const chosen = await api('/api/billing/overage', {
    method: 'POST',
    token: org.token,
    body: { keepSiteIds: [second._id] }
  });
  assert.equal(chosen.status, 200, JSON.stringify(chosen.body));
  assert.deepEqual(chosen.body.change.sitesSuspended.sort(), [first._id, third._id].sort());
  assert.equal(chosen.body.change.seatsSuspended.length, 2);
  assert.equal(chosen.body.over, true);
  const owner = chosen.body.members.find((m: any) => m.owner);
  assert.equal(owner.suspendedAt, null, 'the owner’s seat is never on hold');

  // Live connections of what went on hold are closed.
  await agentGone;
  await visitorGone;

  // Nothing deleted.
  const { rows: counted } = await query(
    `SELECT (SELECT count(*) FROM sites WHERE organization_id = $1)::int AS sites,
            (SELECT count(*) FROM teams WHERE organization_id = $1 AND is_active)::int AS agents,
            (SELECT count(*) FROM conversations WHERE organization_id = $1)::int AS conversations`,
    [org.organizationId]
  );
  assert.deepEqual(counted[0], { sites: 3, agents: 2, conversations: 2 });

  // The widget on a suspended site gets no session; the kept one does.
  const silent = await widgetSession(first.siteKey);
  assert.notEqual(silent.status, 200);
  const kept = await widgetSession(second.siteKey);
  assert.equal(kept.status, 200, JSON.stringify(kept.body));

  // The panel reads a suspended site but does not change it.
  const read = await api(`/api/sites/${first._id}`, { token: org.token });
  assert.equal(read.status, 200);
  const changed = await api(`/api/sites/${first._id}`, {
    method: 'PUT',
    token: org.token,
    body: { name: 'renamed' }
  });
  assert.equal(changed.status, 403);
  assert.equal(changed.body.code, 'SITE_SUSPENDED');

  // Nobody replies on a suspended site.
  const ownerSocket = await adminSocket(org.token);
  const onHold = await reply(ownerSocket, onFirst.conversationId);
  assert.equal(onHold.ok, false);
  assert.equal(onHold.code, 'SITE_SUSPENDED');
  const allowed = await reply(ownerSocket, onSecond.conversationId);
  assert.equal(allowed.ok, true, JSON.stringify(allowed));

  // A seat on hold signs in and reads, but does not reply or change anything.
  const agent = org.agents[0];
  const me = await api('/api/auth/me', { token: agent.token });
  assert.equal(me.status, 200);
  assert.equal(me.body.user.seatSuspended, true);
  const list = await api(`/api/conversations/${second._id}`, { token: agent.token });
  assert.equal(list.status, 200, JSON.stringify(list.body));
  const status = await api(`/api/conversations/${onSecond.conversationId}/status`, {
    method: 'PUT',
    token: agent.token,
    body: { status: 'closed' }
  });
  assert.equal(status.status, 403);
  assert.equal(status.body.code, 'SEAT_SUSPENDED');
  const agentAgain = await adminSocket(agent.token);
  const refused = await reply(agentAgain, onSecond.conversationId);
  assert.equal(refused.ok, false);
  assert.equal(refused.code, 'SEAT_SUSPENDED');

  // Written down, and the owner was told.
  const { rows: trail } = await query(
    `SELECT action, count(*)::int AS n FROM audit_logs
      WHERE organization_id = $1 AND action IN ('SITE_SUSPENDED', 'SEAT_SUSPENDED')
      GROUP BY action ORDER BY action`,
    [org.organizationId]
  );
  assert.deepEqual(trail, [
    { action: 'SEAT_SUSPENDED', n: 2 },
    { action: 'SITE_SUSPENDED', n: 2 }
  ]);
  const mails = await outbox(org.email);
  assert.ok(
    mails.some((m) => /askıya/i.test(m.subject)),
    'the owner was not mailed about what went on hold'
  );

  // An upgrade brings everything back.
  await setPlan(org.organizationId, 'PRO');
  const restored = await api('/api/billing/overage', {
    method: 'POST',
    token: org.token,
    body: {}
  });
  assert.equal(restored.status, 200, JSON.stringify(restored.body));
  assert.equal(restored.body.change.sitesRestored.length, 2);
  assert.equal(restored.body.change.seatsRestored.length, 2);
  assert.equal(restored.body.over, false);
  assert.equal((await widgetSession(first.siteKey)).status, 200);
  const meAgain = await api('/api/auth/me', { token: agent.token });
  assert.equal(meAgain.body.user.seatSuspended, false);
});

test('only the owner sees or makes the choice', async () => {
  const org = await workspace();
  const asAgent = await api('/api/billing/overage', { token: org.agents[0].token });
  assert.equal(asAgent.status, 403);
});
