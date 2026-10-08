// The AI assistant in the browser (plan v10 TST-01 #2), against the stand-in
// model (e2e/fake-gemini.mjs): a question the FAQ answers gets an answer
// marked as AI; asking for a person hands over; the agent takes over in the
// panel and the visitor gets the person's reply.
//
// Runs only when the API under test talks to the stand-in — E2E_FAKE_GEMINI=1,
// with the API started with GEMINI_API_KEY=test-key-not-a-real-one and
// GEMINI_BASE_URL pointing at it (CI does both). Against any other stack it
// is skipped, so no real model is ever called from a test.

import { expect, test } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

test.skip(!process.env.E2E_FAKE_GEMINI, 'needs the API pointed at e2e/fake-gemini.mjs');

test('the assistant answers from the FAQ, hands over, and the agent takes over', async ({
  browser,
  baseURL
}) => {
  const port = Number(process.env.E2E_SHOP_PORT) || 5193;
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `assistant${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${port}`, title: 'Asistan Sahibi' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await owner.request.get('/api/sites')).json();
  const site = sites[0] as { _id: string; siteKey: string };

  const faq = await owner.request.post('/api/faqs/admin', {
    headers: csrf,
    data: {
      siteId: site._id,
      question: 'Kargo ne zaman gelir?',
      answer: 'Siparişler iki iş günü içinde kargoya verilir.',
      category: 'Kargo',
      isActive: true
    }
  });
  expect(faq.status(), await faq.text()).toBe(201);
  const enabled = await owner.request.put(`/api/sites/${site._id}`, {
    headers: csrf,
    data: { assistantEnabled: true, assistantConsent: true }
  });
  expect(enabled.status(), await enabled.text()).toBe(200);
  // Nobody online: the assistant takes the first word.
  await owner.request.put('/api/auth/status', { headers: csrf, data: { status: 'offline' } });

  const shop = await customerWebsite(
    port,
    `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );
  const visitor = await (await browser.newContext()).newPage();
  try {
    await visitor.goto(shop.url);
    await visitor.locator('.js-launcher').click();
    await visitor.locator('.js-start').click();
    const contact = visitor.locator('.js-contact-form');
    if (await contact.isVisible().catch(() => false)) {
      await contact.locator('input[name="email"]').fill('ziyaretci@example.com');
      await contact.locator('button[type="submit"]').click();
    }

    await test.step('a question the FAQ answers: an answer marked as AI', async () => {
      await visitor.locator('.js-input').fill('Kargo ne zaman gelir?');
      await visitor.locator('.js-send').click();
      const answer = visitor
        .locator('.msg')
        .filter({ hasText: 'Siparişler iki iş günü içinde kargoya verilir.' });
      await expect(answer).toBeVisible({ timeout: 30_000 });
      await expect(answer.locator('.msg-badge')).toHaveText('Yapay zekâ asistanı');
    });

    await test.step('asking for a person hands over', async () => {
      await visitor.locator('.js-input').fill('Bir temsilciyle görüşmek istiyorum');
      await visitor.locator('.js-send').click();
      await expect(visitor.locator('.js-assistant')).toBeHidden({ timeout: 30_000 });
    });

    await test.step('the agent takes over and answers', async () => {
      await owner.request.put('/api/auth/status', { headers: csrf, data: { status: 'online' } });
      await owner.goto('/dashboard/conversations');
      await owner
        .locator('div.cursor-pointer')
        .filter({ hasText: `127.0.0.1:${port}` })
        .first()
        .click();
      const takeOver = owner.getByRole('button', { name: 'Devral' });
      if (await takeOver.isVisible().catch(() => false)) await takeOver.click();
      const claim = owner.getByRole('button', { name: 'Talebi Üzerime Al' });
      if (await claim.isVisible().catch(() => false)) await claim.click();
      const box = owner.getByPlaceholder(/^Mesajınızı yazın/);
      await box.fill('Merhaba, ben Ayşe. Hemen yardımcı oluyorum.');
      await box.press('Enter');
      await expect(
        visitor.locator('.msg.agent').filter({ hasText: 'Merhaba, ben Ayşe.' })
      ).toBeVisible();
    });
  } finally {
    await shop.close();
  }
});
