'use strict';

// Staging mails only the domains it is allowed to (plan v10 INF-03,
// MAIL_ALLOWLIST_DOMAINS): a real customer's address is withheld, an allowed
// one goes out; with the setting empty (production) everything goes.
//
// Run: npx tsx --test tests/mailAllowlist.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { mailAllowed, sendMail, setMailTransport } from '../src/services/mail';
import type { OutgoingMail } from '../src/services/mail';

test('only the allowed domains, their subdomains included', () => {
  const list = 'example.com, @ourcompany.com.tr';
  assert.equal(mailAllowed('tester@example.com', list), true);
  assert.equal(mailAllowed('Tester@Mail.Example.com', list), true);
  assert.equal(mailAllowed('owner@ourcompany.com.tr', list), true);
  assert.equal(mailAllowed('customer@gmail.com', list), false);
  assert.equal(mailAllowed('x@notexample.com', list), false);
  assert.equal(mailAllowed('customer@gmail.com', ''), true);
  assert.equal(mailAllowed('customer@gmail.com', undefined), true);
});

test('a withheld mail never reaches the transport', async () => {
  const sent: OutgoingMail[] = [];
  setMailTransport({
    name: 'test',
    async send(mail) {
      sent.push(mail);
    }
  });
  const saved = process.env.MAIL_ALLOWLIST_DOMAINS;
  process.env.MAIL_ALLOWLIST_DOMAINS = 'example.com';
  try {
    const mail = { subject: 'Hi', text: 'Hi', html: '<p>Hi</p>' };
    assert.equal(await sendMail({ ...mail, to: 'customer@gmail.com' }), false);
    assert.equal(await sendMail({ ...mail, to: 'tester@example.com' }), true);
    assert.deepEqual(
      sent.map((m) => m.to),
      ['tester@example.com']
    );
  } finally {
    if (saved === undefined) delete process.env.MAIL_ALLOWLIST_DOMAINS;
    else process.env.MAIL_ALLOWLIST_DOMAINS = saved;
    setMailTransport(null);
  }
});
