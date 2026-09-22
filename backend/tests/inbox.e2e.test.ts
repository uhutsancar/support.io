'use strict';

// Gelen kutusu arama, filtreleme ve sayfalama.
//
// Bu yuzey daha once tarayicida calisiyordu: liste ucu en yeni 50 kaydi
// donduruyor, panel de arama ve filtreleri o 50 kaydin uzerinde uyguluyordu.
// Sonuc, sessizce yanlis olan bir arama kutusuydu: 51. sirada duran bir
// konusmayi aramak "sonuc yok" veriyordu ve kullanicinin kaydin var oldugunu
// anlamasinin hicbir yolu yoktu.
//
// Buradaki testler islerin sunucuda yapildigini sabitler.
//
// Calisan bir backend gerektirir. Calistirma: npm run test:compose

import dotenv from 'dotenv';
import test from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/db/pool';
import { generateId } from '../src/db/objectId';
import Conversation from '../src/models/Conversation';

dotenv.config();

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
  try { json = await res.json(); } catch (e) { /* bos govde */ }
  return { status: res.status, body: json, headers: res.headers };
}

async function createTenant(label: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: `${label} owner`,
      email: `${label}${stamp}@inbox.test`,
      password: 'E2ePassw0rd!',
      companyName: `${label} co`
    }
  });
  assert.ok(reg.status === 200 || reg.status === 201, `register failed: ${JSON.stringify(reg.body)}`);
  const site = await api('/api/sites', {
    method: 'POST',
    token: sessionToken(reg),
    body: { name: `${label} site`, domain: `${label}${stamp}.test` }
  });
  assert.equal(site.status, 201, `site create failed: ${JSON.stringify(site.body)}`);
  return { token: sessionToken(reg), site: site.body.site };
}

/** One synthetic conversation for the inbox list and its counters. */
interface SeedConversationSpec {
  site: any;
  visitorName: string;
  visitorEmail: string;
  status?: string;
  minutesAgo?: number;
}

async function seedConversation({
  site,
  visitorName,
  visitorEmail,
  status = 'open',
  minutesAgo = 1
}: SeedConversationSpec) {
  const id = generateId();
  const ticketNumber = await Conversation.nextTicketNumber();
  const at = new Date(Date.now() - minutesAgo * 60 * 1000);
  await query(
    `INSERT INTO conversations
       (id, ticket_number, ticket_id, site_id, organization_id, visitor_id, visitor_name,
        visitor_email, status, priority, required_skills, unread_count, auto_reassign_attempts,
        sla, channel, current_page, metadata, tags, rating, last_message_at, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'normal', '{}', 0, 0,
             '{}'::jsonb, 'web-chat', '/', '{}'::jsonb, '{}', '{}'::jsonb, $10, $10, $10)`,
    [
      id, ticketNumber, `#${String(ticketNumber).padStart(4, '0')}`,
      site._id, site.organizationId, `inbox-${id}`, visitorName, visitorEmail, status, at
    ]
  );
  return id;
}

async function addMessage(conversationId: string, content: string) {
  await query(
    `INSERT INTO messages (id, conversation_id, sender_type, sender_id, sender_name,
                           content, message_type, is_read, created_at, updated_at)
     VALUES ($1, $2, 'visitor', 'v', 'Visitor', $3, 'text', false, now(), now())`,
    [generateId(), conversationId, content]
  );
}

test('search reaches conversations that are not on the first page', async (t) => {
  const tenant = await createTenant('deep');
  const ids: string[] = [];

  // Aranan kayit en eski olsun: ilk sayfada kesinlikle bulunmaz.
  ids.push(await seedConversation({
    site: tenant.site,
    visitorName: 'Nadire Beyzade',
    visitorEmail: 'nadire@musteri.test',
    minutesAgo: 10000
  }));
  for (let i = 0; i < 40; i++) {
    ids.push(await seedConversation({
      site: tenant.site,
      visitorName: `Gurultu ${i}`,
      visitorEmail: `noise${i}@musteri.test`,
      minutesAgo: i + 1
    }));
  }
  t.after(() => query('DELETE FROM conversations WHERE id = ANY($1)', [ids]));

  const firstPage = await api(`/api/conversations/${tenant.site._id}`, { token: tenant.token });
  assert.equal(firstPage.status, 200);
  assert.ok(
    !firstPage.body.conversations.some((c: any) => c.visitorName === 'Nadire Beyzade'),
    'test kurulumu gecersiz: aranan kayit ilk sayfada'
  );

  const found = await api(
    `/api/conversations/${tenant.site._id}?search=Nadire`,
    { token: tenant.token }
  );
  assert.equal(found.status, 200);
  assert.equal(found.body.conversations.length, 1);
  assert.equal(found.body.conversations[0].visitorName, 'Nadire Beyzade');
});

test('search also looks inside message bodies', async (t) => {
  const tenant = await createTenant('body');
  const target = await seedConversation({
    site: tenant.site,
    visitorName: 'Sessiz Musteri',
    visitorEmail: 'sessiz@musteri.test',
    minutesAgo: 5
  });
  const other = await seedConversation({
    site: tenant.site,
    visitorName: 'Baska Musteri',
    visitorEmail: 'baska@musteri.test',
    minutesAgo: 1
  });
  await addMessage(target, 'Kargom Trabzon deposunda kayboldu');
  await addMessage(other, 'Merhaba, bilgi almak istiyorum');
  t.after(() => query('DELETE FROM conversations WHERE id = ANY($1)', [[target, other]]));

  const res = await api(
    `/api/conversations/${tenant.site._id}?search=Trabzon`,
    { token: tenant.token }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.conversations.length, 1);
  assert.equal(res.body.conversations[0]._id, target);
});

test('a search matching nothing returns nothing rather than the whole inbox', async (t) => {
  const tenant = await createTenant('empty');
  const ids: string[] = [];
  for (let i = 0; i < 5; i++) {
    ids.push(await seedConversation({
      site: tenant.site,
      visitorName: `Musteri ${i}`,
      visitorEmail: `m${i}@musteri.test`,
      minutesAgo: i + 1
    }));
  }
  t.after(() => query('DELETE FROM conversations WHERE id = ANY($1)', [ids]));

  const res = await api(
    `/api/conversations/${tenant.site._id}?search=zzqqxxyy`,
    { token: tenant.token }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.conversations.length, 0);
  assert.equal(res.body.hasMore, false);
});

test('status filtering is applied by the database, not by the page', async (t) => {
  const tenant = await createTenant('status');
  const ids: string[] = [];
  // Cozulmus kayitlar en eski: ilk sayfaya girmezler, yani filtre yalnizca
  // yuklenen sayfaya uygulansaydi bu test bos donerdi.
  for (let i = 0; i < 6; i++) {
    ids.push(await seedConversation({
      site: tenant.site,
      visitorName: `Cozulmus ${i}`,
      visitorEmail: `r${i}@musteri.test`,
      status: 'resolved',
      minutesAgo: 5000 + i
    }));
  }
  for (let i = 0; i < 40; i++) {
    ids.push(await seedConversation({
      site: tenant.site,
      visitorName: `Acik ${i}`,
      visitorEmail: `o${i}@musteri.test`,
      status: 'open',
      minutesAgo: i + 1
    }));
  }
  t.after(() => query('DELETE FROM conversations WHERE id = ANY($1)', [ids]));

  const res = await api(
    `/api/conversations/${tenant.site._id}?status=resolved`,
    { token: tenant.token }
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.conversations.length, 6);
  assert.ok(res.body.conversations.every((c: any) => c.status === 'resolved'));

  // Serit sayilari da tum kayitlari kapsamali, yalnizca sayfayi degil.
  assert.equal(res.body.counts.total, 46);
  assert.equal(res.body.counts.resolved, 6);
  assert.equal(res.body.counts.open, 40);
});

test('the inbox never returns rows from another organization', async (t) => {
  const mine = await createTenant('mine');
  const theirs = await createTenant('theirs');
  const foreign = await seedConversation({
    site: theirs.site,
    visitorName: 'Yabanci Musteri',
    visitorEmail: 'yabanci@musteri.test'
  });
  t.after(() => query('DELETE FROM conversations WHERE id = $1', [foreign]));

  const bySite = await api(`/api/conversations/${theirs.site._id}`, { token: mine.token });
  assert.equal(bySite.status, 404, 'baska bir kiracinin sitesi gorunmemeli');

  const bySearch = await api(
    `/api/conversations/${mine.site._id}?search=Yabanci`,
    { token: mine.token }
  );
  assert.equal(bySearch.status, 200);
  assert.equal(bySearch.body.conversations.length, 0);
});
