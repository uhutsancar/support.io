// The panel as an app (plan v10 PRD-09): the manifest, the service worker
// the panel registers, a push turned into a notification that opens the
// conversation, the device switch in the settings, and — on the built panel —
// the dashboard opening without a network.
//
// The push is handed to the worker through Chrome's DevTools protocol, the
// way a push service would deliver it; no real push service is involved.

import { expect, test } from '@playwright/test';
import { ownerThroughApi } from './support';

test('the panel installs as an app and shows the pushes it receives', async ({
  browser,
  baseURL,
  browserName
}) => {
  test.skip(browserName !== 'chromium', 'push delivery goes through Chrome DevTools');
  const context = await browser.newContext();
  const page = await context.newPage();
  const { csrf } = await ownerThroughApi(page.request, {
    email: `pwa${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: 'https://pwa.example', title: 'Uygulama' }
  });
  expect(onboarded.ok()).toBeTruthy();

  await test.step('the manifest makes it installable', async () => {
    const manifest = await (await page.request.get('/site.webmanifest')).json();
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('/dashboard');
    expect(manifest.scope).toBe('/');
    expect(manifest.icons.map((icon: { sizes: string }) => icon.sizes)).toEqual(
      expect.arrayContaining(['192x192', '512x512'])
    );
  });

  const origin = new URL(baseURL!).origin;
  await page.goto('/dashboard');
  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(scope).toBe(`${origin}/`);

  await test.step('a push becomes a notification that opens the conversation', async () => {
    await context.grantPermissions(['notifications'], { origin });
    const cdp = await context.newCDPSession(page);
    const registrationId = new Promise<string>((resolve) => {
      cdp.on('ServiceWorker.workerRegistrationUpdated', (event) => {
        const found = event.registrations.find((r) => r.scopeURL === scope && !r.isDeleted);
        if (found) resolve(found.registrationId);
      });
    });
    await cdp.send('ServiceWorker.enable');
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin,
      registrationId: await registrationId,
      data: JSON.stringify({
        title: 'Yeni konuşma',
        body: 'Ayşe',
        url: '/dashboard/conversations?conversation=abc123',
        tag: 'conversation-abc123'
      })
    });
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const registration = await navigator.serviceWorker.ready;
          return (await registration.getNotifications()).map((n) => [
            n.title,
            n.body,
            n.tag,
            n.data?.url
          ]);
        })
      )
      .toEqual([
        [
          'Yeni konuşma',
          'Ayşe',
          'conversation-abc123',
          '/dashboard/conversations?conversation=abc123'
        ]
      ]);
  });

  await test.step('the settings offer push on this device', async () => {
    const config = await (await page.request.get('/api/push/config')).json();
    if (!config.enabled) {
      // A server without VAPID keys offers no push; the switch is hidden.
      test.info().annotations.push({ type: 'not run', description: 'the server has no push keys' });
      return;
    }
    await page.goto('/dashboard/settings#notifications');
    await expect(page.getByText('Bu cihazda anlık bildirim')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bu cihazda aç' })).toBeVisible();
  });

  await test.step('without a network the dashboard says so, and comes back by itself', async () => {
    await page.goto('/dashboard');
    const built = (await page.locator('script[src*="/assets/"]').count()) > 0;
    if (!built) {
      // Only this step: the development server has no built files to keep.
      test
        .info()
        .annotations.push({ type: 'not run', description: 'offline step needs the built panel' });
      return;
    }
    await page.reload();
    await context.setOffline(true);
    try {
      await page.goto('/dashboard/conversations').catch(() => undefined);
      await expect(page.getByRole('heading', { name: 'Bağlantı yok' })).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
    // Back online, it reloads by itself into the dashboard.
    await expect(page.getByRole('heading', { name: 'Konuşmalar' })).toBeVisible({
      timeout: 20_000
    });
  });
});
