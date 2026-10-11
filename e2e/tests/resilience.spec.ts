// Route failures stay inside the page shell, and a stale deploy chunk gets
// exactly one automatic refresh before the localized fallback takes over.

import { expect, test } from '@playwright/test';
import { ownerThroughApi } from './support';

async function onboard(page: import('@playwright/test').Page, label: string) {
  const { csrf } = await ownerThroughApi(page.request, {
    email: `${label}${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const response = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `https://${label}-${Date.now()}.example`, title: `${label} site` }
  });
  expect(response.ok()).toBeTruthy();
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: 'Konuşmalar' })).toBeVisible();
}

test('a route render error keeps the dashboard shell and reports telemetry', async ({ page }) => {
  await onboard(page, 'boundary');
  await page.route(/\/api\/conversations\/[a-f0-9]{24}(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ conversations: null, nextCursor: null, counts: {} })
    });
  });
  const reported = page.waitForRequest('**/api/telemetry/panel');

  await page.getByRole('link', { name: 'Konuşmalar' }).click();
  await expect(page).toHaveURL(/\/dashboard\/conversations$/);
  await expect(page.getByRole('alert')).toContainText('Bir şey ters gitti');
  await expect(page.getByRole('link', { name: 'Konuşmalar' })).toBeVisible();
  await reported;
});

test('one missing deploy chunk reloads once and opens the requested route', async ({ page }) => {
  await onboard(page, 'chunk');
  const chunk = /\/assets\/js\/Analytics-[^/]+\.js(?:\?|$)/;
  let blocked = 0;
  await page.route(chunk, async (route) => {
    blocked += 1;
    await page.unroute(chunk);
    await route.abort('failed');
  });

  await page.getByRole('link', { name: 'Analitik' }).click();
  await expect(page).toHaveURL(/\/dashboard\/analytics$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Analitik' })).toBeVisible({ timeout: 30_000 });
  expect(blocked).toBe(1);
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('supbort:preload-reload-attempted')))
    .toBe('1');
});
