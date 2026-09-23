'use strict';

// Oturum ve token sınırları.
//
// En ağır bulgu: widget'ın herkese açık yükleme uç noktasının verdiği kanıt,
// oturumla aynı anahtar ve algoritmayla imzalanıyordu. Kanıtta userId yoktu,
// doğrulayıcı token'ın amacına bakmıyordu ve ORM `{ _id: undefined }`
// koşulunu sessizce düşürüyordu; sonuç olarak herhangi bir sitenin anonim
// ziyaretçisi veritabanındaki ilk aktif kullanıcı — herhangi bir şirketin
// sahibi — olarak kimlik kazanabiliyordu. Bu testler üç katmanın her birini
// ayrı ayrı sabitler, ayrıca çerez oturumu ve CSRF davranışını.
//
// Çalışan bir backend gerektirir. Çalıştırma: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { signUploadProof } from '../src/config/tokens';
import User from '../src/models/User';


const BASE = process.env.E2E_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const PASSWORD = 'E2ePassw0rd!';

async function call(path: string, init: RequestInit = {}) {
  const res = await fetch(`${BASE}${path}`, init);
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    /* boş gövde */
  }
  return { status: res.status, body, headers: res.headers };
}

const bearer = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } });

/** Sunucunun oturum anahtarını türetmenin aynısı; testin kendi token'larını
 *  "doğru anahtarla ama yanlış içerikle" imzalayabilmesi için. */
const sessionKey = () =>
  crypto
    .createHmac('sha256', String(process.env.JWT_SECRET))
    .update('support-chat/session/v1')
    .digest();

async function register() {
  const email = `auth${Date.now()}${Math.floor(Math.random() * 100000)}@auth-security.test`;
  const res = await call('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'auth owner', email, password: PASSWORD, companyName: 'auth co' })
  });
  assert.ok(res.status === 200 || res.status === 201, JSON.stringify(res.body));
  return { email, res };
}

function cookiesOf(headers: Headers): Record<string, { value: string; raw: string }> {
  const out: Record<string, { value: string; raw: string }> = {};
  const list =
    typeof headers.getSetCookie === 'function'
      ? headers.getSetCookie()
      : [headers.get('set-cookie') || ''];
  for (const raw of list) {
    const [pair] = raw.split(';');
    const i = pair.indexOf('=');
    if (i > 0) out[pair.slice(0, i).trim()] = { value: decodeURIComponent(pair.slice(i + 1)), raw };
  }
  return out;
}

// ------------------------------------------------------- token karışıklığı

test('an upload proof is never accepted as a session', async () => {
  const proof = signUploadProof({
    kind: 'chat-upload',
    siteId: '000000000000000000000000',
    filename: 'x.png',
    url: 'https://example.test/x.png',
    size: 1,
    mimeType: 'image/png'
  });
  for (const path of ['/api/auth/me', '/api/sites']) {
    const res = await call(path, bearer(proof));
    assert.equal(res.status, 401, `${path} accepted an upload proof as a session`);
  }
});

test('a token signed the old way (raw secret, no audience) is rejected', async () => {
  const user = await User.findOne({ isActive: true });
  assert.ok(user, 'the suite needs at least one active user');
  const legacy = jwt.sign(
    { userId: String(user._id), userType: 'user' },
    String(process.env.JWT_SECRET),
    { expiresIn: '5m' }
  );
  const res = await call('/api/auth/me', bearer(legacy));
  assert.equal(res.status, 401);
});

test('a session-keyed token without a user id is rejected', async () => {
  const token = jwt.sign({ userType: 'user' }, sessionKey(), {
    algorithm: 'HS256',
    audience: 'support-chat:session',
    expiresIn: '5m'
  });
  const res = await call('/api/auth/me', bearer(token));
  assert.equal(res.status, 401, 'a session with no userId must not resolve to any account');
});

test('an unsigned (alg: none) token is rejected', async () => {
  const user = await User.findOne({ isActive: true });
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ userId: String(user!._id), aud: 'support-chat:session' })}.`;
  const res = await call('/api/auth/me', bearer(token));
  assert.equal(res.status, 401);
});

test('an undefined filter value throws instead of widening the query', async () => {
  await assert.rejects(async () => {
    await User.findOne({ _id: undefined, isActive: true });
  }, /filter: "_id" is undefined/);
});

// ------------------------------------------------------------ çerez oturumu

test('login returns no token in the body and sets an httpOnly session cookie', async () => {
  const { email } = await register();
  const res = await call('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD })
  });
  assert.equal(res.status, 200);
  assert.equal('token' in res.body, false, 'the token must never reach page JavaScript');
  const cookies = cookiesOf(res.headers);
  assert.ok(cookies.sc_session, 'session cookie missing');
  assert.match(cookies.sc_session.raw, /HttpOnly/i);
  assert.match(cookies.sc_session.raw, /SameSite=(Lax|Strict|None)/i);
  assert.ok(cookies.sc_csrf, 'csrf cookie missing');
  assert.doesNotMatch(
    cookies.sc_csrf.raw,
    /HttpOnly/i,
    'the csrf pair must be readable by the panel'
  );
  assert.equal(res.body.csrfToken, cookies.sc_csrf.value);
});

test('a cookie-authenticated write needs the matching CSRF header', async () => {
  const { res } = await register();
  const cookies = cookiesOf(res.headers);
  const cookieHeader = `sc_session=${encodeURIComponent(cookies.sc_session.value)}; sc_csrf=${encodeURIComponent(cookies.sc_csrf.value)}`;
  const write = (extra: Record<string, string>) =>
    call('/api/auth/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Cookie: cookieHeader, ...extra },
      body: JSON.stringify({ status: 'online' })
    });

  assert.equal((await write({})).status, 403, 'no header');
  assert.equal((await write({ 'X-CSRF-Token': 'forged' })).status, 403, 'wrong header');
  assert.equal(
    (await write({ 'X-CSRF-Token': cookies.sc_csrf.value })).status,
    200,
    'matching header'
  );

  const read = await call('/api/auth/me', { headers: { Cookie: cookieHeader } });
  assert.equal(read.status, 200, 'reads do not need the header');
});

test('logout clears the session cookie', async () => {
  const { res } = await register();
  const cookies = cookiesOf(res.headers);
  const cookieHeader = `sc_session=${encodeURIComponent(cookies.sc_session.value)}; sc_csrf=${encodeURIComponent(cookies.sc_csrf.value)}`;
  const out = await call('/api/auth/logout', {
    method: 'POST',
    headers: { Cookie: cookieHeader, 'X-CSRF-Token': cookies.sc_csrf.value }
  });
  assert.equal(out.status, 200);
  const cleared = cookiesOf(out.headers);
  assert.ok(cleared.sc_session, 'logout must send a clearing cookie');
  assert.equal(cleared.sc_session.value, '');
});

// ------------------------------------------------------ operatör enjeksiyonu
//
// ORM Mongo benzeri operatörleri anlıyor; değer beklenen bir yere kullanıcıdan
// gelen `{ $ne: … }` ulaştığında sorgu "herhangi bir site" anlamına geliyordu.

test('a query-string operator cannot pick an arbitrary site', async () => {
  const res = await call('/api/widget/settings?siteKey[$ne]=no-such-key');
  assert.notEqual(
    res.status,
    200,
    `settings answered for an operator: ${JSON.stringify(res.body).slice(0, 120)}`
  );

  const search = await call('/api/faqs/search?siteKey[$ne]=no-such-key&q=a');
  assert.equal(search.status, 401, 'verifySiteKey must not authenticate an operator');
});

test('a JSON-body operator cannot write to an arbitrary site', async () => {
  const marker = `https://operator-${Date.now()}.example/path`;
  const res = await call('/api/widget/installed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ siteKey: { $ne: 'no-such-key' }, url: marker })
  });
  assert.equal(res.status, 400, `installed accepted an operator, got ${res.status}`);

  const { query } = await import('../src/db/pool');
  const { rows } = await query(
    "SELECT count(*)::int AS n FROM sites WHERE installation->>'origin' = $1",
    [new URL(marker).origin]
  );
  assert.equal(rows[0].n, 0, 'no site may carry the attacker origin');
});
