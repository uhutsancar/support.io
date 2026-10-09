'use strict';

// Caching and query counts (plan v10 PERF-04):
//
//  - the widget session keeps the site's look and FAQ list in the shared
//    cache, yet an owner's change shows on the next page view at once
//  - the inbox list costs the same number of queries for 3 conversations as
//    for 15: assigned agents, departments and last messages are loaded in
//    batches, not one by one (no N+1)
//
// The first part uses the running API; the second runs the conversations
// route in this process and counts what it sends to PostgreSQL.
//
// Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { AddressInfo } from 'node:net';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { generateId } from '../src/db/objectId';
import { signSession } from '../src/config/tokens';
import conversationRoutes from '../src/routes/conversations';
import { errorHandler } from '../src/http';
import { BASE, widgetSession } from './helpers/widget';
import { signUp } from './helpers/accounts';

test.after(async () => {
  await closeRedisClient();
  await getPool().end();
});

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

async function owner() {
  const email = `owner${stamp()}@cache.test`;
  const reg = await signUp({ name: 'Cache Owner', email, password: 'E2ePassw0rd!' });
  const token = decodeURIComponent(
    /(?:^|,\s*)sc_session=([^;]+)/.exec(reg.headers.get('set-cookie') || '')?.[1] || ''
  );
  const res = await fetch(`${BASE}/api/sites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: `Önbellek ${stamp()}`, domain: `c${stamp()}.example` })
  });
  const { site } = (await res.json()) as { site: { _id: string; siteKey: string } };
  const { rows } = await query<{ id: string; organization_id: string; session_version: number }>(
    'SELECT id, organization_id, session_version FROM users WHERE email = $1',
    [email]
  );
  return { token, site, user: rows[0] };
}

const call = (token: string, path: string, method: string, body: unknown) =>
  fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });

test("an owner's FAQ and look changes reach the widget at once", async () => {
  const { token, site } = await owner();
  const before = await widgetSession(site.siteKey);
  assert.equal(before.status, 200);
  assert.deepEqual(before.body.faqs, []);
  // Read again: now from the cache.
  assert.deepEqual((await widgetSession(site.siteKey)).body.faqs, []);

  const added = await call(token, '/api/faqs/admin', 'POST', {
    siteId: site._id,
    question: 'Kargo ne kadar sürer?',
    answer: '1-3 iş günü.'
  });
  assert.equal(added.status, 201);
  const after = await widgetSession(site.siteKey);
  assert.deepEqual(
    after.body.faqs.map((f: { question: string }) => f.question),
    ['Kargo ne kadar sürer?']
  );

  const restyled = await call(token, `/api/widget-config/site/${site._id}`, 'PUT', {
    messages: { welcomeMessage: `Hoş geldiniz ${stamp()}` }
  });
  assert.equal(restyled.status, 200, await restyled.clone().text());
  const welcome = ((await restyled.json()) as any).config.messages.welcomeMessage;
  const styled = await widgetSession(site.siteKey);
  assert.equal(styled.body.config.messages.welcomeMessage, welcome);
});

test('the inbox list costs the same queries for 3 conversations as for 15', async () => {
  const { site, user } = await owner();
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/conversations', conversationRoutes);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const session = signSession(
    {
      userId: user.id,
      userType: 'user',
      role: 'owner',
      organizationId: user.organization_id,
      sv: user.session_version
    },
    600
  );

  async function addConversations(n: number) {
    for (let i = 0; i < n; i += 1) {
      const id = generateId();
      await query(
        `INSERT INTO conversations (id, site_id, organization_id, visitor_id, visitor_name, status,
                                    last_message_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'Ziyaretçi', 'open', now(), now(), now())`,
        [id, site._id, user.organization_id, `v_${generateId()}`]
      );
      await query(
        `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, content)
         VALUES ($1, $2, 'visitor', 'v', 'Ziyaretçi', 'Merhaba')`,
        [generateId(), id]
      );
    }
  }

  // Count what the route sends to PostgreSQL.
  const pool = getPool() as unknown as { query: (...args: unknown[]) => unknown };
  const original = pool.query.bind(pool);
  let count = 0;
  pool.query = (...args: unknown[]) => {
    count += 1;
    return original(...args);
  };
  const listQueries = async () => {
    count = 0;
    const res = await fetch(`${url}/api/conversations/${site._id}?limit=50`, {
      headers: { Authorization: `Bearer ${session}` }
    });
    assert.equal(res.status, 200, await res.clone().text());
    const body = (await res.json()) as { conversations: unknown[] };
    return { queries: count, rows: body.conversations.length };
  };

  try {
    await addConversations(3);
    // The tab counts are shared for a few seconds (db/inboxQueries.ts): warm
    // them first, so both measurements see the same cache.
    await listQueries();
    const small = await listQueries();
    assert.equal(small.rows, 3);
    await addConversations(12);
    const large = await listQueries();
    assert.equal(large.rows, 15);
    assert.equal(large.queries, small.queries, `${small.queries} vs ${large.queries} queries`);
  } finally {
    pool.query = original;
    server.close();
  }
});
