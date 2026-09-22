'use strict';

// Ekip yönetiminde yetki sınırları.
//
// Bu testler üç gerçek açığı sabitler:
//
//  1. Yetki yükseltme. PUT /api/team/:id `role` alanını gövdeden alıp
//     doğrulamadan yazıyordu; ORM enum kontrolünü yalnızca save() yolunda
//     yaptığı için `role: 'owner'` veritabanına geçiyordu. `manage_users`
//     iznine sahip bir admin kendi kaydını owner yapıp faturalandırma ve plan
//     dahil her izni alabiliyordu.
//
//  2. Kiracılar arası yazma. PATCH /api/team/:id/status yalnızca oturum
//     istiyordu: herhangi bir şirketin kullanıcısı başka bir şirketin
//     temsilcisini çevrimdışı yapabiliyor (otomatik atamayı bozar) ve yanıtta
//     o kişinin profilini okuyabiliyordu.
//
//  3. Yabancı departmana yazma. POST /api/team gövdedeki departmentId'leri
//     org kontrolü olmadan güncelliyordu; yeni üye başka bir şirketin
//     departmanına eklenebiliyordu.
//
// Çalışan bir backend gerektirir. Çalıştırma: npm run test:compose

import dotenv from 'dotenv';
import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db/pool';

dotenv.config();

const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
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
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* boş gövde */ }
  return { status: res.status, body: json, headers: res.headers };
}

/** Oturum token'ı artık yanıt gövdesinde değil, httpOnly çerezde. */
function sessionToken(res: { headers: Headers }): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : '';
}

const unique = (label: string) => `${label}${Date.now()}${Math.floor(Math.random() * 100000)}`;

/** Sahibi, sitesi ve bir departmanı olan yeni bir şirket. */
async function createTenant(label: string) {
  const email = `${unique(label)}@team-security.test`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: `${label} owner`, email, password: PASSWORD, companyName: `${label} co` }
  });
  assert.ok(reg.status === 200 || reg.status === 201, `register failed: ${JSON.stringify(reg.body)}`);
  const token = sessionToken(reg);
  assert.ok(token, 'register must set the session cookie');

  const site = await api('/api/sites', {
    method: 'POST', token, body: { name: `${label} site`, domain: `${unique(label)}.test` }
  });
  assert.equal(site.status, 201, `site create failed: ${JSON.stringify(site.body)}`);

  const dept = await api('/api/departments', {
    method: 'POST', token, body: { name: `${label} dept`, siteId: site.body.site._id }
  });
  assert.ok(dept.status === 200 || dept.status === 201, `department create failed: ${JSON.stringify(dept.body)}`);
  const department = dept.body.department || dept.body;

  return { token, site: site.body.site, department };
}

/** Bir ekip üyesi oluşturur ve onun oturumunu açar. */
async function createMember(ownerToken: string, role: string, extra: Record<string, unknown> = {}) {
  const email = `${unique(role)}@team-security.test`;
  const created = await api('/api/team', {
    method: 'POST', token: ownerToken, body: { name: `${role} member`, email, password: PASSWORD, role, ...extra }
  });
  assert.ok(created.status === 200 || created.status === 201, `team create failed: ${JSON.stringify(created.body)}`);
  const member = created.body.teamMember || created.body.member || created.body;
  const login = await api('/api/auth/login', { method: 'POST', body: { email, password: PASSWORD } });
  assert.equal(login.status, 200, `member login failed: ${JSON.stringify(login.body)}`);
  return { id: String(member._id || member.id), token: sessionToken(login) };
}

async function storedRole(id: string): Promise<string | null> {
  const { rows } = await query('SELECT role FROM teams WHERE id = $1', [id]);
  return rows[0] ? rows[0].role : null;
}

// ------------------------------------------------------------ yetki yükseltme

test('an admin cannot promote themselves to owner', async () => {
  const tenant = await createTenant('selfpromo');
  const admin = await createMember(tenant.token, 'admin');

  const res = await api(`/api/team/${admin.id}`, { method: 'PUT', token: admin.token, body: { role: 'owner' } });
  assert.equal(res.status, 403, `self promotion must be refused, got ${res.status} ${JSON.stringify(res.body)}`);
  assert.equal(await storedRole(admin.id), 'admin');
});

test('nobody can write a role outside the team role set', async () => {
  const tenant = await createTenant('badrole');
  const agent = await createMember(tenant.token, 'agent');

  for (const role of ['owner', 'superuser']) {
    const res = await api(`/api/team/${agent.id}`, { method: 'PUT', token: tenant.token, body: { role } });
    assert.equal(res.status, 400, `role '${role}' must be rejected, got ${res.status}`);
    assert.equal(await storedRole(agent.id), 'agent');
  }
});

test('an admin cannot create or promote a peer admin', async () => {
  const tenant = await createTenant('peer');
  const admin = await createMember(tenant.token, 'admin');
  const agent = await createMember(tenant.token, 'agent');

  const create = await api('/api/team', {
    method: 'POST', token: admin.token,
    body: { name: 'peer', email: `${unique('peer')}@team-security.test`, password: PASSWORD, role: 'admin' }
  });
  assert.equal(create.status, 403, `admin creating admin must be refused, got ${create.status}`);

  const promote = await api(`/api/team/${agent.id}`, { method: 'PUT', token: admin.token, body: { role: 'admin' } });
  assert.equal(promote.status, 403, `admin promoting to admin must be refused, got ${promote.status}`);
  assert.equal(await storedRole(agent.id), 'agent');
});

test('an admin cannot edit or delete another admin', async () => {
  const tenant = await createTenant('peeredit');
  const admin = await createMember(tenant.token, 'admin');
  const other = await createMember(tenant.token, 'admin');

  const edit = await api(`/api/team/${other.id}`, { method: 'PUT', token: admin.token, body: { role: 'agent' } });
  assert.equal(edit.status, 403);
  assert.equal(await storedRole(other.id), 'admin');

  const del = await api(`/api/team/${other.id}`, { method: 'DELETE', token: admin.token });
  assert.equal(del.status, 403);
  assert.equal(await storedRole(other.id), 'admin');
});

test('the owner can still manage roles below them', async () => {
  const tenant = await createTenant('ownerok');
  const agent = await createMember(tenant.token, 'agent');

  const res = await api(`/api/team/${agent.id}`, { method: 'PUT', token: tenant.token, body: { role: 'manager' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await storedRole(agent.id), 'manager');
});

test('an admin can still manage agents', async () => {
  const tenant = await createTenant('adminok');
  const admin = await createMember(tenant.token, 'admin');
  const agent = await createMember(tenant.token, 'agent');

  const res = await api(`/api/team/${agent.id}`, { method: 'PUT', token: admin.token, body: { role: 'manager', name: 'Renamed' } });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(await storedRole(agent.id), 'manager');
});

// ------------------------------------------------- kiracılar arası durum yazma

test("another organization's member status cannot be changed or read", async () => {
  const victim = await createTenant('victim');
  const victimAgent = await createMember(victim.token, 'agent');
  await query("UPDATE teams SET status = 'online' WHERE id = $1", [victimAgent.id]);

  const attacker = await createTenant('attacker');
  const res = await api(`/api/team/${victimAgent.id}/status`, {
    method: 'PATCH', token: attacker.token, body: { status: 'offline' }
  });
  assert.equal(res.status, 404, `cross-tenant status write must be refused, got ${res.status}`);
  assert.equal(res.body && res.body.email, undefined, 'the response must not carry the foreign profile');

  const { rows } = await query('SELECT status FROM teams WHERE id = $1', [victimAgent.id]);
  assert.equal(rows[0].status, 'online');
});

test("an agent may change only their own status", async () => {
  const tenant = await createTenant('ownstatus');
  const agent = await createMember(tenant.token, 'agent');
  const colleague = await createMember(tenant.token, 'agent');

  const own = await api(`/api/team/${agent.id}/status`, { method: 'PATCH', token: agent.token, body: { status: 'away' } });
  assert.equal(own.status, 200, JSON.stringify(own.body));

  const other = await api(`/api/team/${colleague.id}/status`, { method: 'PATCH', token: agent.token, body: { status: 'offline' } });
  assert.equal(other.status, 403);
});

// --------------------------------------------------- yabancı departman / site

test("a member cannot be placed into another organization's department", async () => {
  const victim = await createTenant('deptvictim');
  const attacker = await createTenant('deptattacker');

  const res = await api('/api/team', {
    method: 'POST', token: attacker.token,
    body: {
      name: 'intruder', email: `${unique('intruder')}@team-security.test`, password: PASSWORD, role: 'agent',
      departments: [{ departmentId: victim.department._id, role: 'agent' }]
    }
  });
  assert.equal(res.status, 400, `foreign department must be rejected, got ${res.status}`);

  const { rows } = await query('SELECT count(*)::int AS n FROM department_members WHERE department_id = $1', [victim.department._id]);
  assert.equal(rows[0].n, 0, "the victim's department must be untouched");
});

test("a member cannot be assigned another organization's site", async () => {
  const victim = await createTenant('sitevictim');
  const attacker = await createTenant('siteattacker');

  const res = await api('/api/team', {
    method: 'POST', token: attacker.token,
    body: {
      name: 'intruder', email: `${unique('intruder')}@team-security.test`, password: PASSWORD, role: 'agent',
      assignedSites: [victim.site._id]
    }
  });
  assert.equal(res.status, 400, `foreign site must be rejected, got ${res.status}`);
});

// ------------------------------------------- departman üyeleri (ayna açığı)

test("another organization's agent cannot be added to a department", async () => {
  const victim = await createTenant('memvictim');
  const victimAgent = await createMember(victim.token, 'agent');
  const attacker = await createTenant('memattacker');

  const created = await api('/api/departments', {
    method: 'POST', token: attacker.token,
    body: { name: 'trap', siteId: attacker.site._id, members: [{ userId: victimAgent.id, role: 'agent' }] }
  });
  assert.equal(created.status, 400, `foreign member must be rejected, got ${created.status}`);
  assert.equal(JSON.stringify(created.body || {}).includes('@team-security.test'), false, 'the foreign email must not leak');

  const updated = await api(`/api/departments/${attacker.department._id}`, {
    method: 'PUT', token: attacker.token,
    body: { members: [{ userId: victimAgent.id, role: 'agent' }] }
  });
  assert.equal(updated.status, 400, `foreign member must be rejected on update, got ${updated.status}`);

  const { rows } = await query('SELECT count(*)::int AS n FROM team_departments WHERE team_id = $1', [victimAgent.id]);
  assert.equal(rows[0].n, 0, "the victim agent's record must be untouched");
  const { rows: memberRows } = await query('SELECT count(*)::int AS n FROM department_members WHERE user_id = $1', [victimAgent.id]);
  assert.equal(memberRows[0].n, 0, 'no department may list the foreign agent');
});

test("another organization's agent cannot be added through the single-member route", async () => {
  const victim = await createTenant('onevictim');
  const victimAgent = await createMember(victim.token, 'agent');
  const attacker = await createTenant('oneattacker');

  const res = await api(`/api/departments/${attacker.department._id}/members`, {
    method: 'POST', token: attacker.token, body: { userId: victimAgent.id, role: 'agent' }
  });
  assert.equal(res.status, 400, `foreign member must be rejected, got ${res.status}`);
  const { rows } = await query('SELECT count(*)::int AS n FROM team_departments WHERE team_id = $1', [victimAgent.id]);
  assert.equal(rows[0].n, 0);
});

// --------------------------------------------- konuşma atama ve silme yetkisi

async function seedConversation(site: { _id: string; organizationId: string }, assignedAgent: string | null = null) {
  const { generateId } = await import('../src/db/objectId');
  const { default: Conversation } = await import('../src/models/Conversation');
  const id = generateId();
  const ticketNumber = await Conversation.nextTicketNumber();
  await query(
    `INSERT INTO conversations
       (id, ticket_number, ticket_id, site_id, organization_id, visitor_id, visitor_name,
        status, priority, required_skills, unread_count, auto_reassign_attempts,
        sla, channel, current_page, metadata, tags, rating, assigned_agent_id, last_message_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'Visitor', $7, 'normal', '{}', 0, 0,
             '{}'::jsonb, 'web-chat', '/', '{}'::jsonb, '{}', '{}'::jsonb, $8, now(), now(), now())`,
    [id, ticketNumber, `#${String(ticketNumber).padStart(4, '0')}`, site._id, site.organizationId,
      `perm-${id}`, assignedAgent ? 'assigned' : 'open', assignedAgent]
  );
  return id;
}

test('an agent cannot delete a conversation; the owner can', async () => {
  const tenant = await createTenant('delconv');
  const agent = await createMember(tenant.token, 'agent');
  const conversationId = await seedConversation(tenant.site);

  const byAgent = await api(`/api/conversations/${tenant.site._id}/${conversationId}`, { method: 'DELETE', token: agent.token });
  assert.equal(byAgent.status, 403, `agent delete must be refused, got ${byAgent.status}`);
  const { rows } = await query('SELECT count(*)::int AS n FROM conversations WHERE id = $1', [conversationId]);
  assert.equal(rows[0].n, 1, 'the conversation must survive');

  const byOwner = await api(`/api/conversations/${tenant.site._id}/${conversationId}`, { method: 'DELETE', token: tenant.token });
  assert.equal(byOwner.status, 200, JSON.stringify(byOwner.body));
});

test('an agent may take an unassigned conversation or release their own, nothing more', async () => {
  const tenant = await createTenant('assignperm');
  const agent = await createMember(tenant.token, 'agent');
  const colleague = await createMember(tenant.token, 'agent');
  const assign = (id: string, agentId: string | null) =>
    api(`/api/conversations/${id}/assign`, { method: 'PUT', token: agent.token, body: { agentId } });

  const free = await seedConversation(tenant.site);
  assert.equal((await assign(free, colleague.id)).status, 403, 'pushing work onto a colleague');
  assert.equal((await assign(free, agent.id)).status, 200, 'taking an unassigned conversation');
  assert.equal((await assign(free, null)).status, 200, 'releasing their own');

  const theirs = await seedConversation(tenant.site, colleague.id);
  assert.equal((await assign(theirs, agent.id)).status, 403, "taking a colleague's conversation");
  assert.equal((await assign(theirs, null)).status, 403, "releasing a colleague's conversation");

  const byOwner = await api(`/api/conversations/${theirs}/assign`, { method: 'PUT', token: tenant.token, body: { agentId: agent.id } });
  assert.equal(byOwner.status, 200, 'the owner can reassign anything');
});
