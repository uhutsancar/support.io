'use strict';

// How long conversations are kept, and erasing a visitor (plan v10 SEC-17):
//
//  - each plan's window: Free 90 days with no choice, Pro 30–365, Enterprise
//    30–1830; the choice is audited
//  - the nightly purge deletes conversations past the window with their
//    messages and stored attachments, keeps younger ones, and audits counts
//    only
//  - "delete this visitor's data" removes every conversation they had on the
//    site, their attachments, visitor record and page events — and nobody
//    else's; another workspace cannot ask for it
//  - deleting one conversation by hand removes its attachment too
//
// The purge runs in this process with a clock moved forward; its files live
// on the same disk as the stack's (UPLOAD_STORAGE=local, set by test:compose).
//
// Needs the running API. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { purgeExpiredConversations } from '../src/services/dataRetention';
import { UPLOAD_ROOT, storedKeyFromUrl } from '../src/middleware/upload';
import { BASE, joinAsVisitor, LOCAL_ORIGIN } from './helpers/widget';
import { setPlan, signUp } from './helpers/accounts';
import type { Socket } from 'socket.io-client';

const sockets: Socket[] = [];

test.before(() => {
  // Deleting files here must never reach a real bucket.
  assert.equal(process.env.UPLOAD_STORAGE, 'local', 'run with npm run test:compose');
});

test.after(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await closeRedisClient();
  await getPool().end();
});

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

function sessionCookie(res: { headers: Headers }): string {
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

async function api(
  pathname: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}
) {
  const res = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* empty */
  }
  return { status: res.status, body: json };
}

async function tenant() {
  const email = `owner${stamp()}@retention.test`;
  const reg = await signUp({ name: 'Retention Owner', email, password: 'E2ePassw0rd!' });
  const token = sessionCookie(reg);
  const site = await api('/api/sites', {
    method: 'POST',
    token,
    body: { name: `Shop ${stamp()}`, domain: `r${stamp()}.example` }
  });
  assert.equal(site.status, 201);
  return { token, site: site.body.site, org: String(site.body.site.organizationId) };
}

const ack = (socket: Socket, event: string, payload: unknown): Promise<any> =>
  socket.timeout(10_000).emitWithAck(event, payload);

/** A visitor who writes once and, when asked, sends a picture too. */
async function visitorWrites(siteKey: string, text: string, withPicture = false) {
  const visitor = await joinAsVisitor(siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const first = await ack(visitor.socket, 'send-message', {
    content: text,
    clientMessageId: `c-${stamp()}`
  });
  assert.equal(first.ok, true, JSON.stringify(first));
  let fileKey: string | null = null;
  if (withPicture) {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 120, b: 200 } }
    })
      .png()
      .toBuffer();
    const form = new FormData();
    form.append('file', new Blob([png], { type: 'image/png' }), 'fatura.png');
    const res = await fetch(`${BASE}/api/files/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${visitor.token}`, Origin: LOCAL_ORIGIN },
      body: form
    });
    assert.equal(res.status, 200, await res.clone().text());
    const { file } = (await res.json()) as { file: Record<string, unknown> };
    const sent = await ack(visitor.socket, 'send-message', {
      content: 'fatura.png',
      messageType: 'image',
      fileData: file,
      clientMessageId: `c-${stamp()}`
    });
    assert.equal(sent.ok, true, JSON.stringify(sent));
    fileKey = storedKeyFromUrl(file.url);
    assert.ok(fileKey && fs.existsSync(path.join(UPLOAD_ROOT, fileKey)), 'the file is on disk');
  }
  return { ...visitor, conversationId: String(first.message.conversationId), fileKey };
}

async function age(conversationId: string, days: number) {
  await query(
    `UPDATE conversations SET last_message_at = now() - make_interval(days => $2),
            created_at = now() - make_interval(days => $2)
      WHERE id = $1`,
    [conversationId, days]
  );
}

const exists = async (conversationId: string) =>
  (await query('SELECT 1 FROM conversations WHERE id = $1', [conversationId])).rows.length > 0;

async function auditRows(organizationId: string, action: string): Promise<any[]> {
  for (let i = 0; i < 20; i += 1) {
    const { rows } = await query(
      'SELECT metadata FROM audit_logs WHERE organization_id = $1 AND action = $2',
      [organizationId, action]
    );
    if (rows.length) return rows;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

test('each plan has its retention window, and a change is audited', async () => {
  const shop = await tenant();

  await setPlan(shop.org, 'FREE');
  const free = await api('/api/data-retention', { token: shop.token });
  assert.equal(free.status, 200);
  assert.deepEqual(
    { days: free.body.days, fixed: free.body.fixed, plan: free.body.plan },
    { days: 90, fixed: true, plan: 'FREE' }
  );
  const longer = await api('/api/data-retention', {
    method: 'PUT',
    token: shop.token,
    body: { days: 365 }
  });
  assert.equal(longer.status, 400);
  assert.equal(longer.body.code, 'RETENTION_OUT_OF_RANGE');

  await setPlan(shop.org, 'PRO');
  const pro = await api('/api/data-retention', { token: shop.token });
  assert.deepEqual(
    { days: pro.body.days, min: pro.body.minDays, max: pro.body.maxDays, fixed: pro.body.fixed },
    { days: 365, min: 30, max: 365, fixed: false }
  );
  const month = await api('/api/data-retention', {
    method: 'PUT',
    token: shop.token,
    body: { days: 30 }
  });
  assert.equal(month.status, 200);
  assert.equal(month.body.days, 30);
  const tooLong = await api('/api/data-retention', {
    method: 'PUT',
    token: shop.token,
    body: { days: 366 }
  });
  assert.equal(tooLong.body.code, 'RETENTION_OUT_OF_RANGE');
  const odd = await api('/api/data-retention', {
    method: 'PUT',
    token: shop.token,
    body: { days: 'forever' }
  });
  assert.equal(odd.status, 400);

  await setPlan(shop.org, 'ENTERPRISE');
  const five = await api('/api/data-retention', {
    method: 'PUT',
    token: shop.token,
    body: { days: 1830 }
  });
  assert.equal(five.body.days, 1830);
  assert.equal(
    (
      await api('/api/data-retention', {
        method: 'PUT',
        token: shop.token,
        body: { days: 1831 }
      })
    ).body.code,
    'RETENTION_OUT_OF_RANGE'
  );
  const reset = await api('/api/data-retention', {
    method: 'PUT',
    token: shop.token,
    body: { days: null }
  });
  assert.equal(reset.body.days, 365);

  // A stored choice outside a smaller plan's window counts as that plan's edge.
  await setPlan(shop.org, 'FREE');
  await query('UPDATE organizations SET retention_days = 1000 WHERE id = $1', [shop.org]);
  assert.equal((await api('/api/data-retention', { token: shop.token })).body.days, 90);

  const audited = await auditRows(shop.org, 'RETENTION_SETTINGS_UPDATED');
  assert.ok(audited.length >= 3);
  assert.deepEqual(audited.map((r) => r.metadata.to).includes(30), true);
});

test('the nightly purge removes what is past the window, attachments included', async () => {
  const shop = await tenant();
  await setPlan(shop.org, 'FREE');
  const old = await visitorWrites(shop.site.siteKey, 'Eski konuşma', true);
  const fresh = await visitorWrites(shop.site.siteKey, 'Yeni konuşma');
  const edge = await visitorWrites(shop.site.siteKey, 'Sınırdaki konuşma');
  await age(old.conversationId, 91);
  await age(edge.conversationId, 89);

  const removed = await purgeExpiredConversations({ organizationId: shop.org });
  assert.equal(removed.conversations, 1);
  assert.equal(removed.files, 1);
  assert.equal(await exists(old.conversationId), false);
  assert.equal(
    (await query('SELECT 1 FROM messages WHERE conversation_id = $1', [old.conversationId])).rows
      .length,
    0
  );
  assert.equal(fs.existsSync(path.join(UPLOAD_ROOT, old.fileKey!)), false, 'the file is gone');
  assert.equal(await exists(fresh.conversationId), true);
  assert.equal(await exists(edge.conversationId), true);

  // Audited with numbers, nothing else.
  const [row] = await auditRows(shop.org, 'RETENTION_PURGE');
  assert.deepEqual(row.metadata, { days: 90, conversations: 1, messages: 2, files: 1 });

  // Pro with a 30-day window: the same 89-day-old conversation is now due.
  await setPlan(shop.org, 'PRO');
  await api('/api/data-retention', { method: 'PUT', token: shop.token, body: { days: 30 } });
  const later = await purgeExpiredConversations({ organizationId: shop.org });
  assert.equal(later.conversations, 1);
  assert.equal(await exists(edge.conversationId), false);
  assert.equal(await exists(fresh.conversationId), true);
});

test("a visitor's data is erased from the site on request, and only theirs", async () => {
  const shop = await tenant();
  const asked = await visitorWrites(shop.site.siteKey, 'Verilerimi silin', true);
  // A second, older conversation of the same visitor, and a page event.
  const { rows: copied } = await query<{ id: string }>(
    `INSERT INTO conversations (id, site_id, organization_id, visitor_id, visitor_name, status,
                                last_message_at, created_at, updated_at)
     SELECT substr(md5(random()::text), 1, 24), site_id, organization_id, visitor_id,
            visitor_name, 'resolved', now() - interval '20 days', now() - interval '20 days', now()
       FROM conversations WHERE id = $1
     RETURNING id`,
    [asked.conversationId]
  );
  await query(
    `INSERT INTO event_logs (id, site_id, visitor_id, event_type, url)
     VALUES (substr(md5(random()::text), 1, 24), $1, $2, 'page_view', 'https://shop.example/x')`,
    [shop.site._id, asked.visitorId]
  );
  const bystander = await visitorWrites(shop.site.siteKey, 'Ben kalıyorum');

  const other = await tenant();
  const foreign = await api('/api/visitors/erase', {
    method: 'POST',
    token: other.token,
    body: { conversationId: asked.conversationId }
  });
  assert.equal(foreign.status, 404);

  const erased = await api('/api/visitors/erase', {
    method: 'POST',
    token: shop.token,
    body: { conversationId: asked.conversationId }
  });
  assert.equal(erased.status, 200, JSON.stringify(erased.body));
  assert.deepEqual(erased.body, { conversations: 2, messages: 2, files: 1, events: 1 });

  assert.equal(await exists(asked.conversationId), false);
  assert.equal(await exists(copied[0].id), false);
  assert.equal(fs.existsSync(path.join(UPLOAD_ROOT, asked.fileKey!)), false);
  const left = async (table: string) =>
    (
      await query(`SELECT 1 FROM ${table} WHERE site_id = $1 AND visitor_id = $2`, [
        shop.site._id,
        asked.visitorId
      ])
    ).rows.length;
  assert.equal(await left('visitors'), 0);
  assert.equal(await left('event_logs'), 0);
  assert.equal(await exists(bystander.conversationId), true);

  const [row] = await auditRows(String(shop.org), 'VISITOR_DATA_DELETED');
  assert.equal(row.metadata.conversations, 2);
  assert.equal(JSON.stringify(row.metadata).includes('Verilerimi'), false);
});

test('deleting one conversation by hand removes its attachment too', async () => {
  const shop = await tenant();
  const chat = await visitorWrites(shop.site.siteKey, `Silinecek ${crypto.randomUUID()}`, true);
  const deleted = await api(`/api/conversations/${shop.site._id}/${chat.conversationId}`, {
    method: 'DELETE',
    token: shop.token
  });
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body));
  assert.equal(await exists(chat.conversationId), false);
  assert.equal(fs.existsSync(path.join(UPLOAD_ROOT, chat.fileKey!)), false);
});
