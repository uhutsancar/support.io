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
  // Vite emits this event from its production preload helper; its development
  // server uses a direct import and cannot reproduce the event by aborting a
  // source-module request. Put the requested route in the address first, then
  // exercise the exact production recovery event.
  const reloaded = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    window.history.pushState({}, '', '/dashboard/analytics');
    const event = new Event('vite:preloadError', { cancelable: true }) as Event & {
      payload?: Error;
    };
    event.payload = new Error('Failed to fetch dynamically imported module');
    window.dispatchEvent(event);
  });
  await reloaded;
  await expect(page).toHaveURL(/\/dashboard\/analytics$/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Analizler|Analitik/ })).toBeVisible({
    timeout: 30_000
  });
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('supbort:preload-reload-attempted')))
    .toBe('1');
});
