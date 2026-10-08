'use strict';

// Tenant isolation of the routes added by plan v10 (TST-03), with the
// template in tests/helpers/idor.ts: workspace A's owner puts workspace B's
// ids into every new route that takes one, and is refused without learning
// anything; B's rows stay as they were.
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { assertRefused, call, conversationOf, twoTenants } from './helpers/idor';

test.after(async () => {
  await getPool().end();
});

test("the plan v10 routes refuse another workspace's ids", async () => {
  const { a, b } = await twoTenants();
  const conv = await conversationOf(b);
  const { rows: messages } = await query<{ id: string }>(
    'SELECT id FROM messages WHERE conversation_id = $1',
    [conv]
  );

  const reply = await call(b.token, '/api/saved-replies', 'POST', {
    shortcut: 'gizli',
    title: 'secret of this tenant',
    body: 'secret of this tenant'
  });
  assert.equal(reply.status, 201, reply.text);
  const savedReply = JSON.parse(reply.text).reply?._id ?? JSON.parse(reply.text).savedReply?._id;
  assert.ok(savedReply, reply.text);

  const block = generateId();
  await query(
    `INSERT INTO visitor_blocks (id, organization_id, site_id, visitor_id, reason, expires_at)
     VALUES ($1, $2, $3, $4, 'secret of this tenant', now() + interval '1 day')`,
    [block, b.organizationId, b.site._id, `v_${generateId()}`]
  );

  await assertRefused(a, [
    // Conversations and their messages
    ['GET', `/api/conversations/${b.site._id}/${conv}/messages`],
    ['GET', `/api/conversations/${a.site._id}/${conv}/messages`],
    // Chat settings (PRD-01, PRD-04, PRD-05)
    ['GET', `/api/sites/${b.site._id}/chat-settings`],
    ['PUT', `/api/sites/${b.site._id}/chat-settings`, { offlineForm: false }],
    // Saved replies (PRD-03)
    ['PUT', `/api/saved-replies/${savedReply}`, { title: 'pwned' }],
    ['DELETE', `/api/saved-replies/${savedReply}`],
    ['POST', `/api/saved-replies/${savedReply}/use`],
    ['POST', '/api/saved-replies', { siteId: b.site._id, shortcut: 'x', title: 'x', body: 'x' }],
    // Visitor blocks and erasure (SEC-09, SEC-17)
    ['POST', '/api/visitors/block', { conversationId: conv, days: 1 }],
    ['GET', `/api/visitors/blocks/${b.site._id}`],
    ['DELETE', `/api/visitors/blocks/${block}`],
    ['POST', '/api/visitors/erase', { conversationId: conv }],
    // Assistant feedback (AI)
    ['POST', '/api/assistant/feedback', { messageId: messages[0].id, verdict: 'wrong' }],
    ['DELETE', `/api/assistant/feedback/${messages[0].id}`]
  ]);

  // Nothing of B's moved.
  const still = await query(
    `SELECT (SELECT count(*) FROM conversations WHERE id = $1)::int AS conversations,
            (SELECT count(*) FROM visitor_blocks WHERE id = $2)::int AS blocks,
            (SELECT title FROM saved_replies WHERE id = $3) AS title,
            (SELECT chat_settings::text FROM sites WHERE id = $4) AS settings`,
    [conv, block, savedReply, b.site._id]
  );
  assert.equal(still.rows[0].conversations, 1);
  assert.equal(still.rows[0].blocks, 1);
  assert.equal(still.rows[0].title, 'secret of this tenant');
  assert.doesNotMatch(String(still.rows[0].settings), /"offlineForm":false/);
});

test("a workspace's own billing pages show only its own sites and members", async () => {
  const { a, b } = await twoTenants();
  const overage = await call(a.token, '/api/billing/overage');
  assert.equal(overage.status, 200, overage.text);
  assert.ok(!overage.text.includes(b.site._id), "A's overage listing contains B's site");
  const choice = await call(a.token, '/api/billing/overage', 'POST', { keepSiteIds: [b.site._id] });
  assert.equal(choice.status, 400);
});
