// The account's two big moves (plan v10 TST-01 #8 and #10): a paid plan that
// ends puts the sites over the Free limit on hold — the panel says so and the
// owner picks which site stays — and deleting the workspace takes the
// password, then the account cannot sign in again.

import { expect, test } from '@playwright/test';
import { customerWebsite, ownerThroughApi, paidSubscription } from './support';

const PASSWORD = 'E2ePassw0rd!';

test('a downgrade puts what is over the plan on hold, and the owner chooses', async ({
  browser,
  baseURL
}) => {
  const port = Number(process.env.E2E_SHOP_PORT) || 5190;
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `downgrade${Date.now()}@e2e.test`,
    password: PASSWORD
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${port}`, title: 'Düşüren Sahip' }
  });
  expect(onboarded.ok()).toBeTruthy();
  for (const name of ['ikinci', 'ucuncu']) {
    const res = await owner.request.post('/api/sites', {
      headers: csrf,
      data: { name, domain: `${name}${Date.now()}.example` }
    });
    expect(res.status(), await res.text()).toBe(201);
  }
  const me = await (await owner.request.get('/api/auth/me')).json();
  const organizationId = String(me.user.organizationId);

  await test.step('Pro is bought, then cancelled and its period ends', async () => {
    const id = `sub_e2e_down_${Date.now()}`;
    const deliver = async (event: { body: string; signature: string }) => {
      const res = await owner.request.post('/api/billing/paddle/webhook', {
        headers: { 'Content-Type': 'application/json', 'Paddle-Signature': event.signature },
        data: event.body
      });
      expect(res.status()).toBe(200);
    };
    await deliver(paidSubscription(organizationId, { id, occurredAt: Date.now() - 2000 }));
    await deliver(
      paidSubscription(organizationId, {
        id,
        status: 'canceled',
        eventType: 'subscription.canceled',
        occurredAt: Date.now(),
        periodEnd: Date.now() - 60_000
      })
    );
  });

  const { sites } = await (await owner.request.get('/api/sites')).json();
  const [first, , third] = sites as { _id: string; name: string; suspendedAt?: string | null }[];

  await test.step('the panel says so, and the owner keeps another site', async () => {
    await owner.goto('/dashboard');
    await expect(owner.getByText(/sınırını aşan siteler veya ekip üyeleri askıda/)).toBeVisible();
    await owner.getByRole('link', { name: 'Seçimi yap' }).click();
    const section = owner.locator('section', { hasText: 'Plan sınırının üzerindekiler askıda' });
    await expect(section).toBeVisible();
    await section.locator('label', { hasText: first.name }).locator('input').uncheck();
    await section.locator('label', { hasText: third.name }).locator('input').check();
    await owner.getByRole('button', { name: 'Seçimi kaydet' }).click();
    await expect(owner.getByText('Seçiminiz kaydedildi.')).toBeVisible();
    const after = (await (await owner.request.get('/api/sites')).json()).sites as {
      _id: string;
      suspendedAt?: string | null;
    }[];
    expect(after.find((s) => s._id === third._id)!.suspendedAt).toBeFalsy();
    expect(after.find((s) => s._id === first._id)!.suspendedAt).toBeTruthy();
  });

  await test.step('the suspended site shows no widget; the Sites page says why', async () => {
    const firstSite = sites[0] as { siteKey: string };
    const shop = await customerWebsite(
      port,
      `<script src="${baseURL}/widget.js" data-site-key="${firstSite.siteKey}" async></script>`
    );
    try {
      const visitor = await (await browser.newContext()).newPage();
      await visitor.goto(shop.url);
      await visitor.waitForTimeout(3000);
      await expect(visitor.locator('.js-launcher')).toHaveCount(0);
    } finally {
      await shop.close();
    }
    await owner.goto('/dashboard/sites');
    await expect(owner.getByText('Askıda').first()).toBeVisible();
  });
});

test('deleting the workspace takes the password, then the account is gone', async ({ browser }) => {
  const email = `delete${Date.now()}@e2e.test`;
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, { email, password: PASSWORD });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: 'http://127.0.0.1:5191', title: 'Silinen Sahip' }
  });
  expect(onboarded.ok()).toBeTruthy();

  await owner.goto('/dashboard');
  await owner.getByRole('button', { name: 'Hesabı sil' }).click();
  const dialog = owner.getByRole('dialog');
  await expect(dialog.getByText('Hesabı ve çalışma alanını sil')).toBeVisible();
  await dialog.getByLabel('Onaylamak için şifreniz').fill('Wrong-Passw0rd-1');
  await dialog.getByRole('button', { name: 'Kalıcı olarak sil' }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await dialog.getByLabel('Onaylamak için şifreniz').fill(PASSWORD);
  await dialog.getByRole('button', { name: 'Kalıcı olarak sil' }).click();
  await expect(owner).not.toHaveURL(/\/dashboard/);

  const again = await (
    await browser.newContext()
  ).request.post('/api/auth/login', {
    data: { email, password: PASSWORD }
  });
  expect(again.status()).toBe(401);
});
