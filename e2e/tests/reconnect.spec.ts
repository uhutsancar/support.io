// The network goes away mid-conversation (plan v10 TST-01 #13): what the
// visitor writes waits as "sending", goes out once the network is back, and
// the conversation holds it exactly once — on the visitor's screen, after a
// reload, and in the panel's API.

import { expect, test } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

test('a message written offline is sent once the network is back, once', async ({
  browser,
  baseURL
}) => {
  const port = Number(process.env.E2E_SHOP_PORT) || 5192;
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `reconnect${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${port}`, title: 'Bağlantı Sahibi' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await owner.request.get('/api/sites')).json();
  const site = sites[0] as { _id: string; siteKey: string };

  const shop = await customerWebsite(
    port,
    `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );
  const context = await browser.newContext();
  const visitor = await context.newPage();
  try {
    await visitor.goto(shop.url);
    await visitor.locator('.js-launcher').click();
    await visitor.locator('.js-start').click();
    await visitor.locator('.js-input').fill('İlk mesaj');
    await visitor.locator('.js-send').click();
    await expect(visitor.locator('.msg.visitor').filter({ hasText: 'İlk mesaj' })).not.toHaveClass(
      /pending|failed/
    );

    await context.setOffline(true);
    const text = `Tünelden yazıyorum ${Date.now()}`;
    await visitor.locator('.js-input').fill(text);
    await visitor.locator('.js-send').click();
    const queued = visitor.locator('.msg.visitor').filter({ hasText: text });
    await expect(queued).toHaveClass(/pending/);
    await visitor.waitForTimeout(2000);
    await expect(queued).toHaveClass(/pending/);

    await context.setOffline(false);
    await expect(queued).not.toHaveClass(/pending|failed/, { timeout: 30_000 });
    await expect(visitor.locator('.msg.visitor').filter({ hasText: text })).toHaveCount(1);

    await visitor.reload();
    await visitor.locator('.js-launcher').click();
    await expect(visitor.locator('.msg.visitor').filter({ hasText: text })).toHaveCount(1);

    const conversations = await (await owner.request.get(`/api/conversations/${site._id}`)).json();
    const list = (conversations.conversations || conversations) as { _id: string }[];
    const messages = await (
      await owner.request.get(`/api/conversations/${site._id}/${list[0]._id}/messages`)
    ).json();
    const stored = ((messages.messages || messages) as { content: string }[]).filter(
      (m) => m.content === text
    );
    expect(stored).toHaveLength(1);
  } finally {
    await shop.close();
  }
});
