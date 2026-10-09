// The widget on phones and tablets (plan v10 UX-03). Runs in the iphone-14,
// pixel-7 and ipad projects (playwright.config.ts).
//
// On a phone (under 480 px) the open window fills the screen and follows the
// visual viewport, the page behind it stops scrolling, a message goes
// through, and the back button closes the window without leaving the page;
// closing with the close button takes its history entry away again. On a
// tablet the window stays a window and the page is left alone.

import { expect, test } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

const SHOP_PORT = Number(process.env.E2E_SHOP_PORT) || 5184;

test('the widget on a phone or a tablet', async ({ browser, baseURL }, testInfo) => {
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `mobile${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${SHOP_PORT}`, title: 'Mobil Mağaza' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await owner.request.get('/api/sites')).json();

  // A page long enough to scroll.
  const filler = Array.from({ length: 60 }, (_, i) => `<p>Ürün ${i + 1}</p>`).join('');
  const shop = await customerWebsite(
    SHOP_PORT,
    `<main><h1>Mağaza</h1>${filler}</main><script src="${baseURL}/widget.js" data-site-key="${sites[0].siteKey}" async></script>`
  );
  const visitor = await browser.newPage({ ...testInfo.project.use });
  try {
    await visitor.goto(shop.url);
    const launcher = visitor.locator('.js-launcher');
    await expect(launcher).toBeVisible();
    const viewport = visitor.viewportSize()!;
    const phone = viewport.width <= 480;
    const historyBefore = await visitor.evaluate(() => history.length);

    await launcher.click();
    await expect(launcher).toHaveAttribute('aria-expanded', 'true');
    const panel = visitor.locator('.panel');
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    const overflow = () => visitor.evaluate(() => document.documentElement.style.overflow);

    if (phone) {
      await test.step('full screen, page behind locked', async () => {
        expect(Math.round(box.width)).toBe(viewport.width);
        const visible = await visitor.evaluate(() =>
          Math.round(window.visualViewport ? window.visualViewport.height : innerHeight)
        );
        expect(Math.abs(Math.round(box.height) - visible)).toBeLessThanOrEqual(1);
        expect(await overflow()).toBe('hidden');
      });
    } else {
      await test.step('a window on a tablet, page untouched', async () => {
        expect(box.width).toBeLessThan(viewport.width);
        expect(await overflow()).toBe('');
      });
    }

    await test.step('a message goes through', async () => {
      await visitor.locator('.js-start').click();
      const input = visitor.locator('.js-input');
      await input.fill('Telefondan yazıyorum');
      await expect(input).toBeInViewport();
      await visitor.locator('.js-send').click();
      const sent = visitor.locator('.msg.visitor').filter({ hasText: 'Telefondan yazıyorum' });
      await expect(sent).toBeVisible();
      await expect(sent).not.toHaveClass(/pending|failed/);
    });

    if (phone) {
      await test.step('back closes the window, not the page', async () => {
        await visitor.goBack();
        await expect(launcher).toHaveAttribute('aria-expanded', 'false');
        expect(visitor.url()).toBe(shop.url);
        expect(await overflow()).toBe('');
      });

      await test.step('the close button takes its history entry away', async () => {
        await launcher.click();
        await expect(launcher).toHaveAttribute('aria-expanded', 'true');
        await visitor.locator('.js-close').click();
        await expect(launcher).toHaveAttribute('aria-expanded', 'false');
        await expect
          .poll(() => visitor.evaluate(() => Boolean(history.state && history.state.supportChat)))
          .toBe(false);
        expect(await visitor.evaluate(() => history.length)).toBeLessThanOrEqual(historyBefore + 2);
        expect(await overflow()).toBe('');
      });
    }
  } finally {
    await shop.close();
  }
});
