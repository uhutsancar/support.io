'use strict';

// What happens when nobody answers, and after the chat (plan v10 PRD-01,
// PRD-04, PRD-05, PRD-06):
//
//  - an unanswered chat mails the team once its delay has passed; chats in
//    the next ten minutes are gathered into one mail; "off" means no mail
//  - an agent's reply to a visitor who left an address and went away is
//    mailed, with a link back into the chat and a link to stop the mails
//  - a required pre-chat form (and consent box) comes before the first message
//  - the widget hears that the chat ended and takes a rating; a low one is
//    stored like any other; the rating mail's link works
//  - the visitor can have the transcript mailed
//
// The sweeps run from the API's SLA pass once a minute. Here they are run in
// this process with a clock moved forward, so nothing waits for real minutes,
// and their mails are caught here.
//
// Needs the running API with the console mail transport. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import { connect } from 'socket.io-client';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { setMailTransport } from '../src/services/mail';
import {
  flushMissedNotices,
  sweepCsatRequests,
  sweepMissedChats,
  sweepVisitorReplies
} from '../src/services/conversationMail';
import { BASE, joinAsVisitor, LOCAL_ORIGIN } from './helpers/widget';
import { outbox, signUp } from './helpers/accounts';
import type { Socket } from 'socket.io-client';
import type { OutgoingMail } from '../src/services/mail';

const MIN = 60 * 1000;
const caught: OutgoingMail[] = [];
setMailTransport({
  name: 'test',
  async send(mail) {
    caught.push(mail);
  }
});

const sockets: Socket[] = [];
test.after(async () => {
  for (const s of sockets) s.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 300));
  await closeRedisClient();
  await getPool().end();
});

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;
const later = (minutes: number) => new Date(Date.now() + minutes * MIN);

function sessionCookie(res: { headers: Headers }): string {
  const match = /(?:^|,\s*)sc_session=([^;]+)/.exec(res.headers.get('set-cookie') || '');
  return match ? decodeURIComponent(match[1]) : '';
}

async function api(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {}
) {
  const res = await fetch(`${BASE}${path}`, {
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
  return { status: res.status, body: json, headers: res.headers };
}

async function tenant() {
  const email = `owner${stamp()}@offline.test`;
  const reg = await signUp({ name: 'Offline Owner', email, password: 'E2ePassw0rd!' });
  const token = sessionCookie(reg);
  const site = await api('/api/sites', {
    method: 'POST',
    token,
    body: { name: `Shop ${stamp()}`, domain: `o${stamp()}.example` }
  });
  assert.equal(site.status, 201);
  return { email, token, site: site.body.site };
}

const ack = (socket: Socket, event: string, payload: unknown): Promise<any> =>
  socket.timeout(10_000).emitWithAck(event, payload);

function adminSocket(token: string): Promise<Socket> {
  const socket = connect(`${BASE}/admin`, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: { token }
  });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function visitorWrites(siteKey: string, content: string) {
  const visitor = await joinAsVisitor(siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const sent = await ack(visitor.socket, 'send-message', {
    content,
    clientMessageId: `c-${stamp()}`
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  return { ...visitor, conversationId: String(sent.message.conversationId) };
}

const mailsTo = (address: string) => caught.filter((m) => m.to === address);

test('an unanswered chat mails the team once; the next ones are gathered', async () => {
  const shop = await tenant();
  const first = await visitorWrites(shop.site.siteKey, `Kargo nerede? ${stamp()}`);

  // Not yet: the owner is online and three minutes have not passed.
  await sweepMissedChats({ now: later(1) });
  const { rows: early } = await query(
    'SELECT missed_notified_at FROM conversations WHERE id = $1',
    [first.conversationId]
  );
  assert.equal(early[0].missed_notified_at, null);

  await sweepMissedChats({ now: later(4) });
  await flushMissedNotices({ now: later(4) });
  // The API's own pass may have sent it first; either way, exactly one.
  const api1 = (await outbox(shop.email)).filter((m) => /yanıtlanmamış/.test(m.subject));
  const mine = mailsTo(shop.email).filter((m) => /yanıtlanmamış/.test(m.subject));
  assert.equal(api1.length + mine.length, 1, 'one mail for the first chat');
  const sent = mine[0] ?? api1[0];
  assert.match(sent.subject, new RegExp(shop.site.name));
  assert.match(sent.text, /dashboard\/conversations\?conversation=/);
  assert.match(sent.text, /Kargo nerede\?/);

  // A second chat a minute later waits for the ten-minute window…
  await visitorWrites(shop.site.siteKey, 'İade nasıl yapılır?');
  await sweepMissedChats({ now: later(8) });
  await flushMissedNotices({ now: later(8) });
  assert.equal(
    mailsTo(shop.email).filter((m) => /yanıtlanmamış/.test(m.subject)).length,
    mine.length
  );
  // …and goes out after it.
  await flushMissedNotices({ now: later(20) });
  const after = mailsTo(shop.email).filter((m) => /yanıtlanmamış/.test(m.subject));
  assert.equal(after.length, mine.length + 1);
});

test('"off" means no unanswered-chat mail', async () => {
  const shop = await tenant();
  const off = await api('/api/auth/preferences', {
    method: 'PUT',
    token: shop.token,
    body: { missedChatEmail: 'off' }
  });
  assert.equal(off.status, 200);
  assert.equal(off.body.preferences.missedChatEmail, 'off');
  await visitorWrites(shop.site.siteKey, 'Merhaba');
  await sweepMissedChats({ now: later(5) });
  await flushMissedNotices({ now: later(5) });
  assert.equal(mailsTo(shop.email).length, 0);
});

test('a reply to a visitor who left is mailed, with a way back and a way out', async () => {
  const shop = await tenant();
  const visitor = await joinAsVisitor(shop.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const address = `visitor${stamp()}@offline.test`;
  const contact = await ack(visitor.socket, 'visitor-contact', { email: address, name: 'Ayşe' });
  assert.equal(contact.ok, true, JSON.stringify(contact));
  const opened = await ack(visitor.socket, 'send-message', {
    content: 'Siparişim gelmedi',
    clientMessageId: `c-${stamp()}`
  });
  const conversationId = String(opened.message.conversationId);
  const { rows: stored } = await query(
    'SELECT visitor_email, visitor_name FROM conversations WHERE id = $1',
    [conversationId]
  );
  assert.equal(stored[0].visitor_email, address);
  assert.equal(stored[0].visitor_name, 'Ayşe');

  // The visitor leaves; then the agent answers.
  visitor.socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 500));
  const agent = await adminSocket(shop.token);
  const reply = await ack(agent, 'send-message', {
    conversationId,
    content: 'Kargonuz yarın elinizde.',
    clientMessageId: crypto.randomUUID()
  });
  assert.equal(reply.ok, true, JSON.stringify(reply));

  await sweepVisitorReplies({ now: later(2) });
  const mails = mailsTo(address);
  assert.equal(mails.length, 1);
  assert.match(mails[0].text, /Kargonuz yarın elinizde\./);
  const resume = /\?sc_resume=([A-Za-z0-9_.-]+)/.exec(mails[0].text);
  assert.ok(resume, 'no way back into the chat');
  const optOut = /(https?:\/\/[^\s]+\/api\/widget\/email-optout\?t=[A-Za-z0-9_.%-]+)/.exec(
    mails[0].text
  );
  assert.ok(optOut, 'no way to stop the mails');

  // Nothing new: no second mail.
  await sweepVisitorReplies({ now: later(4) });
  assert.equal(mailsTo(address).length, 1);

  // The link brings this visitor back, from any browser.
  const resumed = await fetch(`${BASE}/api/widget/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: LOCAL_ORIGIN },
    body: JSON.stringify({ siteKey: shop.site.siteKey, resumeToken: resume![1] })
  });
  const session = (await resumed.json()) as any;
  assert.equal(session.visitorId, visitor.visitorId);
  assert.equal(session.resumed, true);

  const stopped = await fetch(optOut![1].replace(/^https?:\/\/[^/]+/, BASE));
  assert.equal(stopped.status, 200);
  const { rows } = await query('SELECT email_replies_opt_out FROM conversations WHERE id = $1', [
    conversationId
  ]);
  assert.equal(rows[0].email_replies_opt_out, true);
});

test('a required pre-chat form and consent box come before the first message', async () => {
  const shop = await tenant();
  const saved = await api(`/api/sites/${shop.site._id}/chat-settings`, {
    method: 'PUT',
    token: shop.token,
    body: {
      preChat: {
        mode: 'required',
        name: true,
        email: true,
        phone: false,
        customFields: ['Sipariş numarası'],
        consent: { mode: 'required', policyUrl: 'https://shop.example/kvkk' }
      }
    }
  });
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.settings.preChat.mode, 'required');

  const visitor = await joinAsVisitor(shop.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(visitor.socket);
  const early = await ack(visitor.socket, 'send-message', {
    content: 'Merhaba',
    clientMessageId: `c-${stamp()}`
  });
  assert.equal(early.ok, false);
  assert.equal(early.code, 'PRECHAT_REQUIRED');

  const invalid = await ack(visitor.socket, 'visitor-contact', {
    name: 'Ali',
    email: 'not-an-address',
    consent: true
  });
  assert.equal(invalid.code, 'PRECHAT_INVALID');
  const incomplete = await ack(visitor.socket, 'visitor-contact', {
    name: 'Ali',
    email: 'ali@offline.test',
    consent: true
  });
  assert.equal(incomplete.code, 'PRECHAT_INCOMPLETE');
  const noConsent = await ack(visitor.socket, 'visitor-contact', {
    name: 'Ali',
    email: 'ali@offline.test',
    fields: { 'Sipariş numarası': 'A-1001' }
  });
  assert.equal(noConsent.code, 'PRECHAT_INCOMPLETE');
  const done = await ack(visitor.socket, 'visitor-contact', {
    name: 'Ali',
    email: 'ali@offline.test',
    fields: { 'Sipariş numarası': 'A-1001', 'Unknown field': 'dropped' },
    consent: true
  });
  assert.equal(done.ok, true, JSON.stringify(done));

  const sent = await ack(visitor.socket, 'send-message', {
    content: 'Merhaba',
    clientMessageId: `c-${stamp()}`
  });
  assert.equal(sent.ok, true, JSON.stringify(sent));
  const { rows } = await query(
    'SELECT visitor_name, visitor_email, prechat, visitor_consent_at FROM conversations WHERE id = $1',
    [sent.message.conversationId]
  );
  assert.equal(rows[0].visitor_name, 'Ali');
  assert.equal(rows[0].visitor_email, 'ali@offline.test');
  assert.deepEqual(rows[0].prechat, { 'Sipariş numarası': 'A-1001' });
  assert.ok(rows[0].visitor_consent_at, 'the consent time was not kept');

  // The widget gets the form's settings with its session, and nothing else.
  const session = await fetch(`${BASE}/api/widget/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: LOCAL_ORIGIN },
    body: JSON.stringify({ siteKey: shop.site.siteKey })
  });
  const chat = ((await session.json()) as any).chat;
  assert.equal(chat.preChat.mode, 'required');
  assert.equal(chat.missedChat, undefined, 'internal settings reached the widget');
});

test('the widget hears the chat ended and takes a rating; the mailed link works too', async () => {
  const shop = await tenant();
  const chat = await visitorWrites(shop.site.siteKey, 'Teşekkürler');
  const ended = new Promise<any>((resolve) => chat.socket.once('conversation-ended', resolve));
  const closed = await api(`/api/conversations/${chat.conversationId}/status`, {
    method: 'PUT',
    token: shop.token,
    body: { status: 'resolved' }
  });
  assert.equal(closed.status, 200, JSON.stringify(closed.body));
  const event = await ended;
  assert.deepEqual(event.csat, { style: 'thumbs' });

  const bad = await ack(chat.socket, 'rate-conversation', { score: 9 });
  assert.equal(bad.code, 'INVALID_RATING');
  const rated = await ack(chat.socket, 'rate-conversation', { score: 1, feedback: 'Geç cevap' });
  assert.equal(rated.ok, true, JSON.stringify(rated));
  const { rows } = await query(`SELECT rating FROM conversations WHERE id = $1`, [
    chat.conversationId
  ]);
  assert.equal(rows[0].rating.score, 1);
  assert.equal(rows[0].rating.feedback, 'Geç cevap');
  assert.equal(rows[0].rating.channel, 'widget');

  // A visitor who left an address and went before rating gets one mail.
  const away = await joinAsVisitor(shop.site.siteKey, {}, { origin: LOCAL_ORIGIN });
  sockets.push(away.socket);
  const address = `rater${stamp()}@offline.test`;
  await ack(away.socket, 'visitor-contact', { email: address });
  const opened = await ack(away.socket, 'send-message', {
    content: 'Soru',
    clientMessageId: `c-${stamp()}`
  });
  away.socket.disconnect();
  await new Promise((resolve) => setTimeout(resolve, 500));
  await api(`/api/conversations/${opened.message.conversationId}/status`, {
    method: 'PUT',
    token: shop.token,
    body: { status: 'closed' }
  });
  await sweepCsatRequests({ now: later(3) });
  const mail = mailsTo(address).find((m) => /değerlendirin/.test(m.subject));
  assert.ok(mail, 'no rating mail');
  const token = decodeURIComponent(/\/rate\?t=([^\s]+)/.exec(mail!.text)![1]);
  const page = await api(`/api/widget/rating?t=${encodeURIComponent(token)}`);
  assert.equal(page.status, 200);
  assert.equal(page.body.rated, false);
  const viaMail = await api('/api/widget/rating', { method: 'POST', body: { t: token, score: 5 } });
  assert.equal(viaMail.status, 200, JSON.stringify(viaMail.body));
  assert.equal(viaMail.body.rating.channel, 'email');
  await sweepCsatRequests({ now: later(5) });
  assert.equal(mailsTo(address).filter((m) => /değerlendirin/.test(m.subject)).length, 1);
});

test('the visitor can have the transcript mailed', async () => {
  const shop = await tenant();
  const chat = await visitorWrites(shop.site.siteKey, 'Döküm istiyorum');
  const address = `transcript${stamp()}@offline.test`;
  const bad = await ack(chat.socket, 'request-transcript', { email: 'nope' });
  assert.equal(bad.ok, false);
  const done = await ack(chat.socket, 'request-transcript', { email: address });
  assert.equal(done.ok, true, JSON.stringify(done));
  const mails = await outbox(address);
  assert.equal(mails.length, 1);
  assert.match(mails[0].text, /Döküm istiyorum/);
});
