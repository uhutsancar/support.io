'use strict';

// Set-up mails and saved replies (plan v10 PRD-08, PRD-03).
//
//  - verifying the address sends the welcome mail; the widget's first page
//    view sends "your bubble is live"; a day without it, a reminder — each once
//  - an owner who switched them off gets none
//  - saved replies: agents read them, only owners/admins write them, the
//    shortcut is unique per organization and the plan caps how many
//
// Needs the running API with the console mail transport. Run: npm run test:compose

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import { getPool, query } from '../src/db/pool';
import { setMailTransport } from '../src/services/mail';
import { sweepActivation } from '../src/services/activation';
import { BASE, LOCAL_ORIGIN, widgetToken } from './helpers/widget';
import { outbox, setPlan, signUp } from './helpers/accounts';
import type { OutgoingMail } from '../src/services/mail';

const caught: OutgoingMail[] = [];
setMailTransport({
  name: 'test',
  async send(mail) {
    caught.push(mail);
  }
});

test.after(async () => {
  await getPool().end();
});

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;

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
  return { status: res.status, body: json };
}

async function waitForMail(address: string, pattern: RegExp) {
  for (let i = 0; i < 30; i++) {
    // eslint-disable-next-line no-await-in-loop
    const found = (await outbox(address)).find((m) => pattern.test(m.subject));
    if (found) return found;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

async function owner() {
  const email = `owner${stamp()}@activation.test`;
  const reg = await signUp({ name: 'Activation Owner', email, password: 'E2ePassw0rd!' });
  return {
    email,
    token: sessionCookie(reg),
    organizationId: String(reg.body.user.organizationId)
  };
}

test('verification sends the welcome mail; the first page view, "live"; a late day, a reminder', async () => {
  const me = await owner();
  const welcome = await waitForMail(me.email, /hesabınız hazır|account is ready/);
  assert.ok(welcome, 'no welcome mail');
  assert.match(welcome!.text, /dashboard\/sites/);

  // A day later with nothing installed: the reminder, from the sweep.
  await query(`UPDATE organizations SET created_at = now() - interval '2 days' WHERE id = $1`, [
    me.organizationId
  ]);
  await sweepActivation({ organizationId: me.organizationId });
  assert.ok(
    caught.some(
      (m) => m.to === me.email && /henüz sitenizde değil|not on your site/.test(m.subject)
    )
  );
  // Once.
  const count = caught.filter((m) => m.to === me.email).length;
  await sweepActivation({ organizationId: me.organizationId });
  assert.equal(caught.filter((m) => m.to === me.email).length, count);

  // The widget is seen on a page: "your bubble is live".
  const site = await api('/api/sites', {
    method: 'POST',
    token: me.token,
    body: { name: 'Live', domain: `l${stamp()}.example` }
  });
  const { token } = await widgetToken(site.body.site.siteKey);
  const seen = await fetch(`${BASE}/api/widget/installed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Origin: LOCAL_ORIGIN
    },
    body: JSON.stringify({ url: `${LOCAL_ORIGIN}/`, sdkVersion: '4.0.0' })
  });
  assert.equal(seen.status, 200);
  assert.ok(await waitForMail(me.email, /yayında|is live/), 'no "live" mail');
});

test('an owner who switched set-up mails off gets none', async () => {
  const me = await owner();
  const off = await api('/api/auth/preferences', {
    method: 'PUT',
    token: me.token,
    body: { activationEmails: false }
  });
  assert.equal(off.body.preferences.activationEmails, false);
  await query(`UPDATE organizations SET created_at = now() - interval '8 days' WHERE id = $1`, [
    me.organizationId
  ]);
  await sweepActivation({ organizationId: me.organizationId });
  assert.equal(caught.filter((m) => m.to === me.email).length, 0);
});

test('saved replies: agents read, admins write, one shortcut each, a plan cap', async () => {
  const me = await owner();
  const created = await api('/api/saved-replies', {
    method: 'POST',
    token: me.token,
    body: { shortcut: 'kargo', title: 'Kargo', body: 'Merhaba {{visitor.name}}, kargonuz yolda.' }
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const again = await api('/api/saved-replies', {
    method: 'POST',
    token: me.token,
    body: { shortcut: 'kargo', title: 'Kargo 2', body: 'x' }
  });
  assert.equal(again.status, 409);
  assert.equal(again.body.code, 'SHORTCUT_TAKEN');
  const bad = await api('/api/saved-replies', {
    method: 'POST',
    token: me.token,
    body: { shortcut: 'Has Spaces', title: 't', body: 'b' }
  });
  assert.equal(bad.status, 400);

  const used = await api(`/api/saved-replies/${created.body.reply._id}/use`, {
    method: 'POST',
    token: me.token
  });
  assert.equal(used.status, 204);
  const list = await api('/api/saved-replies', { token: me.token });
  assert.equal(list.body.replies[0].usageCount, 1);

  // An agent reads but does not write.
  await setPlan(me.organizationId, 'PRO');
  const agentEmail = `agent${stamp()}@activation.test`;
  const member = await api('/api/team', {
    method: 'POST',
    token: me.token,
    body: { name: 'Agent', email: agentEmail, password: 'E2ePassw0rd!', role: 'agent' }
  });
  assert.ok(member.status === 200 || member.status === 201, JSON.stringify(member.body));
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: agentEmail, password: 'E2ePassw0rd!' })
  });
  const agent = sessionCookie(login);
  assert.equal((await api('/api/saved-replies', { token: agent })).status, 200);
  const denied = await api('/api/saved-replies', {
    method: 'POST',
    token: agent,
    body: { shortcut: 'iade', title: 'İade', body: 'İade adımları…' }
  });
  assert.equal(denied.status, 403);

  // The free plan keeps ten.
  await setPlan(me.organizationId, 'FREE');
  for (let i = 0; i < 9; i++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await api('/api/saved-replies', {
      method: 'POST',
      token: me.token,
      body: { shortcut: `r${i}`, title: `R${i}`, body: 'x' }
    });
    assert.equal(ok.status, 201);
  }
  const over = await api('/api/saved-replies', {
    method: 'POST',
    token: me.token,
    body: { shortcut: 'one-more', title: 'x', body: 'x' }
  });
  assert.equal(over.status, 403);
  assert.equal(over.body.code, 'PLAN_LIMIT_REACHED');
});
