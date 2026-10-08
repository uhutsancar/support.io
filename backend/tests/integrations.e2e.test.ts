'use strict';

// Slack, Telegram and outgoing webhooks (plan v10 PRD-11): only safe https
// addresses are accepted, keys never come back from the API, the four
// conversation events reach every kind in the right form, webhooks are
// signed, failed tries are retried for a day and then given up, and the
// payload — visitor data — does not outlive the delivery.
//
// The running API keeps its calls in memory (INTEGRATION_TRANSPORT=memory,
// docker-compose.yml and CI): nothing here reaches Slack, Telegram or a
// real address. Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import {
  dispatchIntegrationEvent,
  runIntegrationDeliveries,
  sealConfig,
  useIntegrationPoster
} from '../src/services/integrations';
import { call, conversationOf, tenant } from './helpers/idor';
import { joinAsVisitor, LOCAL_ORIGIN } from './helpers/widget';
import type { Socket } from 'socket.io-client';

const sockets: Socket[] = [];
test.after(async () => {
  for (const socket of sockets) socket.disconnect();
  useIntegrationPoster(null);
  await closeRedisClient();
  await getPool().end();
});

const json = (res: { text: string }) => JSON.parse(res.text);
const ALL = ['conversation.created', 'message.created', 'conversation.closed', 'rating.created'];
const SLACK = 'https://hooks.slack.com/services/T0000000/B0000000/XXXXXXXXXXXXXXXXXXXXXXXX';
const BOT = `123456789:${'A'.repeat(35)}`;

async function outbox(token: string): Promise<any[]> {
  const res = await call(token, '/api/dev/integration-outbox');
  assert.equal(res.status, 200, 'the API does not record calls (INTEGRATION_TRANSPORT=memory?)');
  return json(res).calls;
}

async function calls(token: string, count: number): Promise<any[]> {
  let list: any[] = [];
  for (let i = 0; i < 40; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    list = await outbox(token);
    if (list.length >= count) return list;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return list;
}

test('only safe https addresses and well-formed keys are accepted', async () => {
  const t = await tenant('intsafe');
  for (const body of [
    { kind: 'webhook', name: 'x', events: ALL, url: 'http://1.1.1.1/hook' },
    { kind: 'webhook', name: 'x', events: ALL, url: 'https://localhost/hook' },
    { kind: 'webhook', name: 'x', events: ALL, url: 'https://169.254.169.254/latest' },
    { kind: 'webhook', name: 'x', events: ALL, url: 'https://10.0.0.5/hook' },
    { kind: 'webhook', name: 'x', events: ALL, url: 'https://[::ffff:7f00:1]/hook' },
    { kind: 'webhook', name: 'x', events: ALL, url: 'https://1.1.1.1:8443/hook' },
    { kind: 'slack', name: 'x', events: ALL, url: 'https://evil.example/services/T/B/X' },
    { kind: 'telegram', name: 'x', events: ALL, botToken: 'not-a-token', chatId: '-100123' },
    { kind: 'telegram', name: 'x', events: ALL, botToken: BOT, chatId: 'drop table' },
    { kind: 'webhook', name: 'x', events: ['everything'], url: 'https://1.1.1.1/hook' },
    { kind: 'ftp', name: 'x', events: ALL, url: 'https://1.1.1.1/hook' }
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const res = await call(t.token, '/api/integrations', 'POST', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }
});

test('the four events reach a webhook (signed), Slack and Telegram; keys never come back', async () => {
  const t = await tenant('intflow');
  const hook = await call(t.token, '/api/integrations', 'POST', {
    kind: 'webhook',
    name: 'CRM',
    events: ALL,
    url: 'https://1.1.1.1/support-hook'
  });
  assert.equal(hook.status, 201, hook.text);
  const secret: string = json(hook).signingSecret;
  assert.match(secret, /^whsec_/);
  const slack = await call(t.token, '/api/integrations', 'POST', {
    kind: 'slack',
    name: 'Destek kanalı',
    events: ['conversation.created', 'conversation.closed'],
    url: SLACK
  });
  assert.equal(slack.status, 201, slack.text);
  const telegram = await call(t.token, '/api/integrations', 'POST', {
    kind: 'telegram',
    name: 'Telefon',
    events: ['rating.created'],
    botToken: BOT,
    chatId: '-100123456',
    language: 'en'
  });
  assert.equal(telegram.status, 201, telegram.text);

  const listed = await call(t.token, '/api/integrations');
  assert.equal(listed.status, 200);
  for (const leak of [secret, BOT, 'XXXXXXXXXXXXXXXXXXXXXXXX', 'support-hook']) {
    assert.ok(!listed.text.includes(leak), `the list shows ${leak}`);
  }

  // A visitor writes twice, the team closes it, the visitor rates it.
  const visitor = await joinAsVisitor(t.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const first = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Merhaba, kargom nerede?',
    clientMessageId: `c-${generateId()}`
  });
  assert.equal(first.ok, true, JSON.stringify(first));
  const conversationId = String(first.message.conversationId);
  await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Sipariş 1234',
    clientMessageId: `c-${generateId()}`
  });
  const closed = await call(t.token, `/api/conversations/${conversationId}/status`, 'PUT', {
    status: 'resolved'
  });
  assert.equal(closed.status, 200, closed.text);
  const rated = await visitor.socket
    .timeout(10_000)
    .emitWithAck('rate-conversation', { conversationId, score: 5, feedback: 'Çok hızlı' });
  assert.equal(rated.ok, true, JSON.stringify(rated));

  // webhook: 4 events; Slack: created + closed; Telegram: the rating.
  const all = await calls(t.token, 7);
  assert.equal(all.length, 7, JSON.stringify(all.map((c) => c.url)));
  const webhook = all.filter((c) => c.url === 'https://1.1.1.1/support-hook');
  assert.deepEqual(
    webhook.map((c) => c.headers['X-SupportIO-Event']),
    ['conversation.created', 'message.created', 'conversation.closed', 'rating.created']
  );
  for (const delivery of webhook) {
    const [, at, mac] = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(
      delivery.headers['X-SupportIO-Signature']
    )!;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${at}.${delivery.body}`)
      .digest('hex');
    assert.equal(mac, expected, 'the signature checks out with the secret shown once');
  }
  const created = JSON.parse(webhook[0].body);
  assert.equal(created.event, 'conversation.created');
  assert.equal(created.data.conversation.id, conversationId);
  assert.equal(created.data.message.content, 'Merhaba, kargom nerede?');
  assert.equal(created.data.organizationId, undefined, 'nothing internal');
  assert.equal(JSON.parse(webhook[3].body).data.rating.score, 5);

  const toSlack = all.filter((c) => c.url === SLACK).map((c) => JSON.parse(c.body).text);
  assert.equal(toSlack.length, 2);
  assert.match(toSlack[0], /^Yeni konuşma/);
  assert.match(toSlack[0], /Merhaba, kargom nerede\?/);
  assert.match(toSlack[1], /^Konuşma kapandı/);

  const toTelegram = all.filter((c) => c.url.startsWith('https://api.telegram.org/'));
  assert.equal(toTelegram.length, 1);
  assert.ok(!toTelegram[0].url.includes(BOT), 'the token is not kept in the log');
  assert.equal(JSON.parse(toTelegram[0].body).chat_id, '-100123456');
  assert.match(JSON.parse(toTelegram[0].body).text, /^New rating: 5\/5/);

  // The log: delivered, with the status, and no payload left behind.
  const log = await call(t.token, `/api/integrations/${json(hook).integration._id}/deliveries`);
  assert.equal(json(log).deliveries.length, 4);
  assert.ok(
    json(log).deliveries.every((d: any) => d.status === 'delivered' && d.statusCode === 200)
  );
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM integration_deliveries
      WHERE organization_id = $1 AND payload IS NOT NULL`,
    [t.organizationId]
  );
  assert.equal(rows[0].n, 0);

  // A test message, and a new signing secret.
  const tested = await call(
    t.token,
    `/api/integrations/${json(slack).integration._id}/test`,
    'POST'
  );
  assert.equal(json(tested).delivered, true);
  const rotated = await call(
    t.token,
    `/api/integrations/${json(hook).integration._id}/secret`,
    'POST'
  );
  assert.match(json(rotated).signingSecret, /^whsec_/);
  assert.notEqual(json(rotated).signingSecret, secret);
});

test('a failing receiver is retried for a day, then given up; a private address is never called', async () => {
  const t = await tenant('intretry');
  const id = generateId();
  await query(
    `INSERT INTO integrations (id, organization_id, kind, name, events, config, hint)
     VALUES ($1, $2, 'webhook', 'Down', $3, $4, 'x')`,
    [id, t.organizationId, ALL, sealConfig({ url: 'https://1.1.1.1/down', secret: 'whsec_x' })]
  );
  const privateId = generateId();
  await query(
    `INSERT INTO integrations (id, organization_id, kind, name, events, config, hint)
     VALUES ($1, $2, 'webhook', 'Inside', $3, $4, 'x')`,
    [
      privateId,
      t.organizationId,
      ALL,
      sealConfig({ url: 'https://127.0.0.1/admin', secret: 'whsec_x' })
    ]
  );
  const seen: string[] = [];
  useIntegrationPoster(async (target) => {
    seen.push(target.url.href);
    return { status: 503 };
  });
  const conversation = await conversationOf(t);
  await dispatchIntegrationEvent('conversation.closed', {
    organizationId: t.organizationId,
    site: { id: t.site._id, name: 'Mağaza' },
    conversation: { id: conversation }
  });
  assert.deepEqual(
    seen,
    ['https://1.1.1.1/down'],
    'the private address is refused before any call'
  );

  const state = async (integration: string) =>
    (
      await query(
        `SELECT status, attempts, payload IS NOT NULL AS has_payload, last_error, last_status_code
           FROM integration_deliveries WHERE integration_id = $1`,
        [integration]
      )
    ).rows[0];
  assert.deepEqual(
    { ...(await state(id)), last_error: undefined },
    {
      status: 'pending',
      attempts: 1,
      has_payload: true,
      last_error: undefined,
      last_status_code: 503
    }
  );
  assert.equal((await state(privateId)).status, 'pending');
  assert.match((await state(privateId)).last_error, /private network/);

  // The next try, when it is due.
  await query(
    `UPDATE integration_deliveries SET next_attempt_at = now() WHERE organization_id = $1`,
    [t.organizationId]
  );
  await runIntegrationDeliveries();
  assert.equal((await state(id)).attempts, 2);

  // A day later it is given up, and the payload goes.
  await query(
    `UPDATE integration_deliveries
        SET next_attempt_at = now(), created_at = now() - interval '25 hours'
      WHERE organization_id = $1`,
    [t.organizationId]
  );
  await runIntegrationDeliveries();
  assert.equal((await state(id)).status, 'failed');
  assert.equal((await state(id)).has_payload, false);
  useIntegrationPoster(null);
});

test('integrations are part of the paid plans; another workspace’s cannot be touched', async () => {
  const a = await tenant('intplan');
  const b = await tenant('intother');
  const made = await call(b.token, '/api/integrations', 'POST', {
    kind: 'slack',
    name: 'B',
    events: ALL,
    url: SLACK
  });
  assert.equal(made.status, 201, made.text);
  const theirs = json(made).integration._id;
  for (const [method, path, body] of [
    ['PUT', `/api/integrations/${theirs}`, { name: 'pwned' }],
    ['DELETE', `/api/integrations/${theirs}`],
    ['POST', `/api/integrations/${theirs}/test`],
    ['GET', `/api/integrations/${theirs}/deliveries`]
  ] as const) {
    // eslint-disable-next-line no-await-in-loop
    const res = await call(a.token, path, method, body);
    assert.equal(res.status, 404, `${method} ${path}`);
  }

  // The trial over and no plan bought: Free.
  await query(`UPDATE organizations SET trial_ends_at = now() - interval '1 day' WHERE id = $1`, [
    a.organizationId
  ]);
  const free = await call(a.token, '/api/integrations');
  assert.equal(free.status, 403);
  assert.equal(json(free).code, 'PLAN_UPGRADE_REQUIRED');
});
