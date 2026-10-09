// Knowledge sources in the panel (plan v10 PRD-21): on the FAQ page an owner
// adds a page of their site — read in the background by the API's stand-in
// for the web (KNOWLEDGE_TRANSPORT=memory) — uploads a PDF, and removes a
// source. axe finds nothing serious on the page.

import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ownerThroughApi } from './support';

const PDF = path.join(__dirname, '..', '..', 'backend', 'tests', 'fixtures', 'kargo-rehberi.pdf');

test('a page and a PDF become what the assistant knows', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const domain = `bilgi${Date.now()}.example`;
  const { csrf } = await ownerThroughApi(page.request, {
    email: `knowledge${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `https://${domain}`, title: 'Bilgi Mağazası' }
  });
  expect(onboarded.ok()).toBeTruthy();
  for (const [url, body, contentType] of [
    [`https://${domain}/robots.txt`, 'User-agent: *\nAllow: /', 'text/plain'],
    [
      `https://${domain}/kargo`,
      '<html><head><title>Kargo ve teslimat</title></head><body><main><h1>Kargo</h1><p>Siparişler 2 iş günü içinde kargoya verilir; 500 TL üzeri kargo ücretsizdir.</p></main></body></html>',
      'text/html; charset=utf-8'
    ]
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const res = await page.request.post('/api/dev/knowledge-pages', {
      headers: csrf,
      data: { url, body, contentType }
    });
    expect(res.status()).toBe(204);
  }

  await page.goto('/dashboard/faqs');
  const card = page.locator('section', {
    has: page.getByRole('heading', { name: 'Asistanın bilgi kaynakları' })
  });
  await expect(card).toBeVisible();
  await expect(card.getByText('0 / 50 kaynak', { exact: false })).toBeVisible();

  await test.step('a page of the site is read in the background', async () => {
    await card.getByLabel('Sitenizden bir sayfa').fill(`https://${domain}/kargo`);
    await card.getByRole('button', { name: 'Sayfayı ekle' }).click();
    await expect(card.getByText('Kargo ve teslimat')).toBeVisible();
    await expect(card.getByText(/^Hazır · \d+ karakter$/)).toBeVisible();
  });

  await test.step('a page of another site is refused', async () => {
    await card.getByLabel('Sitenizden bir sayfa').fill('https://other.example/page');
    await card.getByRole('button', { name: 'Sayfayı ekle' }).click();
    await expect(page.getByText('Yalnızca bu sitenin sayfaları eklenebilir.')).toBeVisible();
  });

  await test.step('a PDF is read at once', async () => {
    await card.locator('input[type="file"]').setInputFiles(PDF);
    await expect(card.getByText('kargo-rehberi.pdf')).toBeVisible();
    await expect(card.getByText(/^Hazır · \d+ karakter$/)).toHaveCount(2);
    await expect(card.getByText('2 / 50 kaynak', { exact: false })).toBeVisible();
  });

  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
  ).toEqual([]);

  await test.step('a source is removed', async () => {
    await card.getByRole('button', { name: 'kargo-rehberi.pdf kaldır' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Kaldır' }).click();
    await expect(card.getByText('kargo-rehberi.pdf')).toHaveCount(0);
    await expect(card.getByText('1 / 50 kaynak', { exact: false })).toBeVisible();
  });
});
