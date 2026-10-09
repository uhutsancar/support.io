// The template for the tenant-isolation test every new route needs (plan v10
// TST-03): two workspaces, and a list of calls that put workspace B's ids in
// front of workspace A's session. Each must be refused (4xx) without saying
// anything about B's data, and B's rows must be as they were.
//
//   const { a, b } = await twoTenants();
//   const conv = await conversationOf(b);
//   await assertRefused(a, [
//     ['GET', `/api/conversations/${b.site._id}/${conv}/messages`],
//     ['PUT', `/api/sites/${b.site._id}/chat-settings`, { offlineForm: false }]
//   ]);
//
// tests/tenantIsolation.e2e.test.ts covers the routes that existed before;
// tests/idorNewRoutes.e2e.test.ts shows the template in use.

import assert from 'node:assert/strict';
import { generateId } from '../../src/db/objectId';
import { query } from '../../src/db/pool';
import { BASE } from './widget';
import { signUp } from './accounts';

export interface Tenant {
  token: string;
  email: string;
  organizationId: string;
  site: { _id: string; siteKey: string };
}

export type Attempt = [method: string, path: string, body?: unknown];

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

export async function call(
  token: string,
  path: string,
  method = 'GET',
  body?: unknown
): Promise<{ status: number; text: string }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  return { status: res.status, text: await res.text() };
}

/** One workspace with an owner and a site, signed in. */
export async function tenant(label: string): Promise<Tenant> {
  const email = `${label}${stamp()}@idor.test`;
  const reg = await signUp({ name: `${label} owner`, email, password: 'E2ePassw0rd!' });
  assert.equal(reg.status, 201);
  const token = decodeURIComponent(
    /(?:^|,\s*)sc_session=([^;]+)/.exec(reg.headers.get('set-cookie') || '')?.[1] || ''
  );
  const created = await call(token, '/api/sites', 'POST', {
    name: `${label} site`,
    domain: `${label}${stamp()}.example`
  });
  assert.equal(created.status, 201, created.text);
  return {
    token,
    email,
    organizationId: String(reg.body.user.organizationId),
    site: JSON.parse(created.text).site
  };
}

export async function twoTenants(): Promise<{ a: Tenant; b: Tenant }> {
  return { a: await tenant('a'), b: await tenant('b') };
}

/** A conversation with one visitor message on the tenant's site, written directly. */
export async function conversationOf(
  t: Tenant,
  content = 'secret of this tenant'
): Promise<string> {
  const id = generateId();
  const visitorId = `v_${generateId()}`;
  await query(
    `INSERT INTO conversations (id, site_id, organization_id, visitor_id, visitor_name, status,
                                last_message_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'Ziyaretçi', 'open', now(), now(), now())`,
    [id, t.site._id, t.organizationId, visitorId]
  );
  await query(
    `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, content,
                           message_type, created_at, updated_at)
     VALUES ($1, $2, 'visitor', $4, 'Ziyaretçi', $3, 'text', now(), now())`,
    [generateId(), id, content, visitorId]
  );
  return id;
}

/**
 * Every attempt, made with `as`'s session, is refused with a 4xx and its
 * answer does not contain `secret` (what B's rows say).
 */
export async function assertRefused(
  as: Tenant,
  attempts: Attempt[],
  secret = 'secret of this tenant'
): Promise<void> {
  for (const [method, path, body] of attempts) {
    // eslint-disable-next-line no-await-in-loop
    const res = await call(as.token, path, method, body);
    assert.ok(res.status >= 400 && res.status < 500, `${method} ${path} answered ${res.status}`);
    assert.ok(!res.text.includes(secret), `${method} ${path} leaked the other tenant's data`);
  }
}
