'use strict';

// The widget's identity, end to end.
//
// Before v4 a visitor was whoever the page said it was: the widget sent the
// site key and a visitor id it generated itself, and the server believed
// both. These tests pin what replaced that:
//
//  - The server mints the visitor id and signs it, with the site, into a
//    widget session (POST /api/widget/session). Nothing a payload says can
//    change either.
//  - A session is issued only to a page on one of the site's allowed origins,
//    and every later widget request and socket is checked against the same list.
//  - Admin sessions, upload proofs and widget sessions are signed with
//    different derived keys and never pass for one another.
//  - Regenerating a site key ends every session issued under the old one.
//
// Needs the running API. Run: npm test

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { derivedKey, newWidgetSessionId, siteKeyVersion } from '../src/config/tokens';
import { getPool } from '../src/db/pool';
import {
  BASE,
  LOCAL_ORIGIN,
  connected,
  joinAsVisitor,
  widgetSession,
  widgetSocket,
  widgetToken
} from './helpers/widget';
import { verifyEmail } from './helpers/accounts';

const SHOP = 'https://shop.example.com';

interface ApiResponse {
  status: number;
  body: any;
  headers: Headers;
}

function sessionCookie(res: { headers: Headers }): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : '';
}

async function api(
  path: string,
  {
    method = 'GET',
    token,
    body,
    headers = {}
  }: { method?: string; token?: string; body?: unknown; headers?: Record<string, string> } = {}
): Promise<ApiResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
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

async function createTenant(label: string, allowedOrigins?: string[]) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 100000)}`;
  const email = `${label}${stamp}@widget-session.test`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: { name: `${label} owner`, email, password: 'E2ePassw0rd!' }
  });
  assert.ok(reg.status === 201, `register failed: ${JSON.stringify(reg.body)}`);
  await verifyEmail(email);
  const token = sessionCookie(reg);
  const site = await api('/api/sites', {
    method: 'POST',
    token,
    body: {
      name: `${label} site`,
      domain: `${label}${stamp}.example`,
      ...(allowedOrigins ? { allowedOrigins } : {})
    }
  });
  assert.equal(site.status, 201, `site create failed: ${JSON.stringify(site.body)}`);
  return { token, site: site.body.site };
}

/** A widget token signed exactly like the server's, with chosen claims. */
function craftToken(
  claims: Record<string, unknown>,
  { expiresInSeconds = 3600, key = 'widget-session' } = {}
): string {
  return jwt.sign({ purpose: 'widget', ...claims }, derivedKey(key), {
    algorithm: 'HS256',
    audience: 'support-chat:widget',
    expiresIn: expiresInSeconds
  });
}

function refusal(socket: ReturnType<typeof widgetSocket>): Promise<string> {
  return connected(socket).then(
    () => {
      socket.disconnect();
      return 'connected';
    },
    (error: Error) => error.message
  );
}

// ------------------------------------------------------------------ origins

test('a site starts with its domain and the www. twin as allowed origins', async () => {
  const tenant = await createTenant('derive');
  const domain = tenant.site.domain as string;
  assert.deepEqual(tenant.site.allowedOrigins, [`https://${domain}`, `https://www.${domain}`]);
});

test('a session is issued only to a page on an allowed origin', async () => {
  const tenant = await createTenant('origin', [SHOP]);

  const allowed = await widgetSession(tenant.site.siteKey, { origin: SHOP });
  assert.equal(allowed.status, 200, JSON.stringify(allowed.body));

  const elsewhere = await widgetSession(tenant.site.siteKey, { origin: 'https://evil.example' });
  assert.equal(elsewhere.status, 403);
  assert.equal(elsewhere.body.code, 'ORIGIN_NOT_ALLOWED');

  // A browser always sends Origin on this POST; without one there is no page.
  const nowhere = await widgetSession(tenant.site.siteKey, { origin: null });
  assert.equal(nowhere.status, 403);

  // Sandboxed iframes and file:// pages send the literal "null".
  const sandboxed = await widgetSession(tenant.site.siteKey, { origin: 'null' });
  assert.equal(sandboxed.status, 403);
});

test('a session used from a page off the list is refused', async () => {
  const tenant = await createTenant('reuse', [SHOP]);
  const { token } = await widgetToken(tenant.site.siteKey, { origin: SHOP });

  const fromShop = await api('/api/widget/installed', {
    method: 'POST',
    token,
    headers: { Origin: SHOP },
    body: { url: `${SHOP}/` }
  });
  assert.equal(fromShop.status, 200, JSON.stringify(fromShop.body));

  const fromElsewhere = await api('/api/widget/installed', {
    method: 'POST',
    token,
    headers: { Origin: 'https://evil.example' },
    body: { url: 'https://evil.example/' }
  });
  assert.equal(fromElsewhere.status, 403);
  assert.equal(fromElsewhere.body.code, 'ORIGIN_NOT_ALLOWED');

  const socket = widgetSocket(token, { origin: 'https://evil.example' });
  assert.equal(await refusal(socket), 'WIDGET_SESSION_INVALID');
  const good = widgetSocket(token, { origin: SHOP });
  assert.equal(await refusal(good), 'connected');
});

test('allowed origins are validated: no paths, no wildcards', async () => {
  const tenant = await createTenant('validate');
  for (const bad of [
    ['https://shop.example.com/checkout'],
    ['*'],
    ['https://*.example.com'],
    ['ftp://x.example']
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api(`/api/sites/${tenant.site._id}`, {
      method: 'PUT',
      token: tenant.token,
      body: { allowedOrigins: bad }
    });
    assert.equal(res.status, 400, `${bad[0]} was accepted`);
  }
  const ok = await api(`/api/sites/${tenant.site._id}`, {
    method: 'PUT',
    token: tenant.token,
    body: {
      allowedOrigins: ['HTTPS://Shop.Example.com:443/', 'shop.example.com', 'http://localhost:8080']
    }
  });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.deepEqual(ok.body.site.allowedOrigins, [SHOP, 'http://localhost:8080']);
});

// ----------------------------------------------------------------- identity

test('the server mints the visitor id and a renewal keeps it', async () => {
  const tenant = await createTenant('renew');
  const first = await widgetToken(tenant.site.siteKey);
  assert.match(first.visitorId, /^v_[0-9a-f]{32}$/);

  const renewed = await widgetToken(tenant.site.siteKey, { token: first.token });
  assert.equal(renewed.visitorId, first.visitorId, 'a renewal changed the visitor');

  const stranger = await widgetToken(tenant.site.siteKey);
  assert.notEqual(stranger.visitorId, first.visitorId);
});

test('a session from another site, or a forged one, starts a new visitor', async () => {
  const a = await createTenant('sitea');
  const b = await createTenant('siteb');
  const onA = await widgetToken(a.site.siteKey);

  const carried = await widgetToken(b.site.siteKey, { token: onA.token });
  assert.notEqual(carried.visitorId, onA.visitorId, "site A's visitor continued on site B");

  // Same claims, wrong key: an admin-session-keyed signature is not a widget session.
  const forged = craftToken(
    {
      siteId: a.site._id,
      visitorId: onA.visitorId,
      sid: newWidgetSessionId(),
      kv: siteKeyVersion(a.site.siteKey)
    },
    { key: 'session' }
  );
  const fromForged = await widgetToken(a.site.siteKey, { token: forged });
  assert.notEqual(fromForged.visitorId, onA.visitorId, 'a forged token continued a visitor');
});

test("a visitor cannot open another visitor's conversation, whatever the payload says", async (t) => {
  const tenant = await createTenant('idor');

  const owner = await joinAsVisitor(tenant.site.siteKey);
  t.after(() => owner.socket.disconnect());
  const echoed: any = await new Promise((resolve) => {
    owner.socket.on('new-message', (data: any) => {
      if (data?.message?.senderType === 'visitor') resolve(data.message);
    });
    owner.socket.emit('send-message', { content: 'Siparişim nerede?', clientMessageId: 'c-own-1' });
  });
  const conversationId = String(echoed.conversationId);

  // The attacker sends the owner's visitor id and site key in the join
  // payload, the way the pre-v4 protocol let them.
  const attacker = await joinAsVisitor(tenant.site.siteKey, {
    siteKey: tenant.site.siteKey,
    visitorId: owner.visitorId
  });
  t.after(() => attacker.socket.disconnect());
  assert.equal(attacker.joined.conversation, null, "the attacker joined the owner's conversation");
  assert.deepEqual(attacker.joined.messages, []);

  // And naming the conversation id directly gets nothing either.
  const leaked: any[] = [];
  attacker.socket.on('new-message', (data: any) => leaked.push(data));
  attacker.socket.emit('send-message', {
    conversationId,
    content: 'hello?',
    clientMessageId: 'c-attacker-1'
  });
  await new Promise((resolve) => setTimeout(resolve, 600));
  assert.ok(
    leaked.every((d) => String(d?.message?.conversationId) !== conversationId),
    "the attacker's message landed in the owner's conversation"
  );

  // The real owner, returning with their token, resumes it.
  const back = await joinAsVisitor(tenant.site.siteKey, {}, { token: owner.token });
  t.after(() => back.socket.disconnect());
  assert.equal(String(back.joined.conversation?._id), conversationId);
  assert.ok(back.joined.messages.some((m: any) => m.content === 'Siparişim nerede?'));
});

// ------------------------------------------------------------------- tokens

test('the widget socket refuses anything but a valid widget session', async () => {
  const tenant = await createTenant('sock');
  const valid = await widgetToken(tenant.site.siteKey);
  const claims = {
    siteId: tenant.site._id,
    visitorId: valid.visitorId,
    sid: newWidgetSessionId(),
    kv: siteKeyVersion(tenant.site.siteKey)
  };

  assert.equal(await refusal(widgetSocket(undefined)), 'WIDGET_SESSION_INVALID', 'no token');
  assert.equal(await refusal(widgetSocket('not-a-jwt')), 'WIDGET_SESSION_INVALID', 'garbage');
  assert.equal(
    await refusal(widgetSocket(tenant.token)),
    'WIDGET_SESSION_INVALID',
    'an admin session passed as a widget session'
  );
  assert.equal(
    await refusal(widgetSocket(craftToken(claims, { expiresInSeconds: -60 }))),
    'WIDGET_SESSION_INVALID',
    'an expired session'
  );
  assert.equal(
    await refusal(widgetSocket(craftToken({ ...claims, purpose: 'admin' }))),
    'WIDGET_SESSION_INVALID',
    'a wrong purpose'
  );
  assert.equal(await refusal(widgetSocket(valid.token)), 'connected', 'a valid session');
});

test('a widget session is not an admin session, and the reverse', async () => {
  const tenant = await createTenant('cross');
  const { token } = await widgetToken(tenant.site.siteKey);

  const me = await api('/api/auth/me', { token });
  assert.equal(me.status, 401, 'a widget session authenticated as an account');

  const asWidget = await api('/api/widget/installed', {
    method: 'POST',
    token: tenant.token,
    body: { url: `${LOCAL_ORIGIN}/` }
  });
  assert.equal(asWidget.status, 401, 'an admin session authenticated a widget call');
});

test('an expired session is refused for use but may be renewed for a while', async () => {
  const tenant = await createTenant('expiry');
  const valid = await widgetToken(tenant.site.siteKey);
  const claims = {
    siteId: tenant.site._id,
    visitorId: valid.visitorId,
    sid: newWidgetSessionId(),
    kv: siteKeyVersion(tenant.site.siteKey)
  };

  const expired = craftToken(claims, { expiresInSeconds: -3600 });
  const use = await api('/api/widget/installed', {
    method: 'POST',
    token: expired,
    body: { url: `${LOCAL_ORIGIN}/` }
  });
  assert.equal(use.status, 401);
  assert.equal(use.body.code, 'WIDGET_SESSION_INVALID');

  const renewed = await widgetToken(tenant.site.siteKey, { token: expired });
  assert.equal(renewed.visitorId, valid.visitorId, 'a recently expired session lost its visitor');

  const ancient = craftToken(claims, { expiresInSeconds: -60 * 24 * 60 * 60 });
  const restarted = await widgetToken(tenant.site.siteKey, { token: ancient });
  assert.notEqual(restarted.visitorId, valid.visitorId, 'a long-dead session was renewed');
});

test('regenerating the site key ends every session issued under the old one', async () => {
  const tenant = await createTenant('rekey');
  const before = await widgetToken(tenant.site.siteKey);

  const rekeyed = await api(`/api/sites/${tenant.site._id}/regenerate-key`, {
    method: 'POST',
    token: tenant.token
  });
  assert.equal(rekeyed.status, 200);
  const newKey = rekeyed.body.site.siteKey;
  assert.notEqual(newKey, tenant.site.siteKey);

  assert.equal(await refusal(widgetSocket(before.token)), 'WIDGET_SESSION_INVALID');
  const use = await api('/api/widget/installed', {
    method: 'POST',
    token: before.token,
    body: { url: `${LOCAL_ORIGIN}/` }
  });
  assert.equal(use.status, 401);

  const oldKey = await widgetSession(tenant.site.siteKey);
  assert.equal(oldKey.status, 404, 'the old key still issues sessions');

  const fresh = await widgetToken(newKey, { token: before.token });
  assert.notEqual(fresh.visitorId, before.visitorId, 'a pre-rekey session was continued');
});

// ------------------------------------------------------------ public surface

test('every widget endpoint wants a widget session', async () => {
  const tenant = await createTenant('surface');
  const checks: Array<[string, string, unknown]> = [
    ['POST', '/api/widget/installed', { url: `${LOCAL_ORIGIN}/` }],
    ['POST', '/api/events/track', { events: [{ type: 'page_view' }] }],
    ['GET', `/api/faqs/search?siteKey=${tenant.site.siteKey}&query=iade`, undefined],
    ['GET', '/api/widget-config/public', undefined]
  ];
  for (const [method, path, body] of checks) {
    // eslint-disable-next-line no-await-in-loop
    const res = await api(path, { method, body });
    assert.equal(res.status, 401, `${method} ${path} answered without a session`);
  }

  const upload = await fetch(`${BASE}/api/files/upload`, {
    method: 'POST',
    headers: { 'X-Site-Key': tenant.site.siteKey },
    body: new FormData()
  });
  assert.equal(upload.status, 401, 'an upload was accepted on the site key alone');

  const { token } = await widgetToken(tenant.site.siteKey);
  const tracked = await api('/api/events/track', {
    method: 'POST',
    token,
    // A body naming another visitor is ignored; the session's visitor counts.
    body: { visitorId: 'v_someone_else', siteKey: 'other', events: [{ type: 'page_view' }] }
  });
  assert.equal(tracked.status, 200, JSON.stringify(tracked.body));

  const config = await api('/api/widget-config/public', { token });
  assert.equal(config.status, 200);
  assert.ok(config.body.config.colors);
});

test("an agent upload is limited to the agent's own sites", async () => {
  const a = await createTenant('upa');
  const b = await createTenant('upb');
  const form = new FormData();
  form.append('file', new Blob(['hello'], { type: 'text/plain' }), 'note.txt');

  // Refused before the body is read, so nothing is stored.
  const foreign = await fetch(`${BASE}/api/files/agent-upload?siteId=${b.site._id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.token}` },
    body: form
  });
  assert.equal(foreign.status, 404, "another organization's site accepted an upload");

  // Its own site gets past authorization and reaches storage. Sent without a
  // file, so the suite never writes to the configured bucket.
  const own = await fetch(`${BASE}/api/files/agent-upload?siteId=${a.site._id}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${a.token}` },
    body: new FormData()
  });
  assert.equal(own.status, 400, await own.text());
});

test.after(async () => {
  await getPool().end();
});
