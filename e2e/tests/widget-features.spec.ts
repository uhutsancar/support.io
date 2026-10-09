// What a visitor can do in the widget beyond typing (plan v10 UX-04): pick
// an emoji, attach a file by dropping it or by pasting an image, see "seen"
// once the team has read the messages, find "(1)" in the page's tab when an
// answer arrives with the window closed, and drive it from the page through
// the documented command queue (open, close, on('message'), setLocale, hide,
// show). The site can hide the bubble on phones.

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

const SHOP_PORT = Number(process.env.E2E_SHOP_PORT) || 5185;
// A 1 × 1 transparent PNG.
const PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

/** Hands the widget a file the way a drop or a paste would. */
async function giveFile(page: Page, how: 'drop' | 'paste', name: string) {
  await page.evaluate(
    ({ how, name, png }) => {
      const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
      const file = new File([bytes], name, { type: 'image/png' });
      const data = new DataTransfer();
      data.items.add(file);
      const root = document.getElementById('support-chat-widget')!.shadowRoot!;
      if (how === 'paste') {
        const input = root.querySelector('.js-input')!;
        input.dispatchEvent(
          new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
        );
      } else {
        const panel = root.querySelector('.panel')!;
        panel.dispatchEvent(
          new DragEvent('dragover', { dataTransfer: data, bubbles: true, cancelable: true })
        );
        panel.dispatchEvent(
          new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true })
        );
      }
    },
    { how, name, png: PNG }
  );
}

test('emoji, drop and paste, seen, the tab title and the command queue', async ({
  browser,
  baseURL
}) => {
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `features${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${SHOP_PORT}`, title: 'Özellik Mağazası' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await owner.request.get('/api/sites')).json();
  const site = sites[0] as { _id: string; siteKey: string };

  const shop = await customerWebsite(
    SHOP_PORT,
    `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );
  const visitor = await (await browser.newContext()).newPage();
  try {
    await visitor.goto(shop.url);
    const launcher = visitor.locator('.js-launcher');
    await expect(launcher).toBeVisible();
    const baseTitle = await visitor.title();

    await test.step('the page opens it through the command queue', async () => {
      await visitor.evaluate(() => {
        (window as any).__messages = [];
        (window as any).SupportChat.q.push([
          'on',
          'message',
          (e: { message: { content: string } }) =>
            (window as any).__messages.push(e.message.content)
        ]);
        (window as any).SupportChat.q.push(['open']);
      });
      await expect(launcher).toHaveAttribute('aria-expanded', 'true');
      await visitor.locator('.js-start').click();
    });

    await test.step('an emoji goes where the cursor is', async () => {
      const input = visitor.locator('.js-input');
      await input.fill('Merhaba ');
      await visitor.locator('.js-emoji').click();
      await expect(visitor.locator('.js-emoji')).toHaveAttribute('aria-expanded', 'true');
      await visitor.locator('.js-emoji-pop button').first().click();
      await expect(input).toHaveValue('Merhaba 😀');
      await expect(visitor.locator('.js-emoji-pop')).toBeHidden();
      await expect(input).toBeFocused();
      await visitor.locator('.js-emoji').click();
      await visitor.keyboard.press('Escape');
      await expect(visitor.locator('.js-emoji-pop')).toBeHidden();
      await expect(launcher).toHaveAttribute('aria-expanded', 'true');
    });

    await test.step('a dropped file and a pasted image are attached', async () => {
      await giveFile(visitor, 'drop', 'birakilan.png');
      await expect(visitor.locator('.js-file-name')).toHaveText('birakilan.png');
      await visitor.locator('.js-file-clear').click();
      await giveFile(visitor, 'paste', 'yapistirilan.png');
      await expect(visitor.locator('.js-file-name')).toHaveText('yapistirilan.png');
      await visitor.locator('.js-file-clear').click();
    });

    await test.step('the message goes, and "seen" appears once the team reads it', async () => {
      await visitor.locator('.js-send').click();
      const sent = visitor.locator('.msg.visitor').filter({ hasText: 'Merhaba 😀' });
      await expect(sent).not.toHaveClass(/pending|failed/);
      await expect(visitor.locator('.seen')).toHaveCount(0);

      await owner.goto('/dashboard/conversations');
      await owner
        .locator('div.cursor-pointer')
        .filter({ hasText: `127.0.0.1:${SHOP_PORT}` })
        .first()
        .click();
      await expect(sent.locator('.seen')).toHaveText('Görüldü');
    });

    await test.step('an answer with the window closed: badge, tab title, on(message)', async () => {
      await visitor.evaluate(() => (window as any).SupportChat.q.push(['close']));
      await expect(launcher).toHaveAttribute('aria-expanded', 'false');
      const claim = owner.getByRole('button', { name: 'Talebi Üzerime Al' });
      if (await claim.isVisible().catch(() => false)) await claim.click();
      await owner.getByPlaceholder(/^Mesajınızı yazın/).fill('Size nasıl yardımcı olabilirim?');
      await owner.getByPlaceholder(/^Mesajınızı yazın/).press('Enter');
      await expect.poll(() => visitor.title()).toBe(`(1) ${baseTitle}`);
      await expect(visitor.locator('.badge')).toHaveText('1');
      expect(await visitor.evaluate(() => (window as any).__messages)).toContain(
        'Size nasıl yardımcı olabilirim?'
      );
      await visitor.evaluate(() => (window as any).SupportChat.q.push(['open']));
      await expect.poll(() => visitor.title()).toBe(baseTitle);
    });

    await test.step('setLocale, hide and show from the page', async () => {
      await visitor.evaluate(() => (window as any).SupportChat.q.push(['setLocale', 'en']));
      // The widget's own words change; the site's own welcome and placeholder
      // are the owner's and stay as written.
      await expect(visitor.locator('.js-send')).toHaveAttribute('aria-label', 'Send');
      await expect(visitor.locator('.js-emoji')).toHaveAttribute('aria-label', 'Add an emoji');
      await visitor.evaluate(() => (window as any).SupportChat.q.push(['hide']));
      await expect(launcher).toBeHidden();
      await expect(visitor.locator('.panel')).toBeHidden();
      await visitor.evaluate(() => (window as any).SupportChat.q.push(['show']));
      await expect(launcher).toBeVisible();
    });
  } finally {
    await shop.close();
  }

  await test.step('the site hides the bubble on phones', async () => {
    const saved = await owner.request.put(`/api/widget-config/site/${site._id}`, {
      headers: csrf,
      data: { behavior: { hideOnMobile: true } }
    });
    expect(saved.status(), await saved.text()).toBe(200);
    const again = await customerWebsite(
      SHOP_PORT,
      `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
    );
    try {
      const phone = await (
        await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true })
      ).newPage();
      await phone.goto(again.url);
      // Drawn but hidden, as on a page the site excluded.
      await expect(phone.locator('#support-chat-widget')).toBeAttached();
      await phone.waitForTimeout(1500);
      await expect(phone.locator('.js-launcher')).toBeHidden();
      const desktop = await (await browser.newContext()).newPage();
      await desktop.goto(again.url);
      await expect(desktop.locator('.js-launcher')).toBeVisible();
    } finally {
      await again.close();
    }
  });
});
