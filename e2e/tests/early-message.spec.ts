// A visitor who writes before the widget has connected (a slow network, a
// quick typist) must not lose the message. It used to be refused with
// "connection lost" while the socket was still being set up, and one sent
// while the socket was connecting vanished from the visitor's own thread
// when the first join redrew it.
//
// The account is set up through the API; first-chat.spec.ts covers the same
// steps through the panel.

import { expect, test } from '@playwright/test';
import { customerWebsite, mailedLink } from './support';

const PASSWORD = 'E2ePassw0rd!';
const SHOP_PORT = (Number(process.env.E2E_SHOP_PORT) || 5181) + 1;

test('a message written while the widget is still connecting arrives', async ({
  browser,
  request,
  baseURL
}) => {
  const stamp = Date.now();
  const email = `early${stamp}@e2e.test`;
  const text = `Hemen yazdım (${stamp})`;

  const registered = await request.post('/api/auth/register', {
    data: { name: 'Early Owner', email, password: PASSWORD }
  });
  expect(registered.status()).toBe(201);
  const verifyLink = new URL(await mailedLink(request, email, '/verify-email'), 'http://x');
  const verified = await request.post('/api/auth/verify-email', {
    data: { token: verifyLink.searchParams.get('token') }
  });
  expect(verified.status()).toBe(200);
  const { cookies } = await request.storageState();
  const csrf = { 'X-CSRF-Token': cookies.find((c) => c.name === 'sc_csrf')?.value ?? '' };
  const onboarded = await request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${SHOP_PORT}`, title: 'Early Owner' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await request.get('/api/sites')).json();
  const siteKey = String(sites[0].siteKey);

  const shop = await customerWebsite(
    SHOP_PORT,
    `<script src="${baseURL}/widget.js" data-site-key="${siteKey}" async></script>`
  );
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    // The realtime client arrives two seconds late, as on a slow connection.
    await page.route('**/socket.io/socket.io.js', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      await route.continue();
    });
    await page.goto(shop.url);
    await page.locator('.js-launcher').click();
    await page.locator('.js-start').click();
    await page.locator('.js-input').fill(text);
    await page.locator('.js-send').click();

    const bubble = page.locator('.msg.visitor').filter({ hasText: text });
    await expect(bubble).toBeVisible();
    await expect(page.locator('.js-input')).toHaveValue('');
    // Delivered once connected, and still in the thread after the first join.
    await expect(bubble).not.toHaveClass(/pending/, { timeout: 30_000 });
    await expect(bubble).toHaveCount(1);

    await page.unroute('**/socket.io/socket.io.js');
    await page.reload();
    await page.locator('.js-launcher').click();
    await page.locator('.js-nav-messages').click();
    await expect(page.locator('.msg.visitor').filter({ hasText: text })).toHaveCount(1);
  } finally {
    await context.close();
    await shop.close();
  }
});
