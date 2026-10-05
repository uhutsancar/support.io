// Accounts the way a person gets one: register, then follow the link from the
// verification e-mail. The running API uses the console mail transport in
// development and keeps what it "sent" at GET /api/dev/outbox
// (services/mail/console.ts), so the suite follows the same link a person
// would click instead of writing the verified flag into the database.

import assert from 'node:assert/strict';
import { BASE } from './widget';

export interface OutboxMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  sentAt: string;
}

/** What the API "sent" to an address, newest first. */
export async function outbox(address: string): Promise<OutboxMail[]> {
  const res = await fetch(`${BASE}/api/dev/outbox?to=${encodeURIComponent(address)}`);
  assert.equal(res.status, 200, 'the dev outbox is not mounted (MAIL_PROVIDER=console?)');
  return ((await res.json()) as { mails: OutboxMail[] }).mails;
}

/** The token in the newest mail to `address` whose link goes to `path`. */
export async function tokenFromMail(address: string, path: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const mails = await outbox(address);
    const pattern = new RegExp(`${path}[?]token=([A-Za-z0-9_%-]+)`);
    for (const m of mails) {
      const match = pattern.exec(m.text);
      if (match) return decodeURIComponent(match[1]);
    }
    // Some mails go out without being awaited by the request that caused them.
    // eslint-disable-next-line no-await-in-loop
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`no ${path} mail for ${address}`);
}

/** Verifies an address by following its verification link. */
export async function verifyEmail(address: string): Promise<void> {
  const token = await tokenFromMail(address, '/verify-email');
  const res = await fetch(`${BASE}/api/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token })
  });
  assert.equal(res.status, 200, `verification failed for ${address}`);
}

/**
 * Puts an organization on a plan, as billing would. For suites that test
 * paid features (members, departments, rules) rather than the limits
 * themselves — tests/planLimits.e2e.test.ts covers those.
 */
export async function setPlan(
  organizationId: string,
  plan: 'FREE' | 'PRO' | 'ENTERPRISE'
): Promise<void> {
  const { query } = await import('../../src/db/pool');
  await query('UPDATE organizations SET plan_type = $2 WHERE id = $1', [organizationId, plan]);
}
