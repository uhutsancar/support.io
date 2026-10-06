'use strict';

// Tenant isolation, across every role, over REST and the admin socket
// (plan §5.3).
//
//   Org A: site A1, site A2, conversations in both, and one account of every
//          role — owner, viewer (users table); admin, manager, agent, and an
//          agent restricted to A1 (teams table).
//   Org B: site B with a conversation, FAQ, department, automation rule,
//          proactive rule, deal and a team member.
//
// No account of org A may read or change anything of org B by putting B's ids
// in a URL, a body or a socket payload. Inside org A, an agent restricted to
// A1 cannot reach A2, while an agent with no site assignment reaches both —
// the deliberate "empty means all" rule documented in src/http/guards.ts.
//
// Needs the running API. Run: npm test

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import { setPlan, signUp } from './helpers/accounts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import Conversation from '../src/models/Conversation';
import Message from '../src/models/Message';
import User from '../src/models/User';
import FAQ from '../src/models/FAQ';
import AutomationRule from '../src/models/AutomationRule';
import ProactiveRule from '../src/models/ProactiveRule';
import Deal from '../src/models/Deal';
import Department from '../src/models/Department';
import { getPool, query } from '../src/db/pool';
import { BASE } from './helpers/widget';

const PASSWORD = 'E2ePassw0rd!';

interface ApiResponse {
  status: number;
  body: any;
  headers: Headers;
}

async function api(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}
): Promise<ApiResponse> {
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

function sessionToken(res: { headers: Headers }): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : '';
}

const unique = (label: string) => `${label}${Date.now()}${Math.floor(Math.random() * 100000)}`;

async function login(email: string): Promise<string> {
  const res = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  assert.equal(res.status, 200, `login failed for ${email}: ${JSON.stringify(res.body)}`);
  return sessionToken(res);
}

async function register(label: string) {
  const email = `${unique(label)}@isolation.test`;
  const reg = await signUp({ name: `${label} owner`, email, password: PASSWORD });
  assert.equal(reg.status, 201, JSON.stringify(reg.body));
  return { token: sessionToken(reg), organizationId: String(reg.body.user.organizationId) };
}

async function site(token: string, label: string) {
  const res = await api('/api/sites', {
    method: 'POST',
    token,
    body: { name: `${label} site`, domain: `${unique(label)}.example` }
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body.site;
}

async function teamMember(ownerToken: string, role: string, assignedSites: string[] = []) {
  const email = `${unique(role)}@isolation.test`;
  const res = await api('/api/team', {
    method: 'POST',
    token: ownerToken,
    body: { email, password: PASSWORD, name: `${role} member`, role, assignedSites }
  });
  assert.equal(res.status, 201, `team create failed: ${JSON.stringify(res.body)}`);
  return { id: String(res.body._id), token: await login(email) };
}

async function conversationOn(siteRow: any): Promise<string> {
  const conversation = await new Conversation({
    siteId: siteRow._id,
    organizationId: siteRow.organizationId,
    visitorId: `v_${unique('iso')}`,
    visitorName: 'Isolation Visitor',
    status: 'open'
  }).save();
  await Message.create({
    conversationId: conversation._id,
    senderType: 'visitor',
    senderId: conversation.visitorId,
    senderName: 'Isolation Visitor',
    content: 'secret of this tenant'
  });
  return String(conversation._id);
}

interface World {
  a: {
    organizationId: string;
    site1: any;
    site2: any;
    conv1: string;
    conv2: string;
    tokens: Record<string, string>;
  };
  b: {
    organizationId: string;
    token: string;
    site: any;
    conv: string;
    faq: string;
    department: string;
    automation: string;
    proactive: string;
    deal: string;
    member: string;
  };
}

let world: World;

test.before(async () => {
  // ---------------------------------------------------------------- org B
  const ownerB = await register('orgb');
  // B needs a seat for its team member and the departments/rules below.
  await setPlan(ownerB.organizationId, 'PRO');
  const siteB = await site(ownerB.token, 'b');
  const convB = await conversationOn(siteB);
  const faq = await new FAQ({ siteId: siteB._id, question: 'B?', answer: 'B.' }).save();
  const department = await new Department({ name: 'B dept', siteId: siteB._id }).save();
  const automation = await new AutomationRule({
    siteId: siteB._id,
    name: 'B rule',
    triggerType: 'message_received',
    actions: [{ type: 'add_tag', payload: { tag: 'b' } }]
  }).save();
  const proactive = await new ProactiveRule({ siteId: siteB._id, name: 'B proactive' }).save();
  const deal = await new Deal({
    title: 'B deal',
    contactName: 'B contact',
    organizationId: ownerB.organizationId,
    createdBy: '0'.repeat(24)
  }).save();
  const memberB = await teamMember(ownerB.token, 'agent');

  // ---------------------------------------------------------------- org A
  const ownerA = await register('orga');
  // Every plan-gated route is open to A, so a refusal below is about the
  // tenant boundary and never about the plan.
  await query(`UPDATE organizations SET plan_type = 'ENTERPRISE' WHERE id = $1`, [
    ownerA.organizationId
  ]);
  const site1 = await site(ownerA.token, 'a1');
  const site2 = await site(ownerA.token, 'a2');
  const conv1 = await conversationOn(site1);
  const conv2 = await conversationOn(site2);

  const viewerEmail = `${unique('viewer')}@isolation.test`;
  await User.create({
    email: viewerEmail,
    password: PASSWORD,
    name: 'viewer member',
    role: 'viewer',
    organizationId: ownerA.organizationId
  });

  const tokens: Record<string, string> = {
    owner: ownerA.token,
    viewer: await login(viewerEmail),
    admin: (await teamMember(ownerA.token, 'admin')).token,
    manager: (await teamMember(ownerA.token, 'manager')).token,
    agent: (await teamMember(ownerA.token, 'agent')).token,
    'agent-a1': (await teamMember(ownerA.token, 'agent', [site1._id])).token
  };

  world = {
    a: { organizationId: ownerA.organizationId, site1, site2, conv1, conv2, tokens },
    b: {
      organizationId: ownerB.organizationId,
      token: ownerB.token,
      site: siteB,
      conv: convB,
      faq: String(faq._id),
      department: String(department._id),
      automation: String(automation._id),
      proactive: String(proactive._id),
      deal: String(deal._id),
      member: memberB.id
    }
  };
});

const ROLES = ['owner', 'viewer', 'admin', 'manager', 'agent', 'agent-a1'];

// ------------------------------------------------------------------- REST

test("no role of org A can read or write org B's data over REST", async () => {
  const { a, b } = world;
  const attempts: Array<[string, string, unknown?]> = [
    ['GET', `/api/sites/${b.site._id}`],
    ['PUT', `/api/sites/${b.site._id}`, { name: 'pwned' }],
    ['DELETE', `/api/sites/${b.site._id}`],
    ['POST', `/api/sites/${b.site._id}/regenerate-key`],
    ['GET', `/api/conversations/${b.site._id}`],
    ['GET', `/api/conversations/${b.site._id}/${b.conv}`],
    // B's conversation behind one of A's own sites.
    ['GET', `/api/conversations/${a.site1._id}/${b.conv}`],
    ['PUT', `/api/conversations/${b.conv}/status`, { status: 'closed' }],
    ['PUT', `/api/conversations/${b.conv}/priority`, { priority: 'urgent' }],
    ['PUT', `/api/conversations/${b.conv}/assign`, { agentId: null }],
    ['PUT', `/api/conversations/${b.conv}/claim`],
    ['PUT', `/api/conversations/${b.conv}/department`, { departmentId: null }],
    ['POST', `/api/conversations/${b.conv}/notes`, { note: 'pwned' }],
    ['DELETE', `/api/conversations/${b.site._id}/${b.conv}`],
    ['GET', `/api/faqs/admin/${b.site._id}`],
    ['PUT', `/api/faqs/admin/${b.faq}`, { question: 'pwned' }],
    ['DELETE', `/api/faqs/admin/${b.faq}`],
    ['GET', `/api/departments/site/${b.site._id}`],
    ['GET', `/api/departments/${b.department}`],
    ['PUT', `/api/departments/${b.department}`, { name: 'pwned' }],
    ['DELETE', `/api/departments/${b.department}`],
    ['GET', `/api/departments/${b.department}/stats`],
    ['GET', `/api/automation-rules/${b.site._id}`],
    ['PUT', `/api/automation-rules/${b.automation}`, { name: 'pwned' }],
    ['DELETE', `/api/automation-rules/${b.automation}`],
    ['GET', `/api/proactive-rules/${b.site._id}`],
    ['PUT', `/api/proactive-rules/${b.proactive}`, { name: 'pwned' }],
    ['DELETE', `/api/proactive-rules/${b.proactive}`],
    ['GET', `/api/visitors/site/${b.site._id}`],
    ['GET', `/api/widget-config/site/${b.site._id}`],
    ['PUT', `/api/widget-config/site/${b.site._id}`, { colors: { primary: '#FF0000' } }],
    ['PUT', `/api/deals/${b.deal}/stage`, { stage: 'won' }],
    ['DELETE', `/api/deals/${b.deal}`],
    ['GET', `/api/team/${b.member}`],
    ['GET', `/api/team/${b.member}/stats`],
    ['PUT', `/api/team/${b.member}`, { name: 'pwned' }],
    ['PATCH', `/api/team/${b.member}/status`, { status: 'offline' }],
    ['DELETE', `/api/team/${b.member}`],
    ['GET', `/api/analytics/overview?siteId=${b.site._id}`],
    ['POST', `/api/files/agent-upload?siteId=${b.site._id}`]
  ];

  for (const role of ROLES) {
    for (const [method, path, body] of attempts) {
      // eslint-disable-next-line no-await-in-loop
      const res = await api(path, { method, token: a.tokens[role], body });
      assert.ok(
        res.status >= 400 && res.status < 500,
        `${role}: ${method} ${path} answered ${res.status}`
      );
      assert.ok(
        !JSON.stringify(res.body ?? '').includes('secret of this tenant'),
        `${role}: ${method} ${path} leaked a message`
      );
    }
  }

  // And B's rows are untouched.
  const { rows } = await query(
    `SELECT c.status, c.priority, s.name, (SELECT count(*) FROM conversation_internal_notes n WHERE n.conversation_id = c.id)::int AS notes
       FROM conversations c JOIN sites s ON s.id = c.site_id WHERE c.id = $1`,
    [b.conv]
  );
  assert.equal(rows[0].status, 'open');
  assert.equal(rows[0].priority, 'normal');
  assert.equal(rows[0].notes, 0);
  assert.notEqual(rows[0].name, 'pwned');
  const deal = await query('SELECT stage FROM deals WHERE id = $1', [b.deal]);
  assert.equal(deal.rows[0].stage, 'new');
});

test("org A's listings never contain org B's rows", async () => {
  const { a, b } = world;
  for (const role of ROLES) {
    const token = a.tokens[role];
    /* eslint-disable no-await-in-loop */
    const sites = await api('/api/sites', { token });
    assert.ok(!JSON.stringify(sites.body).includes(b.site._id), `${role} lists B's site`);
    const deals = await api('/api/deals', { token });
    assert.ok(!JSON.stringify(deals.body).includes(b.deal), `${role} lists B's deal`);
    const team = await api('/api/team', { token });
    assert.ok(!JSON.stringify(team.body).includes(b.member), `${role} lists B's member`);
    const unread = await api('/api/conversations/unread-count', { token });
    assert.ok(!JSON.stringify(unread.body).includes(b.site._id), `${role} counts B's site`);
    /* eslint-enable no-await-in-loop */
  }
});

// ----------------------------------------------------- inside one tenant

test('a site-restricted agent reaches only its sites; an unrestricted one reaches all', async () => {
  const { a } = world;
  const restricted = a.tokens['agent-a1'];
  assert.equal((await api(`/api/conversations/${a.site1._id}`, { token: restricted })).status, 200);
  assert.equal(
    (await api(`/api/conversations/${a.site1._id}/${a.conv1}`, { token: restricted })).status,
    200
  );
  assert.equal((await api(`/api/conversations/${a.site2._id}`, { token: restricted })).status, 404);
  assert.equal(
    (await api(`/api/conversations/${a.site2._id}/${a.conv2}`, { token: restricted })).status,
    404
  );
  assert.equal(
    (
      await api(`/api/conversations/${a.conv2}/notes`, {
        method: 'POST',
        token: restricted,
        body: { note: 'not mine' }
      })
    ).status,
    404
  );
  assert.equal((await api(`/api/visitors/site/${a.site2._id}`, { token: restricted })).status, 404);
  const unread = await api('/api/conversations/unread-count', { token: restricted });
  assert.ok(!(a.site2._id in unread.body.unreadBySite), 'the restricted agent counts site A2');

  // No assignment means every site of the organization (src/http/guards.ts).
  const open = a.tokens.agent;
  assert.equal((await api(`/api/conversations/${a.site2._id}`, { token: open })).status, 200);
  assert.equal(
    (await api(`/api/conversations/${a.site2._id}/${a.conv2}`, { token: open })).status,
    200
  );
});

test('a viewer reads but cannot change a conversation', async () => {
  const { a } = world;
  const viewer = a.tokens.viewer;
  assert.equal(
    (await api(`/api/conversations/${a.site1._id}/${a.conv1}`, { token: viewer })).status,
    200
  );
  for (const [path, body] of [
    [`/api/conversations/${a.conv1}/status`, { status: 'closed' }],
    [`/api/conversations/${a.conv1}/priority`, { priority: 'high' }],
    [`/api/conversations/${a.conv1}/claim`, undefined],
    [`/api/conversations/${a.conv1}/assign`, { agentId: null }]
  ] as Array<[string, unknown]>) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api(path, { method: 'PUT', token: viewer, body });
    assert.equal(res.status, 403, `viewer: PUT ${path} answered ${res.status}`);
  }
});

// ------------------------------------------------------------------ socket

function adminSocket(token: string): Promise<Socket> {
  const socket = connect(`${BASE}/admin`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token }
  });
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

/** Emits and resolves with the first `error` the server answers, or null. */
function refused(
  socket: Socket,
  event: string,
  payload: unknown,
  ms = 1500
): Promise<string | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off('error', onError);
      resolve(null);
    }, ms);
    const onError = (data: { message?: string }) => {
      clearTimeout(timer);
      resolve(data?.message || 'error');
    };
    socket.once('error', onError);
    socket.emit(event, payload);
  });
}

test("no role of org A can reach org B's conversation over the admin socket", async () => {
  const { a, b } = world;
  const before = await query('SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1', [
    b.conv
  ]);

  for (const role of ROLES) {
    // eslint-disable-next-line no-await-in-loop
    const socket = await adminSocket(a.tokens[role]);
    try {
      const leaks: unknown[] = [];
      socket.on('new-message', (data) => leaks.push(data));
      for (const [event, payload] of [
        ['join-site', { siteId: b.site._id }],
        ['join-conversation', { conversationId: b.conv }],
        ['send-message', { conversationId: b.conv, content: 'pwned' }],
        ['set-priority', { conversationId: b.conv, priority: 'urgent' }],
        ['resolve-conversation', { conversationId: b.conv }],
        ['claim-conversation', { conversationId: b.conv }],
        ['assign-conversation', { conversationId: b.conv, agentId: b.member }],
        ['set-department', { conversationId: b.conv, departmentId: b.department }]
      ] as Array<[string, unknown]>) {
        // eslint-disable-next-line no-await-in-loop
        const message = await refused(socket, event, payload);
        assert.ok(message, `${role}: ${event} on B was not refused`);
      }
      assert.deepEqual(leaks, [], `${role} heard B's messages`);
    } finally {
      socket.disconnect();
    }
  }

  const after = await query('SELECT count(*)::int AS n FROM messages WHERE conversation_id = $1', [
    b.conv
  ]);
  assert.equal(after.rows[0].n, before.rows[0].n, "a message was written into B's conversation");
  const conv = await query('SELECT status, priority FROM conversations WHERE id = $1', [b.conv]);
  assert.equal(conv.rows[0].status, 'open');
  assert.equal(conv.rows[0].priority, 'normal');
});

test('the restricted agent is refused site A2 over the socket too', async () => {
  const { a } = world;
  const socket = await adminSocket(a.tokens['agent-a1']);
  try {
    assert.ok(await refused(socket, 'join-site', { siteId: a.site2._id }));
    assert.ok(await refused(socket, 'join-conversation', { conversationId: a.conv2 }));
    assert.equal(
      await refused(socket, 'join-conversation', { conversationId: a.conv1 }, 800),
      null,
      'its own site was refused'
    );
  } finally {
    socket.disconnect();
  }
});

test('a viewer cannot write over the socket', async () => {
  const { a } = world;
  const socket = await adminSocket(a.tokens.viewer);
  try {
    assert.equal(
      await refused(socket, 'send-message', { conversationId: a.conv1, content: 'hi' }),
      'Insufficient role permissions'
    );
    assert.equal(
      await refused(socket, 'resolve-conversation', { conversationId: a.conv1 }),
      'Insufficient role permissions'
    );
  } finally {
    socket.disconnect();
  }
});

test.after(async () => {
  await getPool().end();
});
