'use strict';

// Universal widget SDK'sinin sunucu yuzeyi.
//
// Bu testler asagidakileri sabitler:
//
//  - /widget.js gercekten servis ediliyor, dogru MIME ve CORS ile; surumlenmis
//    yol degismez (immutable) olarak onbelleklenebiliyor.
//  - /api/widget/bootstrap widget'in ihtiyaci olan HER SEYI tek yanitta
//    donduruyor ve HICBIR ic alan sizdirmiyor (organizationId, siteId, _id).
//  - Gecersiz anahtar ile pasif site ayni yaniti aliyor (anahtar denemesiyle
//    varlik cikarimi yapilamasin diye).
//  - Kurulum dogrulamasi calisiyor ve URL'nin sorgu dizesini SAKLAMIYOR.
//  - Ekip sohbeti uye listesi kiraci sinirini gecmiyor (bu, panelde ayni
//    ismin defalarca gorunmesine yol acan gercek bir veri sizintisiydi).
//
// Calisan bir backend gerektirir. Calistirma: npm test

import dotenv from 'dotenv';
import test from 'node:test';
import assert from 'node:assert/strict';

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
  { method = 'GET', token, body, headers = {} }: ApiOptions = {}
): Promise<ApiResponse> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* boş gövde */ }
  return { status: res.status, body: json, headers: res.headers };
}

async function createTenant(label: string) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const reg = await api('/api/auth/register', {
    method: 'POST',
    body: {
      name: `${label} owner`,
      email: `${label}${stamp}@widget.test`,
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

  const user = reg.body.user;
  return {
    token: sessionToken(reg),
    userId: user._id || user.id,
    email: user.email,
    site: site.body.site
  };
}

/* ------------------------------------------------------------ dagitim */

test('widget.js is served with the right type, CORS and cache headers', async () => {
  const res = await fetch(`${BASE}/widget.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);

  // Widget her musteri alan adindan yuklenir; * disinda bir deger dogru olamaz.
  assert.equal(res.headers.get('access-control-allow-origin'), '*');

  const source = await res.text();
  assert.match(source, /SupportChat/, 'runtime does not expose the SupportChat namespace');
  assert.match(source, /attachShadow/, 'runtime is not using Shadow DOM isolation');

  // Eski surumdeki iki hata: sabit localhost adresi ve ucuncu parti CDN.
  // Kaynak metninde bu adresler yalnizca aciklama satirlarinda gecebilir;
  // aranan sey gercek bir URL degeridir, o yuzden sema ile birlikte bakilir.
  assert.doesNotMatch(source, /['"]http:\/\/localhost:5000['"]/, 'API url is hardcoded in the runtime');
  assert.doesNotMatch(source, /https?:\/\/cdn\.socket\.io/, 'runtime still loads socket.io from a third-party CDN');
  assert.match(source, /\/socket\.io\/socket\.io\.js/, 'runtime does not load the socket client from our own origin');
});

test('the pinned widget path is cacheable as immutable', async () => {
  const res = await fetch(`${BASE}/widget/v3/widget.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('cache-control') || '', /immutable/);
});

test('the socket.io client is served from our own origin', async () => {
  // Widget bunu yukler. Ucuncu parti bir CDN yerine kendi origin'imizden
  // gelmesi, musterinin CSP'sine tek bir adres eklemesini yeterli kilar.
  const res = await fetch(`${BASE}/socket.io/socket.io.js`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /javascript/);
});

/* ----------------------------------------------------------- bootstrap */

test('bootstrap returns everything the widget needs in one response', async () => {
  const tenant = await createTenant('boot');

  const res = await api(`/api/widget/bootstrap?siteKey=${tenant.site.siteKey}`);
  assert.equal(res.status, 200, JSON.stringify(res.body));

  const payload = res.body;
  assert.ok(payload.version, 'no SDK version');
  assert.ok(payload.config, 'no config');
  assert.ok(Array.isArray(payload.faqs), 'faqs is not an array');
  assert.ok(['online', 'away', 'offline'].includes(payload.availability), 'availability is not a known state');

  // Widget'in cizim icin ihtiyac duydugu her grup dolu gelmeli; eksik grup,
  // runtime'da `config.colors.primary` gibi okumalari patlatirdi.
  for (const group of ['colors', 'branding', 'button', 'window', 'messages', 'behavior', 'typography', 'advanced']) {
    assert.ok(payload.config[group], `config.${group} is missing`);
  }
  assert.match(payload.config.colors.primary, /^#[0-9A-Fa-f]{6}$/);
});

test('bootstrap leaks no internal identifiers', async () => {
  const tenant = await createTenant('leak');
  const res = await api(`/api/widget/bootstrap?siteKey=${tenant.site.siteKey}`);
  assert.equal(res.status, 200);

  // Bu uc kimlik dogrulamasizdir ve herkese aciktir. Beyaz liste yaklasiminin
  // amaci tam olarak budur: modele yeni bir alan eklendiginde kazara
  // yayinlanmasin.
  const serialized = JSON.stringify(res.body);
  for (const forbidden of ['organizationId', 'organization_id', 'siteId', 'site_id', '_id', 'userId']) {
    assert.ok(!serialized.includes(forbidden), `bootstrap response leaks ${forbidden}`);
  }
});

test('an unknown key and an inactive site are indistinguishable', async () => {
  const missing = await api('/api/widget/bootstrap?siteKey=definitely-not-a-real-key');
  assert.equal(missing.status, 404);
  assert.equal(missing.body.code, 'WIDGET_NOT_FOUND');

  const tenant = await createTenant('inactive');
  const deactivated = await api(`/api/sites/${tenant.site._id}`, {
    method: 'PUT',
    token: tenant.token,
    body: { isActive: false }
  });
  assert.ok(deactivated.status < 400, JSON.stringify(deactivated.body));

  const inactive = await api(`/api/widget/bootstrap?siteKey=${tenant.site.siteKey}`);
  assert.equal(inactive.status, missing.status);
  assert.deepEqual(inactive.body, missing.body);
});

test('bootstrap validates its input', async () => {
  const res = await api('/api/widget/bootstrap');
  assert.equal(res.status, 400);
  assert.equal(res.body.code, 'VALIDATION_ERROR');
});

/* ------------------------------------------------ kurulum dogrulamasi */

test('installation verification records the origin but drops the query string', async () => {
  const tenant = await createTenant('install');

  const before = await api(`/api/sites/${tenant.site._id}`, { token: tenant.token });
  assert.ok(!before.body.site.installation?.verifiedAt, 'site starts out already verified');

  const ping = await api('/api/widget/installed', {
    method: 'POST',
    body: {
      siteKey: tenant.site.siteKey,
      // Sorgu dizesi kisisel veri tasiyabilir; saklanmamali.
      url: 'https://shop.example.com/checkout?email=someone%40example.com&token=secret',
      sdkVersion: '3.0.0'
    }
  });
  assert.equal(ping.status, 200, JSON.stringify(ping.body));
  assert.ok(ping.body.verifiedAt);

  const after = await api(`/api/sites/${tenant.site._id}`, { token: tenant.token });
  const installation = after.body.site.installation;
  assert.ok(installation.verifiedAt, 'installation was not recorded');
  assert.equal(installation.origin, 'https://shop.example.com');
  assert.equal(installation.path, '/checkout');
  assert.equal(installation.sdkVersion, '3.0.0');

  const serialized = JSON.stringify(installation);
  assert.ok(!serialized.includes('someone'), 'the query string was stored');
  assert.ok(!serialized.includes('secret'), 'the query string was stored');
});

test('the first verification timestamp survives later heartbeats', async () => {
  const tenant = await createTenant('heartbeat');

  const first = await api('/api/widget/installed', {
    method: 'POST',
    body: { siteKey: tenant.site.siteKey, url: 'https://a.example.com/', sdkVersion: '3.0.0' }
  });
  assert.equal(first.status, 200);

  await new Promise((resolve) => setTimeout(resolve, 25));

  const second = await api('/api/widget/installed', {
    method: 'POST',
    body: { siteKey: tenant.site.siteKey, url: 'https://a.example.com/pricing', sdkVersion: '3.0.0' }
  });
  assert.equal(second.status, 200);

  // "Ne zaman kuruldu" bilgisi her heartbeat'te sifirlanmamali.
  assert.equal(second.body.verifiedAt, first.body.verifiedAt);

  const site = await api(`/api/sites/${tenant.site._id}`, { token: tenant.token });
  assert.notEqual(site.body.site.installation.lastSeenAt, site.body.site.installation.verifiedAt);
});

test('installation verification rejects an unknown key', async () => {
  const res = await api('/api/widget/installed', {
    method: 'POST',
    body: { siteKey: 'nope', url: 'https://a.example.com/' }
  });
  assert.equal(res.status, 404);
  assert.equal(res.body.code, 'WIDGET_NOT_FOUND');
});

/* ------------------------------------------------------------- yetki */

test('the owner role can manage departments', async () => {
  // Bu, panelde "Insufficient role permissions" hatasina yol acan gercek
  // hataydi: rol tablosunda owner'da 'manage_team' izni YOKTU, bu yuzden
  // organizasyonun sahibi departman olusturamiyordu.
  const tenant = await createTenant('rbac');

  const res = await api('/api/departments', {
    method: 'POST',
    token: tenant.token,
    body: {
      name: 'Teknik Destek',
      description: 'Teknik Destek Ekibi',
      siteId: tenant.site._id,
      color: '#10B981',
      icon: 'rocket'
    }
  });

  assert.equal(res.status, 201, `owner could not create a department: ${JSON.stringify(res.body)}`);
  assert.equal(res.body.name, 'Teknik Destek');
});

test('widget config cannot be written across a tenant boundary', async () => {
  const victim = await createTenant('victim');
  const attacker = await createTenant('attacker');

  // Saldirgan kendi gecerli oturumuyla KURBANIN site id'sini gonderiyor.
  const write = await api(`/api/widget-config/site/${victim.site._id}`, {
    method: 'PUT',
    token: attacker.token,
    body: { colors: { primary: '#FF0000' } }
  });
  assert.equal(write.status, 404, 'a foreign widget config was writable');

  // Kurbanin yapilandirmasi degismemis olmali.
  const bootstrap = await api(`/api/widget/bootstrap?siteKey=${victim.site.siteKey}`);
  assert.notEqual(bootstrap.body.config.colors.primary, '#FF0000');
});

test('the team chat member list stays inside the organization', async () => {
  // Eski sorgu filtresizdi (`Team.find({ isActive: true })` ve `User.find({})`),
  // yani secici SISTEMDEKI TUM organizasyonlarin kullanicilarini listeliyordu.
  const a = await createTenant('orga');
  const b = await createTenant('orgb');

  const members = await api('/api/team-chat/members', { token: a.token });
  assert.equal(members.status, 200);
  assert.ok(Array.isArray(members.body));

  const emails = members.body.map((m: any) => m.email);
  assert.ok(!emails.includes(b.email), 'another organization member is visible in the picker');
  assert.ok(!emails.includes(a.email), 'the caller lists themselves as a chat target');

  // Ayni kisi hem users hem teams tablosunda olabilir; secicide cift satir olmamali.
  const ids = members.body.map((m: any) => String(m._id));
  assert.equal(new Set(ids).size, ids.length, 'the member list contains duplicates');
});

test('a direct chat cannot be opened with someone in another organization', async () => {
  const a = await createTenant('dma');
  const b = await createTenant('dmb');

  const res = await api('/api/team-chat/chats/direct', {
    method: 'POST',
    token: a.token,
    body: { targetUserId: b.userId }
  });

  assert.equal(res.status, 404, 'a cross-tenant direct chat was created');
});
