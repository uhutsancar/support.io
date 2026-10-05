// Development delivery: print the mail, and keep the last few in memory.
//
// The outbox is what lets a developer — and the e2e suite — follow a
// verification or reset link without a mail server. It is readable only
// through GET /api/dev/outbox, which server.ts mounts outside production and
// only while this transport is the one in use.

import type { MailTransport, OutgoingMail } from './index';

const OUTBOX_SIZE = 200;

export interface StoredMail extends OutgoingMail {
  from: string;
  sentAt: string;
}

const outbox: StoredMail[] = [];

/** The kept mails for one address, newest first. */
export function outboxFor(address: string): StoredMail[] {
  const wanted = address.trim().toLowerCase();
  return outbox.filter((m) => m.to.toLowerCase() === wanted).reverse();
}

export function consoleTransport(): MailTransport {
  return {
    name: 'console',
    async send(mail) {
      outbox.push({ ...mail, sentAt: new Date().toISOString() });
      if (outbox.length > OUTBOX_SIZE) outbox.splice(0, outbox.length - OUTBOX_SIZE);
      console.log(`[mail:console] to=${mail.to} subject="${mail.subject}"\n${mail.text}\n`);
    }
  };
}
