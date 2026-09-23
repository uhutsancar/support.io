'use strict';

// Cover for the AI copilot endpoints.
//
// These tests never call a real model. They exercise the layers that must hold
// regardless of vendor: tenant isolation on every task, the advisory contract
// (a suggestion is returned, never sent to the visitor), input validation, and
// the disabled-provider path that must refuse rather than invent an answer.
//
// Requires a running backend. Run with: npm test

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db/pool';
import { generateId } from '../src/db/objectId';
import Conversation from '../src/models/Conversation';
import { getPool } from '../src/db/pool';


const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

/** How one request to the running API is made. */
interface ApiOptions {
  method?: string;
  token?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * A decoded response. `body` is deliberately loose: these suites assert
 * against live JSON, so every field is checked at the assertion rather than
 * mirrored in a type that would have to be kept in step with the API.
 */
interface ApiResponse {
  status: number;
  body: any;
  headers: Headers;
}

/**
 * Oturum token'ini yanitin Set-Cookie basligindan cikarir.
 *
 * Token artik yanit govdesinde donmuyor: panelin onu saklayabilecegi bir yer
 * kalmasin diye yalnizca httpOnly cereze yaziliyor. Testler tarayici olmadigi
 * icin cerezi kendileri okuyup Authorization basligiyla gonderiyor; o yol
 * tarayici disi istemciler icin bilerek aciktir.
 */
function sessionToken(res: { headers: Headers }): string {
  const raw = res.headers.get('set-cookie') || '';
  const match = /(?:^|,s*)sc_session=([^;]+)/.exec(raw);
  return match ? decodeURIComponent(match[1]) : '';
}

async function api(
  path: string,
  { method = 'GET', token, body }: ApiOptions = {}
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
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, body: json, headers: res.headers };
}

async function createTenant(label: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: `${label} owner`,
      email: `${label}${stamp}@ai.test`,
      password: 'E2ePassw0rd!',
      companyName: `${label} co`
    }
  });
  assert.ok(reg.status === 200 || reg.status === 201, `register failed: ${JSON.stringify(reg)}`);

  const site = await api('/api/sites', {
    method: 'POST',
    token: sessionToken(reg),
    body: { name: `${label} site`, domain: `${label}${stamp}.test` }
  });
  assert.equal(site.status, 201);

  const user = reg.body.user;
  return { token: sessionToken(reg), userId: user._id || user.id, site: site.body.site };
}

// A conversation with a short transcript, written directly so the tests do not
// depend on the widget socket.
async function seedConversation(
  site: any,
  { withMessages = true }: { withMessages?: boolean } = {}
) {
  const id = generateId();
  const ticketNumber = await Conversation.nextTicketNumber();
  await query(
    `INSERT INTO conversations
       (id, ticket_number, ticket_id, site_id, organization_id, visitor_id, visitor_name,
        status, priority, sla, rating, channel, current_page, metadata, tags,
        last_message_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, 'AI Visitor',
             'open', 'normal', '{}'::jsonb, '{}'::jsonb, 'web-chat', '/', '{}'::jsonb, '{}',
             now(), now(), now())`,
    [
      id,
      ticketNumber,
      `#${String(ticketNumber).padStart(4, '0')}`,
      site._id,
      site.organizationId,
      `ai-${id}`
    ]
  );

  if (withMessages) {
    for (const [senderType, senderName, content] of [
      ['visitor', 'AI Visitor', 'Siparişim bir haftadır gelmedi, iade istiyorum.'],
      ['agent', 'Temsilci', 'Kontrol ediyorum, kısa sürede dönüş yapacağım.']
    ]) {
      await query(
        `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name, content,
                               message_type, is_read, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, 'text', true, now(), now())`,
        [generateId(), id, senderType, `${senderType}-1`, senderName, content]
      );
    }
  }
  return id;
}

const TASKS = [
  { path: 'summary', body: {} },
  { path: 'suggest-reply', body: {} },
  { path: 'analyze', body: {} },
  { path: 'rewrite', body: { draft: 'merhaba' } },
  { path: 'translate', body: { text: 'merhaba', targetLanguage: 'English' } },
  { path: 'knowledge-answer', body: { question: 'İade süresi nedir?' } }
];

test('AI status reports whether a provider is actually configured', async () => {
  const tenant = await createTenant('status');
  const res = await api('/api/ai/status', { token: tenant.token });

  assert.equal(res.status, 200);
  assert.equal(typeof res.body.enabled, 'boolean');
  assert.ok(typeof res.body.provider === 'string' && res.body.provider.length > 0);

  // The flag has to match reality, otherwise the panel shows buttons that fail.
  // No model backend is wired in, so nothing may report itself usable.
  assert.equal(res.body.enabled, false);
});

test('every AI task refuses a conversation from another organization', async (t) => {
  const owner = await createTenant('owner');
  const intruder = await createTenant('intruder');
  const conversationId = await seedConversation(owner.site);

  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = $1', [conversationId]);
  });

  for (const task of TASKS) {
    const res = await api(`/api/ai/conversations/${conversationId}/${task.path}`, {
      method: 'POST',
      token: intruder.token,
      body: task.body
    });
    assert.equal(res.status, 404, `${task.path} leaked across tenants (got ${res.status})`);
  }
});

test('AI tasks require authentication', async () => {
  const tenant = await createTenant('anon');
  const conversationId = await seedConversation(tenant.site);

  const res = await api(`/api/ai/conversations/${conversationId}/summary`, { method: 'POST' });
  assert.equal(res.status, 401);

  await query('DELETE FROM conversations WHERE id = $1', [conversationId]);
});

test('a malformed conversation id is rejected, not looked up', async () => {
  const tenant = await createTenant('badid');
  const res = await api('/api/ai/conversations/not-an-id/summary', {
    method: 'POST',
    token: tenant.token
  });
  assert.equal(res.status, 404);
});

test('input validation runs before any model call', async (t) => {
  const tenant = await createTenant('validate');
  const conversationId = await seedConversation(tenant.site);
  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = $1', [conversationId]);
  });

  // An empty draft / text / question is caught locally and answered 400,
  // whether or not a provider is configured.
  const empty = [
    { path: 'rewrite', body: { draft: '   ' } },
    { path: 'translate', body: { text: '', targetLanguage: 'English' } },
    { path: 'translate', body: { text: 'merhaba' } },
    { path: 'knowledge-answer', body: { question: '' } }
  ];

  for (const c of empty) {
    const res = await api(`/api/ai/conversations/${conversationId}/${c.path}`, {
      method: 'POST',
      token: tenant.token,
      body: c.body
    });
    assert.equal(res.status, 400, `${c.path} accepted an empty input: ${JSON.stringify(res.body)}`);
  }
});

test('a conversation with no messages is refused rather than summarized', async (t) => {
  const tenant = await createTenant('empty');
  const conversationId = await seedConversation(tenant.site, { withMessages: false });
  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = $1', [conversationId]);
  });

  const res = await api(`/api/ai/conversations/${conversationId}/summary`, {
    method: 'POST',
    token: tenant.token
  });

  // 400 when the transcript is empty, 503 when no provider is configured at
  // all; either way it must not answer 200 with an invented summary.
  assert.ok([400, 503].includes(res.status), `unexpected status ${res.status}`);
  assert.notEqual(res.status, 200, 'an empty conversation must never produce a summary');
});

test('with no provider configured the API refuses instead of fabricating', async (t) => {
  const tenant = await createTenant('disabled');
  const conversationId = await seedConversation(tenant.site);
  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = $1', [conversationId]);
  });

  const res = await api(`/api/ai/conversations/${conversationId}/summary`, {
    method: 'POST',
    token: tenant.token
  });

  assert.equal(res.status, 503);
  assert.equal(res.body.code, 'ai_not_configured');
  assert.ok(!res.body.summary, 'a disabled provider must not return content');
});

test('an AI suggestion is never delivered to the visitor', async (t) => {
  const tenant = await createTenant('advisory');
  const conversationId = await seedConversation(tenant.site);
  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = $1', [conversationId]);
  });

  const before = await query('SELECT count(*)::int AS c FROM messages WHERE conversation_id = $1', [
    conversationId
  ]);

  await api(`/api/ai/conversations/${conversationId}/suggest-reply`, {
    method: 'POST',
    token: tenant.token,
    body: {}
  });

  const after = await query('SELECT count(*)::int AS c FROM messages WHERE conversation_id = $1', [
    conversationId
  ]);

  // Whether the call succeeded or was refused for lack of a key, asking for a
  // suggestion must not append anything to the transcript.
  assert.equal(
    after.rows[0].c,
    before.rows[0].c,
    'suggest-reply wrote a message into the conversation'
  );

  // Nor may it change the conversation itself.
  const conv = await query('SELECT status, tags, priority FROM conversations WHERE id = $1', [
    conversationId
  ]);
  assert.equal(conv.rows[0].status, 'open');
  assert.equal(conv.rows[0].priority, 'normal');
  assert.deepEqual(conv.rows[0].tags, []);
});

test('analyze does not apply its own suggestions', async (t) => {
  const tenant = await createTenant('analyze');
  const conversationId = await seedConversation(tenant.site);
  t.after(async () => {
    await query('DELETE FROM conversations WHERE id = $1', [conversationId]);
  });

  await api(`/api/ai/conversations/${conversationId}/analyze`, {
    method: 'POST',
    token: tenant.token,
    body: {}
  });

  // A suggested priority or tag is a recommendation for the agent, not an edit.
  const conv = await query('SELECT priority, tags FROM conversations WHERE id = $1', [
    conversationId
  ]);
  assert.equal(conv.rows[0].priority, 'normal');
  assert.deepEqual(conv.rows[0].tags, []);
});

test.after(async () => {
  await getPool().end();
});
