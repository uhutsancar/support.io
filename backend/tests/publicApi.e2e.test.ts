'use strict';

// The public API (plan v10 PRD-12): keys are made in the panel and shown
// once; a key opens only its own workspace, only within its scopes, only on
// a plan with the API; revoked, it is closed. Every path the OpenAPI
// document lists answers, and what comes back is what the document
// promises — no IP address, no internal note.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { call, conversationOf, tenant } from './helpers/idor';
import { setPlan } from './helpers/accounts';
import { BASE } from './helpers/widget';
import type { Tenant } from './helpers/idor';

test.after(async () => {
  await closeRedisClient();
  await getPool().end();
});

const json = (res: { text: string }) => JSON.parse(res.text);

async function v1(key: string, path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${BASE}/api/v1${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  return { status: res.status, text, body: text ? JSON.parse(text) : null };
}

async function keyFor(t: Tenant, scopes: string[], name = 'Sistem') {
  const res = await call(t.token, '/api/api-keys', 'POST', { name, scopes });
  assert.equal(res.status, 201, res.text);
  return json(res) as { key: { _id: string; prefix: string }; secret: string };
}

test('keys: Enterprise only, shown once, scoped, revocable', async () => {
  const t = await tenant('apikeys');
  // A new workspace is on the Pro trial: no API.
  const refused = await call(t.token, '/api/api-keys', 'POST', { name: 'x', scopes: ['read'] });
  assert.equal(refused.status, 403);
  assert.equal(json(refused).code, 'PLAN_UPGRADE_REQUIRED');

  await setPlan(t.organizationId, 'ENTERPRISE');
  const made = await keyFor(t, ['read']);
  assert.match(made.secret, /^sk_live_[A-Za-z0-9_-]{40}$/);
  assert.ok(made.secret.startsWith(made.key.prefix));
  const listed = await call(t.token, '/api/api-keys');
  assert.ok(!listed.text.includes(made.secret), 'the key is never shown again');
  const { rows } = await query('SELECT key_hash FROM api_keys WHERE id = $1', [made.key._id]);
  assert.notEqual(rows[0].key_hash, made.secret, 'only its hash is kept');

  assert.equal((await v1(made.secret, '/sites')).status, 200);
  assert.equal((await v1('sk_live_' + 'x'.repeat(40), '/sites')).status, 401);
  assert.equal((await v1('', '/sites')).status, 401);
  const conversation = await conversationOf(t);
  const write = await v1(made.secret, `/conversations/${conversation}/messages`, 'POST', {
    content: 'Merhaba'
  });
  assert.equal(write.status, 403);
  assert.equal(write.body.code, 'INSUFFICIENT_SCOPE');

  assert.equal((await call(t.token, `/api/api-keys/${made.key._id}`, 'DELETE')).status, 204);
  assert.equal((await v1(made.secret, '/sites')).status, 401, 'revoked');

  // Back on Pro, an existing key stops working.
  const again = await keyFor(t, ['read']);
  await setPlan(t.organizationId, 'PRO');
  const pro = await v1(again.secret, '/sites');
  assert.equal(pro.status, 403);
  assert.equal(pro.body.code, 'PLAN_UPGRADE_REQUIRED');
});

test('reading and writing through the API, as the document describes', async () => {
  const t = await tenant('apiflow');
  await setPlan(t.organizationId, 'ENTERPRISE');
  const { secret } = await keyFor(t, ['read', 'write']);
  const conversation = await conversationOf(t, 'Kargom nerede?');
  await query(
    `INSERT INTO conversation_internal_notes (id, conversation_id, user_id, note, created_at)
     VALUES ($1, $2, NULL, 'gizli not', now())`,
    [generateId(), conversation]
  );
  await query(
    `INSERT INTO visitors (id, site_id, organization_id, visitor_id, ip, country)
     VALUES ($1, $2, $3, 'v_api', '203.0.113.9', 'TR')`,
    [generateId(), t.site._id, t.organizationId]
  );

  const sites = await v1(secret, '/sites');
  assert.deepEqual(
    sites.body.data.map((s: { id: string }) => s.id),
    [t.site._id]
  );
  const list = await v1(secret, `/conversations?siteId=${t.site._id}&limit=10`);
  assert.equal(list.status, 200, list.text);
  assert.equal(list.body.data[0].id, conversation);
  const single = await v1(secret, `/conversations/${conversation}`);
  assert.equal(single.body.data.status, 'open');

  const messages = await v1(secret, `/conversations/${conversation}/messages`);
  assert.equal(messages.body.data.length, 1);
  assert.equal(messages.body.data[0].content, 'Kargom nerede?');
  assert.ok(!messages.text.includes('gizli not'), 'internal notes stay internal');

  const reply = await v1(secret, `/conversations/${conversation}/messages`, 'POST', {
    content: 'Kargonuz yolda.',
    senderName: 'Sipariş sistemi'
  });
  assert.equal(reply.status, 201, reply.text);
  assert.equal(reply.body.data.senderType, 'agent');
  assert.equal(reply.body.data.senderName, 'Sipariş sistemi');
  const { rows } = await query('SELECT first_response_at FROM conversations WHERE id = $1', [
    conversation
  ]);
  assert.ok(rows[0].first_response_at, 'the reply counts as the first response');

  const tagged = await v1(secret, `/conversations/${conversation}`, 'PATCH', {
    tags: ['kargo'],
    status: 'resolved'
  });
  assert.equal(tagged.status, 200, tagged.text);
  assert.equal(tagged.body.data.status, 'resolved');
  assert.deepEqual(tagged.body.data.tags, ['kargo']);
  const late = await v1(secret, `/conversations/${conversation}/messages`, 'POST', {
    content: 'Bir şey daha'
  });
  assert.equal(late.status, 409);

  const visitors = await v1(secret, `/visitors?siteId=${t.site._id}`);
  assert.equal(visitors.body.data[0].id, 'v_api');
  assert.ok(!visitors.text.includes('203.0.113.9'), 'no IP address');

  const faq = await v1(secret, '/faqs', 'POST', {
    siteId: t.site._id,
    question: 'Kargo kaç gün sürer?',
    answer: '2 iş günü.'
  });
  assert.equal(faq.status, 201, faq.text);
  const changed = await v1(secret, `/faqs/${faq.body.data.id}`, 'PATCH', {
    answer: '1-2 iş günü.'
  });
  assert.equal(changed.body.data.answer, '1-2 iş günü.');
  assert.equal((await v1(secret, `/faqs?siteId=${t.site._id}`)).body.data.length, 1);
  assert.equal((await v1(secret, `/faqs/${faq.body.data.id}`, 'DELETE')).status, 204);

  for (const bad of [
    ['POST', `/conversations/${conversation}/messages`, { content: '' }],
    ['PATCH', `/conversations/${conversation}`, { status: 'deleted' }],
    ['POST', '/faqs', { siteId: t.site._id, question: '' }],
    ['GET', '/conversations?status=lost']
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    const res = await v1(secret, bad[1], bad[0], bad[2]);
    assert.equal(res.status, 400, `${bad[0]} ${bad[1]}`);
  }
});

test("a key never opens another workspace's data", async () => {
  const a = await tenant('apia');
  const b = await tenant('apib');
  await setPlan(a.organizationId, 'ENTERPRISE');
  const { secret } = await keyFor(a, ['read', 'write']);
  const theirs = await conversationOf(b, 'secret of this tenant');
  const { rows } = await query(
    `INSERT INTO faqs (id, site_id, question, answer) VALUES ($1, $2, 'secret of this tenant', 'x')
     RETURNING id`,
    [generateId(), b.site._id]
  );
  for (const [method, path, body] of [
    ['GET', `/conversations/${theirs}`],
    ['GET', `/conversations/${theirs}/messages`],
    ['PATCH', `/conversations/${theirs}`, { status: 'closed' }],
    ['POST', `/conversations/${theirs}/messages`, { content: 'x' }],
    ['GET', `/conversations?siteId=${b.site._id}`],
    ['GET', `/visitors?siteId=${b.site._id}`],
    ['GET', `/faqs?siteId=${b.site._id}`],
    ['POST', '/faqs', { siteId: b.site._id, question: 'x', answer: 'y' }],
    ['PATCH', `/faqs/${rows[0].id}`, { answer: 'pwned' }],
    ['DELETE', `/faqs/${rows[0].id}`]
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    const res = await v1(secret, path, method, body);
    assert.equal(res.status, 404, `${method} ${path}`);
    assert.ok(!res.text.includes('secret of this tenant'));
  }
  const all = await v1(secret, '/conversations');
  assert.ok(!all.text.includes(theirs), 'the list is the workspace’s own');
  const { rows: still } = await query('SELECT status FROM conversations WHERE id = $1', [theirs]);
  assert.equal(still[0].status, 'open');
});

test('the OpenAPI document is valid 3.1 and every path it lists answers', async () => {
  const doc = (await (await fetch(`${BASE}/api/v1/openapi.json`)).json()) as {
    openapi: string;
    servers: Array<{ url: string }>;
    paths: Record<string, Record<string, unknown>>;
  };
  assert.equal(doc.openapi, '3.1.0');
  assert.match(doc.servers[0].url, /\/api\/v1$/);
  const t = await tenant('apidoc');
  await setPlan(t.organizationId, 'ENTERPRISE');
  const { secret } = await keyFor(t, ['read']);
  const conversation = await conversationOf(t);
  for (const [path, item] of Object.entries<Record<string, unknown>>(doc.paths)) {
    if (!item.get) continue;
    const concrete =
      path.replace('{id}', conversation) +
      (/visitors|faqs/.test(path) ? `?siteId=${t.site._id}` : '');
    // eslint-disable-next-line no-await-in-loop
    const res = await v1(secret, concrete);
    assert.equal(res.status, 200, `GET ${concrete}: ${res.text.slice(0, 120)}`);
  }
});
