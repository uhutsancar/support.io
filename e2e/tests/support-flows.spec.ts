// The flows around a chat (plan v10 TST-01 #3–#7): nobody online — the
// offline form takes an address and the team is mailed about the unanswered
// chat; a required pre-chat form with a consent box comes before the first
// message; a saved reply goes in with "/"; a picture uploads and a fake one
// (an executable named .png) is refused; the visitor rates the chat once the
// agent closes it.

import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

// A 1 × 1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

async function workspace(request: APIRequestContext, port: number, settings?: object) {
  const email = `flows${Date.now()}${port}@e2e.test`;
  const { csrf } = await ownerThroughApi(request, { email, password: 'E2ePassw0rd!' });
  const onboarded = await request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${port}`, title: 'Akış Sahibi' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await request.get('/api/sites')).json();
  const site = sites[0] as { _id: string; siteKey: string; name: string };
  if (settings) {
    const saved = await request.put(`/api/sites/${site._id}/chat-settings`, {
      headers: csrf,
      data: settings
    });
    expect(saved.status(), await saved.text()).toBe(200);
  }
  return { email, csrf, site };
}

async function openWidget(page: Page, url: string) {
  await page.goto(url);
  await page.locator('.js-launcher').click();
  await page.locator('.js-start').click();
}

async function mails(request: APIRequestContext, to: string) {
  const res = await request.get(`/api/dev/outbox?to=${encodeURIComponent(to)}`);
  return ((await res.json()) as { mails: { subject: string; text: string }[] }).mails;
}

test('nobody online: the offline form, then the team hears about it by mail', async ({
  browser,
  baseURL
}) => {
  test.setTimeout(300_000);
  const port = Number(process.env.E2E_SHOP_PORT) || 5187;
  const owner = await (await browser.newContext()).newPage();
  const { email, csrf, site } = await workspace(owner.request, port, {
    missedChat: { delayMinutes: 1, notify: 'all' },
    offlineForm: true
  });
  // Signing up leaves the owner online; nobody is, for this test.
  const away = await owner.request.put('/api/auth/status', {
    headers: csrf,
    data: { status: 'offline' }
  });
  expect(away.ok()).toBeTruthy();
  const shop = await customerWebsite(
    port,
    `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );
  const visitor = await (await browser.newContext()).newPage();
  try {
    await openWidget(visitor, shop.url);
    await expect(visitor.getByText('Ekibimiz şu an çevrimdışı')).toBeVisible();
    await visitor.locator('.js-contact-form input[name="email"]').fill('ziyaretci@example.com');
    await visitor.locator('.js-contact-form button[type="submit"]').click();
    await visitor.locator('.js-input').fill('Siparişim nerede?');
    await visitor.locator('.js-send').click();
    await expect(visitor.locator('.msg.visitor').filter({ hasText: 'Siparişim' })).not.toHaveClass(
      /pending|failed/
    );
    // The sweep runs once a minute and the delay is one minute.
    await expect
      .poll(
        async () =>
          (await mails(owner.request, email)).some((m) => /yanıtlanmamış/.test(m.subject)),
        {
          timeout: 200_000,
          intervals: [5_000]
        }
      )
      .toBe(true);
  } finally {
    await shop.close();
  }
});

test('a required pre-chat form and consent box come first', async ({ browser, baseURL }) => {
  const port = (Number(process.env.E2E_SHOP_PORT) || 5187) + 1;
  const owner = await (await browser.newContext()).newPage();
  const { site } = await workspace(owner.request, port, {
    preChat: {
      mode: 'required',
      name: true,
      email: true,
      consent: { mode: 'required', policyUrl: 'https://example.com/kvkk' }
    }
  });
  const shop = await customerWebsite(
    port,
    `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );
  const visitor = await (await browser.newContext()).newPage();
  try {
    await openWidget(visitor, shop.url);
    const form = visitor.locator('.js-contact-form');
    await expect(form).toBeVisible();
    await expect(visitor.locator('.composer')).toHaveClass(/locked/);
    await form.locator('input[name="name"]').fill('Elif Yılmaz');
    await form.locator('input[name="email"]').fill('elif@example.com');
    await form.locator('button[type="submit"]').click();
    await expect(visitor.locator('#sc-err-consent')).not.toBeEmpty();
    await form.locator('input[name="consent"]').check();
    await form.locator('button[type="submit"]').click();
    await expect(visitor.locator('.composer')).not.toHaveClass(/locked/);
    await visitor.locator('.js-input').fill('Merhaba');
    await visitor.locator('.js-send').click();
    await expect(visitor.locator('.msg.visitor').filter({ hasText: 'Merhaba' })).not.toHaveClass(
      /pending|failed/
    );
    await expect
      .poll(async () => {
        const res = await owner.request.get(`/api/conversations/${site._id}`);
        const body = await res.json();
        const list = (body.conversations || body) as { visitorName?: string }[];
        return list.map((c) => c.visitorName);
      })
      .toContain('Elif Yılmaz');
  } finally {
    await shop.close();
  }
});

test('a saved reply with "/", a picture and a fake one, and a rating at the end', async ({
  browser,
  baseURL
}) => {
  const port = (Number(process.env.E2E_SHOP_PORT) || 5187) + 2;
  const owner = await (await browser.newContext()).newPage();
  const { csrf, site } = await workspace(owner.request, port);
  const reply = await owner.request.post('/api/saved-replies', {
    headers: csrf,
    data: { shortcut: 'kargo', title: 'Kargo durumu', body: 'Kargonuz yola çıktı, {{agent.name}}.' }
  });
  expect(reply.status(), await reply.text()).toBe(201);
  const shop = await customerWebsite(
    port,
    `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );
  const visitor = await (await browser.newContext()).newPage();
  try {
    await openWidget(visitor, shop.url);
    await visitor.locator('.js-input').fill('Kargom ne zaman gelir?');
    await visitor.locator('.js-send').click();
    await expect(visitor.locator('.msg.visitor').filter({ hasText: 'Kargom' })).not.toHaveClass(
      /pending|failed/
    );

    await test.step('a fake picture is refused, a real one goes through', async () => {
      const files = visitor.locator('.js-file-input');
      await files.setInputFiles({
        name: 'fatura.png',
        mimeType: 'image/png',
        buffer: Buffer.from('MZ\x90\x00 this is not a picture')
      });
      await visitor.locator('.js-send').click();
      // The server reads the bytes, not the name: the message stays unsent.
      await expect(
        visitor.locator('.msg.visitor.failed').filter({ hasText: 'fatura.png' })
      ).toBeVisible();
      await expect(visitor.locator('.msg.visitor img')).toHaveCount(0);
      await files.setInputFiles({ name: 'urun.png', mimeType: 'image/png', buffer: PNG });
      await visitor.locator('.js-send').click();
      await expect(
        visitor
          .locator('.msg.visitor')
          .filter({ has: visitor.locator('img, .file') })
          .last()
      ).not.toHaveClass(/pending|failed/);
    });

    await test.step('the agent answers with a saved reply', async () => {
      await owner.goto('/dashboard/conversations');
      await owner
        .locator('div.cursor-pointer')
        .filter({ hasText: `127.0.0.1:${port}` })
        .first()
        .click();
      const claim = owner.getByRole('button', { name: 'Talebi Üzerime Al' });
      if (await claim.isVisible().catch(() => false)) await claim.click();
      const box = owner.getByPlaceholder(/^Mesajınızı yazın/);
      await box.fill('/kar');
      await expect(owner.getByRole('option', { name: /Kargo durumu/ })).toBeVisible();
      await box.press('Enter');
      await expect(box).toHaveValue('Kargonuz yola çıktı, E2E Owner.');
      await box.press('Enter');
      await expect(
        visitor.locator('.msg.agent').filter({ hasText: 'Kargonuz yola çıktı, E2E Owner.' })
      ).toBeVisible();
    });

    await test.step('closed by the agent, rated by the visitor', async () => {
      await owner.getByLabel('Durumu değiştir').selectOption('closed');
      const card = visitor.locator('[role="group"]').filter({ has: visitor.locator('.js-rate') });
      await expect(card).toBeVisible();
      await card.locator('.choice').first().click();
      await card.locator('.js-rate-send').click();
      await expect(card.locator('.done')).toBeVisible();
      await expect
        .poll(async () => {
          const res = await owner.request.get(`/api/conversations/${site._id}`);
          const body = await res.json();
          const list = (body.conversations || body) as { rating?: { score?: number } | null }[];
          return list.some((c) => c.rating && c.rating.score);
        })
        .toBe(true);
    });
  } finally {
    await shop.close();
  }
});
