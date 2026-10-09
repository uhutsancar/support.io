// The help center (plan v10 PRD-10): the owner publishes it from the FAQ
// page, the public page lists and searches the articles (and passes axe),
// and in the chat bubble the matching articles come up while the visitor
// types — before anything reaches a person or the assistant.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

async function seriousProblems(page: Page, include?: string) {
  let builder = new AxeBuilder({ page }).withTags([
    'wcag2a',
    'wcag2aa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa'
  ]);
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

test('published from the FAQ page, read on its own address, suggested in the bubble', async ({
  browser,
  baseURL
}) => {
  test.setTimeout(180_000);
  const port = (Number(process.env.E2E_SHOP_PORT) || 5187) + 11;
  const owner = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `help${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${port}`, title: 'Yardım' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await owner.request.get('/api/sites')).json();
  const site = sites[0] as { _id: string; siteKey: string };
  for (const [question, answer, category] of [
    ['Kargom ne zaman gelir?', 'Siparişler 2 iş gününde kargoya verilir.', 'Kargo'],
    ['İade nasıl yapılır?', 'İade için 14 gün içinde bize yazın.', 'İade']
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const created = await owner.request.post('/api/faqs/admin', {
      headers: csrf,
      data: { siteId: site._id, question, answer, category, isActive: true }
    });
    // eslint-disable-next-line no-await-in-loop
    expect(created.status(), await created.text()).toBe(201);
  }
  const slug = `yardim-${Date.now().toString(36)}`;

  await test.step('the owner publishes it from the FAQ page', async () => {
    await owner.goto('/dashboard/faqs');
    const card = owner.getByRole('region', { name: 'Yardım merkezi' });
    await expect(card).toBeVisible();
    await card.getByLabel('Adres').fill(slug);
    await card.getByRole('button', { name: 'Yayınla' }).click();
    await expect(card.getByRole('link', { name: 'Sayfayı aç' })).toBeVisible();
    expect(await seriousProblems(owner, 'main')).toEqual([]);
  });

  await test.step('the public page: articles, search, no serious axe problem', async () => {
    const visitor = await (await browser.newContext()).newPage();
    await visitor.goto(`/help/${slug}`);
    await expect(visitor.getByRole('heading', { level: 1, name: 'Yardım Merkezi' })).toBeVisible();
    await expect(visitor.getByText('Kargom ne zaman gelir?')).toBeVisible();
    await expect(visitor.getByText('İade nasıl yapılır?')).toBeVisible();
    expect(await seriousProblems(visitor)).toEqual([]);
    await visitor.getByRole('searchbox', { name: 'Yardım konularında ara' }).fill('iadeler');
    await visitor.getByRole('button', { name: 'Ara' }).click();
    await expect(visitor.getByRole('status')).toContainText('1 sonuç');
    await expect(visitor.getByText('Kargom ne zaman gelir?')).toHaveCount(0);
  });

  await test.step('the bubble suggests the matching article while the visitor types', async () => {
    const shop = await customerWebsite(
      port,
      `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
    );
    try {
      const visitor = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
      await visitor.goto(shop.url);
      await visitor.locator('.js-launcher').click();
      await visitor.locator('.js-start').click();
      await visitor.locator('.js-input').fill('kargom hala gelmedi');
      const suggestion = visitor.getByRole('button', { name: 'Kargom ne zaman gelir?' });
      await expect(suggestion).toBeVisible();
      expect(await seriousProblems(visitor, '#support-chat-widget')).toEqual([]);
      await suggestion.click();
      await expect(visitor.getByText('Siparişler 2 iş gününde kargoya verilir.')).toBeVisible();
      await expect(visitor.getByRole('link', { name: 'Yardım merkezinin tamamı' })).toHaveAttribute(
        'href',
        new RegExp(`/help/${slug}$`)
      );
    } finally {
      await shop.close();
    }
  });
});
