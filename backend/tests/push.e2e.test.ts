'use strict';

// Push notifications to the panel (plan v10 PRD-09): only the browsers'
// push services are accepted as endpoints, a subscription belongs to the
// account that saved it, the events follow the desktop-notification choices
// and the site access, nothing is pushed while the panel is open, and a
// subscription the push service has dropped is forgotten.
//
// The running API keeps its pushes in memory (PUSH_TRANSPORT=memory, set in
// docker-compose.yml and CI), so nothing here reaches a real push service.
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import webpush from 'web-push';
import { connect } from 'socket.io-client';
import { generateId } from '../src/db/objectId';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { isPushEndpoint, pushConversationEvent, usePushTransport } from '../src/services/push';
import { call, tenant } from './helpers/idor';
import { BASE, joinAsVisitor, LOCAL_ORIGIN } from './helpers/widget';
import type { Socket } from 'socket.io-client';

const sockets: Socket[] = [];
test.after(async () => {
  for (const socket of sockets) socket.disconnect();
  usePushTransport(null);
  await closeRedisClient();
  await getPool().end();
});

/** A subscription the way a browser's PushManager hands it out. */
function browserSubscription(host = 'fcm.googleapis.com/fcm/send') {
  const ecdh = crypto.createECDH('prime256v1');
  return {
    endpoint: `https://${host}/${crypto.randomBytes(24).toString('base64url')}`,
    keys: {
      p256dh: ecdh.generateKeys().toString('base64url'),
      auth: crypto.randomBytes(16).toString('base64url')
    }
  };
}

const json = (res: { text: string }) => JSON.parse(res.text);

async function pushes(token: string): Promise<any[]> {
  const res = await call(token, '/api/dev/push-outbox');
  assert.equal(res.status, 200, 'the API does not record pushes (PUSH_TRANSPORT=memory?)');
  return json(res).pushes;
}

/** Waits for the outbox to reach `count` entries (the push is not awaited by the socket). */
async function pushCount(token: string, count: number): Promise<any[]> {
  let list: any[] = [];
  for (let i = 0; i < 30; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    list = await pushes(token);
    if (list.length >= count) return list;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return list;
}

test('only the browsers’ push services are accepted', () => {
  for (const good of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QabcDEF',
    'https://wns2-par02p.notify.windows.com/w/?token=abc'
  ]) {
    assert.equal(isPushEndpoint(good), true, good);
  }
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://169.254.169.254/latest/meta-data/',
    'https://localhost/x',
    'https://fcm.googleapis.com.evil.example/x',
    'https://evil.example/fcm.googleapis.com',
    'https://fcm.googleapis.com:8443/x',
    'https://user:pass@fcm.googleapis.com/x',
    'not a url',
    `https://fcm.googleapis.com/${'a'.repeat(1100)}`
  ]) {
    assert.equal(isPushEndpoint(bad), false, bad);
  }
});

test('a subscription: saved for the signed-in account, refused elsewhere, removed by its owner', async () => {
  const a = await tenant('pusha');
  const b = await tenant('pushb');
  const config = json(await call(a.token, '/api/push/config'));
  assert.equal(config.enabled, true, 'the API has no VAPID keys');
  assert.equal(Buffer.from(config.publicKey, 'base64url').length, 65);

  const subscription = browserSubscription();
  const saved = await call(a.token, '/api/push/subscriptions', 'POST', subscription);
  assert.equal(saved.status, 201, saved.text);
  const { rows } = await query(
    'SELECT account_type, account_id, organization_id FROM push_subscriptions WHERE endpoint = $1',
    [subscription.endpoint]
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].organization_id, a.organizationId);

  for (const body of [
    { ...subscription, endpoint: 'https://169.254.169.254/latest/meta-data/' },
    { ...subscription, endpoint: 'http://fcm.googleapis.com/fcm/send/x' },
    { ...subscription, keys: { p256dh: 'short', auth: subscription.keys.auth } },
    { ...subscription, keys: { p256dh: subscription.keys.p256dh, auth: 'x' } },
    { endpoint: subscription.endpoint }
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const res = await call(a.token, '/api/push/subscriptions', 'POST', body);
    assert.equal(res.status, 400, JSON.stringify(body));
  }

  // Another account cannot delete it by knowing the endpoint.
  await call(b.token, '/api/push/subscriptions', 'DELETE', { endpoint: subscription.endpoint });
  assert.equal(
    (await query('SELECT 1 FROM push_subscriptions WHERE endpoint = $1', [subscription.endpoint]))
      .rowCount,
    1
  );
  const removed = await call(a.token, '/api/push/subscriptions', 'DELETE', {
    endpoint: subscription.endpoint
  });
  assert.equal(removed.status, 204);
  assert.equal(
    (await query('SELECT 1 FROM push_subscriptions WHERE endpoint = $1', [subscription.endpoint]))
      .rowCount,
    0
  );
});

test('a new conversation and, when chosen, every message reach a closed panel by push', async () => {
  const t = await tenant('pushflow');
  const saved = await call(t.token, '/api/push/subscriptions', 'POST', browserSubscription());
  assert.equal(saved.status, 201, saved.text);

  const visitor = await joinAsVisitor(t.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const first = await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Merhaba, siparişim gelmedi',
    clientMessageId: `c-${generateId()}`
  });
  assert.equal(first.ok, true, JSON.stringify(first));
  const conversationId = String(first.message.conversationId);

  const afterFirst = await pushCount(t.token, 1);
  assert.equal(
    afterFirst.length,
    1,
    'one push for the new conversation, not a second for its message'
  );
  assert.equal(afterFirst[0].title, 'Yeni konuşma');
  assert.equal(afterFirst[0].url, `/dashboard/conversations?conversation=${conversationId}`);
  assert.equal(afterFirst[0].tag, `conversation-${conversationId}`);

  // Every message is off by default.
  await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Sipariş numaram 12345',
    clientMessageId: `c-${generateId()}`
  });
  await new Promise((resolve) => setTimeout(resolve, 500));
  assert.equal((await pushes(t.token)).length, 1);

  const prefs = await call(t.token, '/api/auth/preferences', 'PUT', {
    desktop: { newConversation: true, assigned: true, allMessages: true }
  });
  assert.equal(prefs.status, 200, prefs.text);
  await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Hâlâ bekliyorum',
    clientMessageId: `c-${generateId()}`
  });
  const afterThird = await pushCount(t.token, 2);
  assert.equal(afterThird.length, 2);
  assert.equal(afterThird[1].body, 'Hâlâ bekliyorum');

  // With the panel open the page notifies; no push.
  const panel = connect(`${BASE}/admin`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token: t.token }
  });
  sockets.push(panel);
  await new Promise<void>((resolve, reject) => {
    panel.once('connect', () => resolve());
    panel.once('connect_error', reject);
  });
  await visitor.socket.timeout(10_000).emitWithAck('send-message', {
    content: 'Panel açıkken',
    clientMessageId: `c-${generateId()}`
  });
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal((await pushes(t.token)).length, 2);
});

test('who receives what, in-process: choices, site access, assignee, dropped subscriptions', async () => {
  const keys = webpush.generateVAPIDKeys();
  const saved = {
    pub: process.env.VAPID_PUBLIC_KEY,
    priv: process.env.VAPID_PRIVATE_KEY,
    transport: process.env.PUSH_TRANSPORT
  };
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  delete process.env.PUSH_TRANSPORT;
  const sent: Array<{ endpoint: string; payload: any }> = [];
  let answer = 201;
  usePushTransport(async (subscription, payload) => {
    if (answer >= 400) throw Object.assign(new Error('push service'), { statusCode: answer });
    sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
    return { statusCode: answer };
  });

  try {
    const t = await tenant('pushrules');
    const ownerId = String(
      (await query('SELECT id FROM users WHERE email = $1', [t.email])).rows[0].id
    );
    const ownerSub = browserSubscription();
    await call(t.token, '/api/push/subscriptions', 'POST', ownerSub);

    // An agent who works on another site of the workspace only.
    const otherSite = generateId();
    await query(
      `INSERT INTO sites (id, name, domain, site_key, organization_id)
       VALUES ($1, 'Diğer', $2, $3, $4)`,
      [otherSite, `other${otherSite}.example`, `key-${otherSite}`, t.organizationId]
    );
    const agentId = generateId();
    await query(
      `INSERT INTO teams (id, email, password, name, role, organization_id)
       VALUES ($1, $2, 'x', 'Ajan', 'agent', $3)`,
      [agentId, `agent${agentId}@push.test`, t.organizationId]
    );
    await query('INSERT INTO team_assigned_sites (team_id, site_id) VALUES ($1, $2)', [
      agentId,
      otherSite
    ]);
    const agentSub = browserSubscription('updates.push.services.mozilla.com/wpush/v2');
    await query(
      `INSERT INTO push_subscriptions (id, account_type, account_id, organization_id, endpoint, p256dh, auth)
       VALUES ($1, 'team', $2, $3, $4, $5, $6)`,
      [
        generateId(),
        agentId,
        t.organizationId,
        agentSub.endpoint,
        agentSub.keys.p256dh,
        agentSub.keys.auth
      ]
    );

    const conversation = {
      _id: generateId(),
      siteId: t.site._id,
      organizationId: t.organizationId,
      visitorName: 'Ayşe'
    };

    assert.equal(await pushConversationEvent('newConversation', conversation), 1);
    assert.equal(sent[0].endpoint, ownerSub.endpoint, 'the agent of another site hears nothing');
    assert.equal(sent[0].payload.title, 'Yeni konuşma');
    assert.equal(sent[0].payload.body, 'Ayşe');

    // The agent's own site: they hear it too.
    assert.equal(
      await pushConversationEvent('newConversation', { ...conversation, siteId: otherSite }),
      2
    );

    // Assigned: the assignee only, and not when they took it themselves.
    sent.length = 0;
    assert.equal(
      await pushConversationEvent('assigned', conversation, { assignee: ownerId, actor: agentId }),
      1
    );
    assert.equal(sent[0].payload.title, 'Size bir konuşma atandı');
    assert.equal(
      await pushConversationEvent('assigned', conversation, { assignee: ownerId, actor: ownerId }),
      0
    );

    // English, for an account that chose it.
    await query(
      `UPDATE users SET preferences = preferences || '{"locale":"en"}'::jsonb WHERE id = $1`,
      [ownerId]
    );
    sent.length = 0;
    await pushConversationEvent('assigned', conversation, { assignee: ownerId, actor: agentId });
    assert.equal(sent[0].payload.title, 'A conversation was assigned to you');

    // Turned off in the settings.
    await query(
      `UPDATE users SET preferences = preferences || '{"desktop":{"newConversation":false,"assigned":true,"allMessages":false}}'::jsonb WHERE id = $1`,
      [ownerId]
    );
    assert.equal(await pushConversationEvent('newConversation', conversation), 0);

    // The push service says the subscription is gone: it is forgotten.
    answer = 410;
    await pushConversationEvent('assigned', conversation, { assignee: ownerId, actor: agentId });
    assert.equal(
      (await query('SELECT 1 FROM push_subscriptions WHERE endpoint = $1', [ownerSub.endpoint]))
        .rowCount,
      0
    );
  } finally {
    usePushTransport(null);
    if (saved.pub === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = saved.pub;
    if (saved.priv === undefined) delete process.env.VAPID_PRIVATE_KEY;
    else process.env.VAPID_PRIVATE_KEY = saved.priv;
    if (saved.transport !== undefined) process.env.PUSH_TRANSPORT = saved.transport;
  }
});
