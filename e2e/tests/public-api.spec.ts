// The public API in the browser (plan v10 PRD-12): on Pro the settings say
// the API is an Enterprise feature; on Enterprise the owner creates a key,
// sees it once, the key reads the workspace through /api/v1, and revoked it
// stops. The API documentation page lists every endpoint of the OpenAPI
// document in both languages. axe runs on the section, the dialog and the
// documentation page.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ownerThroughApi, paidSubscription, shared } from './support';

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

test('an Enterprise owner makes a key, sees it once, uses it and revokes it', async ({
  browser
}) => {
  test.setTimeout(180_000);
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const { csrf } = await ownerThroughApi(page.request, {
    email: `apikey${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: 'https://api.example', title: 'API Sahibi' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const section = page.locator('section', {
    has: page.getByRole('heading', { name: 'API anahtarları' })
  });

  await test.step('on the Pro trial the API is an Enterprise feature', async () => {
    await page.goto('/dashboard/settings');
    await expect(section.getByText('API, Kurumsal planda.', { exact: false })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Anahtar oluştur' })).toHaveCount(0);
  });

  const me = await (await page.request.get('/api/auth/me')).json();
  const event = paidSubscription(String(me.user.organizationId), {
    price: shared('PADDLE_PRICE_ENTERPRISE', 'pri_local_enterprise')
  });
  const paid = await page.request.post('/api/billing/paddle/webhook', {
    headers: { 'Content-Type': 'application/json', 'Paddle-Signature': event.signature },
    data: event.body
  });
  expect(paid.status()).toBe(200);

  let secret = '';
  await test.step('the key is shown once', async () => {
    await page.reload();
    await expect(section.getByRole('button', { name: 'Anahtar oluştur' })).toBeVisible();
    expect(await seriousProblems(page, 'main')).toEqual([]);
    await section.getByLabel('Anahtarın adı').fill('Sipariş sistemi');
    await section.getByRole('button', { name: 'Anahtar oluştur' }).click();
    const dialog = page.getByRole('dialog', { name: 'Anahtarınız hazır' });
    await expect(dialog).toBeVisible();
    expect(await seriousProblems(page, '[role="dialog"]')).toEqual([]);
    secret = (await dialog.locator('code').textContent()) ?? '';
    expect(secret).toMatch(/^sk_live_[A-Za-z0-9_-]{40}$/);
    await dialog.getByRole('button', { name: 'Kopyaladım' }).click();
    await expect(dialog).toBeHidden();
    await expect(section.getByText('Sipariş sistemi')).toBeVisible();
    await expect(section.getByText('Yalnızca okuma')).toBeVisible();
    await page.reload();
    await expect(section.getByText('Sipariş sistemi')).toBeVisible();
    expect(await page.content()).not.toContain(secret);
  });

  await test.step('the key reads the workspace; writing needs the write scope', async () => {
    const auth = { Authorization: `Bearer ${secret}` };
    const sites = await page.request.get('/api/v1/sites', { headers: auth });
    expect(sites.status()).toBe(200);
    const { data } = await sites.json();
    expect(data).toHaveLength(1);
    expect(data[0].domain).toContain('api.example');
    const faq = await page.request.post('/api/v1/faqs', {
      headers: auth,
      data: { siteId: data[0].id, question: 'x', answer: 'y' }
    });
    expect(faq.status()).toBe(403);
  });

  await test.step('revoked, it stops at once', async () => {
    await section.getByRole('button', { name: 'İptal et' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'İptal et' }).click();
    await expect(section.getByText(/tarihinde iptal edildi/)).toBeVisible();
    const after = await page.request.get('/api/v1/sites', {
      headers: { Authorization: `Bearer ${secret}` }
    });
    expect(after.status()).toBe(401);
  });
});

test('the API documentation lists every endpoint, in both languages', async ({ browser }) => {
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const doc = await (await page.request.get('/api/v1/openapi.json')).json();
  const operations = Object.values(doc.paths as Record<string, Record<string, unknown>>).flatMap(
    (item) => Object.keys(item)
  ).length;

  await page.goto('/dokumantasyon/api');
  await expect(page.getByRole('heading', { level: 1, name: 'Support.io API' })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(operations);
  await expect(page.getByRole('heading', { name: 'Konuşmalar' })).toBeVisible();
  await expect(page.getByText('/api/v1/conversations/{id}/messages').first()).toBeVisible();
  // The address is the public one, never the developer's machine.
  await expect(page.getByText(/localhost/)).toHaveCount(0);
  expect(await seriousProblems(page)).toEqual([]);

  await page.goto('/dokumantasyon');
  await page.getByRole('link', { name: 'API belgelerini açın' }).click();
  await expect(page).toHaveURL(/\/dokumantasyon\/api$/);

  await page.goto('/en/documentation/api');
  await expect(page.getByRole('heading', { name: 'Conversations', exact: true })).toBeVisible();
  await expect(page.getByText('Reply to the visitor.', { exact: false })).toBeVisible();
  await expect(page.locator('article')).toHaveCount(operations);
});
