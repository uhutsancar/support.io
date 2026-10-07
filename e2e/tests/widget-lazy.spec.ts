// The widget opens its socket only when it is needed (plan v10 PERF-02):
// a page with the install code draws the bubble, says "present" with one
// small request (the panel's live visitor list) and opens no connection;
// opening the bubble connects, and a message goes through.

import { expect, test } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

const SHOP_PORT = Number(process.env.E2E_SHOP_PORT) || 5182;

test('no socket until the visitor opens the widget', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { csrf } = await ownerThroughApi(page.request, {
    email: `lazy${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const created = await page.request.post('/api/sites', {
    headers: csrf,
    data: { name: 'Tembel Mağaza', domain: `127.0.0.1:${SHOP_PORT}` }
  });
  expect(created.status()).toBe(201);
  const { site } = (await created.json()) as { site: { siteKey: string } };
  const shop = await customerWebsite(
    SHOP_PORT,
    `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );

  const visitor = await (await browser.newContext()).newPage();
  const sockets: string[] = [];
  const polling: string[] = [];
  visitor.on('websocket', (ws) => sockets.push(ws.url()));
  visitor.on('request', (r) => {
    if (r.url().includes('/socket.io/')) polling.push(r.url());
  });
  try {
    const presence = visitor.waitForResponse((r) => r.url().endsWith('/api/widget/presence'));
    await visitor.goto(shop.url);
    await expect(visitor.locator('.js-launcher')).toBeVisible();
    expect((await presence).status()).toBe(204);
    // Time for anything that would connect on its own.
    await visitor.waitForTimeout(3000);
    expect(sockets).toEqual([]);
    expect(polling).toEqual([]);

    await test.step('opening the widget connects, and a message goes through', async () => {
      const connected = visitor.waitForEvent('websocket');
      await visitor.locator('.js-launcher').click();
      await connected;
      await visitor.locator('.js-start').click();
      await visitor.locator('.js-input').fill('Merhaba, kargo ne zaman gelir?');
      await visitor.locator('.js-send').click();
      const sent = visitor.locator('.msg.visitor').filter({ hasText: 'kargo ne zaman gelir' });
      await expect(sent).toBeVisible();
      // Delivered, not just drawn: the "sending" state is gone.
      await expect(sent).not.toHaveClass(/pending|failed/);
    });
  } finally {
    await shop.close();
  }
});
