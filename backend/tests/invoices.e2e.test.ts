'use strict';

// The billing page's invoices (plan v10 BIL-06), in process with a stand-in
// for Paddle: the owner sees their customer's billed payments, opens a PDF
// of their own, and gets a 404 for anybody else's — the transaction id alone
// is never enough. Without a subscription the list is simply empty.
//
// Needs the database the running API uses (signs up through it). Run:
// npm run test:compose -- --test tests/invoices.e2e.test.ts

// Loads .env before any module below reads it; see src/config/env.ts.
import '../src/config/env';
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import cookieParser from 'cookie-parser';
import type { AddressInfo } from 'node:net';
import { getPool, query } from '../src/db/pool';
import { closeRedisClient } from '../src/config/redis';
import { generateId } from '../src/db/objectId';
import { signSession } from '../src/config/tokens';
import billingRoutes from '../src/routes/billing';
import { errorHandler } from '../src/http';
import { useInvoiceSource } from '../src/services/paddleInvoices';
import { signUp } from './helpers/accounts';

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 100000)}`;
const savedKey = process.env.PADDLE_API_KEY;

let server: http.Server;
let url = '';

test.before(async () => {
  process.env.PADDLE_API_KEY = 'test-key-not-a-real-one';
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/billing', billingRoutes);
  app.use(errorHandler);
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.after(async () => {
  if (savedKey === undefined) delete process.env.PADDLE_API_KEY;
  else process.env.PADDLE_API_KEY = savedKey;
  useInvoiceSource(null);
  server.close();
  await closeRedisClient();
  await getPool().end();
});

async function owner({ customerId }: { customerId?: string } = {}) {
  const email = `owner${stamp()}@invoices.test`;
  const reg = await signUp({ name: 'Invoice Owner', email, password: 'E2ePassw0rd!' });
  assert.equal(reg.status, 201);
  const { rows } = await query<{ id: string; organization_id: string; session_version: number }>(
    'SELECT id, organization_id, session_version FROM users WHERE email = $1',
    [email]
  );
  const user = rows[0];
  if (customerId) {
    await query(
      `INSERT INTO subscriptions (id, organization_id, provider, provider_customer_id,
         provider_subscription_id, plan_type, status, current_period_end, last_event_at)
       VALUES ($1, $2, 'paddle', $3, $4, 'PRO', 'active', now() + interval '20 days', now())`,
      [generateId(), user.organization_id, customerId, `sub_${stamp()}`]
    );
  }
  const session = signSession(
    {
      userId: user.id,
      userType: 'user',
      role: 'owner',
      organizationId: user.organization_id,
      sv: user.session_version
    },
    600
  );
  return (path: string) =>
    fetch(`${url}${path}`, { headers: { Authorization: `Bearer ${session}` } });
}

test('the owner lists their invoices and opens only their own', async () => {
  const mine = `ctm_${stamp()}`;
  const theirs = `ctm_${stamp()}`;
  const owners: Record<string, string> = {
    txn_01aaaaaaaaaaaaaaaaaaaaaaaa: mine,
    txn_01bbbbbbbbbbbbbbbbbbbbbbbb: theirs
  };
  const asked: string[] = [];
  useInvoiceSource({
    async list(customerId) {
      asked.push(customerId);
      return [
        {
          id: 'txn_01aaaaaaaaaaaaaaaaaaaaaaaa',
          number: '2026-00042',
          billedAt: '2026-10-01T09:00:00Z',
          total: 588,
          currency: 'TRY',
          status: 'completed'
        }
      ];
    },
    async pdf(transactionId, customerId) {
      return owners[transactionId] === customerId
        ? `https://sandbox-invoice.example/${transactionId}.pdf`
        : null;
    }
  });

  const call = await owner({ customerId: mine });
  const list = await call('/api/billing/invoices');
  assert.equal(list.status, 200);
  const { invoices } = (await list.json()) as { invoices: Array<{ number: string }> };
  assert.equal(invoices[0].number, '2026-00042');
  assert.deepEqual(asked, [mine], 'Paddle is asked about this organization’s customer only');

  const own = await call('/api/billing/invoices/txn_01aaaaaaaaaaaaaaaaaaaaaaaa/pdf');
  assert.equal(own.status, 200);
  assert.match(((await own.json()) as { url: string }).url, /txn_01a+\.pdf$/);

  const foreign = await call('/api/billing/invoices/txn_01bbbbbbbbbbbbbbbbbbbbbbbb/pdf');
  assert.equal(foreign.status, 404);
  const malformed = await call('/api/billing/invoices/..%2F..%2Fcustomers/pdf');
  assert.equal(malformed.status, 400);
});

test('without a subscription there is nothing to list or open', async () => {
  useInvoiceSource({
    async list() {
      throw new Error('Paddle must not be asked');
    },
    async pdf() {
      throw new Error('Paddle must not be asked');
    }
  });
  const call = await owner();
  const list = await call('/api/billing/invoices');
  assert.equal(list.status, 200);
  assert.deepEqual(await list.json(), { invoices: [] });
  const pdf = await call('/api/billing/invoices/txn_01aaaaaaaaaaaaaaaaaaaaaaaa/pdf');
  assert.equal(pdf.status, 404);
});
