'use strict';

// One source for prices (plan v10 BIL-03), in process with a stand-in for
// Paddle: with billing on, GET /api/plans shows the amounts Paddle charges,
// a difference from domain/plans.ts is reported, a yearly price is compared
// per month, and while billing is off or Paddle cannot be read the table in
// plans.ts stands.
//
// Run: npx tsx --test tests/paddlePrices.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { PLAN_LIMITS } from '../src/domain/plans';
import plansRouter from '../src/routes/plans';
import {
  displayPrice,
  perMonth,
  refreshPaddlePrices,
  usePriceFetcher
} from '../src/services/paddlePrices';
import type { PaddlePrice } from '../src/services/paddlePrices';

const ENV = {
  BILLING_ENABLED: 'true',
  PADDLE_API_KEY: 'test-key-not-a-real-one',
  PADDLE_PRICE_PRO: 'pri_pro_month',
  PADDLE_PRICE_PRO_YEARLY: 'pri_pro_year',
  PADDLE_PRICE_ENTERPRISE: 'pri_ent_month',
  PADDLE_PRICE_ENTERPRISE_YEARLY: ''
};
const saved: Record<string, string | undefined> = {};

test.before(() => {
  for (const [key, value] of Object.entries(ENV)) {
    saved[key] = process.env[key];
    process.env[key] = value;
  }
});
test.after(() => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  usePriceFetcher(null);
});

const pro = PLAN_LIMITS.PRO.price;
const ent = PLAN_LIMITS.ENTERPRISE.price;
const minor = (major: number) => String(Math.round(major * 100));

test('per month: minor units to major, a yearly price divided by twelve', () => {
  const month: PaddlePrice = { amount: '49000', currency: 'TRY', interval: 'month', frequency: 1 };
  assert.equal(perMonth(month), 490);
  assert.equal(perMonth({ ...month, amount: '470400', interval: 'year' }), 392);
  assert.equal(perMonth({ ...month, amount: '1000', currency: 'JPY' }), 1000);
});

test('matching prices report nothing; a changed one is reported and shown', async () => {
  const table: Record<string, PaddlePrice> = {
    pri_pro_month: {
      amount: minor(pro.monthly!),
      currency: 'TRY',
      interval: 'month',
      frequency: 1
    },
    pri_pro_year: {
      amount: minor(pro.yearly! * 12),
      currency: 'TRY',
      interval: 'year',
      frequency: 1
    },
    pri_ent_month: { amount: minor(ent.monthly!), currency: 'TRY', interval: 'month', frequency: 1 }
  };
  const asked: string[] = [];
  usePriceFetcher(async (id) => {
    asked.push(id);
    return table[id];
  });
  assert.deepEqual(await refreshPaddlePrices(), []);
  assert.deepEqual(asked.sort(), ['pri_ent_month', 'pri_pro_month', 'pri_pro_year']);
  assert.equal(displayPrice('PRO').monthly, pro.monthly);

  // Somebody raised Pro in the Paddle dashboard.
  table.pri_pro_month = { ...table.pri_pro_month, amount: minor(590) };
  const differences = await refreshPaddlePrices();
  assert.equal(differences.length, 1);
  assert.match(differences[0], /^PRO monthly: Paddle 590 TRY, plans\.ts 490 TRY$/);
  assert.equal(displayPrice('PRO').monthly, 590);
  // A cycle with no Paddle price keeps the display figure.
  assert.equal(displayPrice('ENTERPRISE').yearly, ent.yearly);

  // GET /api/plans answers with what checkout charges.
  const app = express();
  app.use('/api/plans', plansRouter);
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/plans`);
    const { plans } = (await res.json()) as { plans: Array<{ type: string; price: any }> };
    assert.equal(plans.find((p) => p.type === 'PRO')!.price.monthly, 590);
    assert.equal(plans.find((p) => p.type === 'FREE')!.price.monthly, 0);
  } finally {
    server.close();
  }
});

test('Paddle unreachable or billing off: the table in plans.ts stands', async () => {
  usePriceFetcher(async () => {
    throw new Error('network down');
  });
  assert.deepEqual(await refreshPaddlePrices(), []);
  assert.equal(displayPrice('PRO').monthly, pro.monthly);

  process.env.BILLING_ENABLED = 'false';
  usePriceFetcher(async () => {
    throw new Error('must not be called while billing is off');
  });
  assert.deepEqual(await refreshPaddlePrices(), []);
  assert.deepEqual(displayPrice('ENTERPRISE'), ent);
  process.env.BILLING_ENABLED = 'true';
});
