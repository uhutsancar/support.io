// The inbox tools in the browser (plan v10 PRD-07): tagging a conversation
// and filtering by the tag, the keyboard (j/k and the "?" list), snoozing
// into the snoozed view, and a bulk resolve from the ticked rows. The dialogs
// are checked with axe while they are open (UX-02).

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

async function workspace(request: APIRequestContext, port: number) {
  const email = `inbox${Date.now()}${port}@e2e.test`;
  const { csrf } = await ownerThroughApi(request, { email, password: 'E2ePassw0rd!' });
  const onboarded = await request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${port}`, title: 'Gelen Kutusu' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await request.get('/api/sites')).json();
  return { csrf, site: sites[0] as { _id: string; siteKey: string } };
}

async function visitorSays(page: Page, url: string, text: string) {
  await page.goto(url);
  await page.locator('.js-launcher').click();
  await page.locator('.js-start').click();
  await page.locator('.js-input').fill(text);
  await page.locator('.js-send').click();
  await expect(page.locator('.msg.visitor').filter({ hasText: text })).not.toHaveClass(
    /pending|failed/
  );
}

/**
 * Serious axe problems on the page, or only inside `include`. A dialog is
 * scanned on its own: behind its dimmed backdrop every colour of the page
 * would fail the contrast rule, which says nothing about the page.
 */
/** Opens the conversation whose row shows , and waits until it is the selected row. */
async function openConversation(page: Page, text: string) {
  const row = page.locator('div.cursor-pointer', { hasText: text }).first();
  await row.click();
  await expect(row).toHaveClass(/bg-indigo-50/);
}

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

test('tags, the keyboard, snooze and a bulk resolve in the inbox', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const port = (Number(process.env.E2E_SHOP_PORT) || 5187) + 7;
  // Reduced motion: toasts and panels are drawn in their final state, so axe
  // never measures a colour halfway through a fade.
  const owner = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const { site } = await workspace(owner.request, port);
  const shop = await customerWebsite(
    port,
    `<script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );
  try {
    for (const text of ['Kargom nerede?', 'Fatura lazım']) {
      // eslint-disable-next-line no-await-in-loop
      const visitor = await (await browser.newContext()).newPage();
      // eslint-disable-next-line no-await-in-loop
      await visitorSays(visitor, shop.url, text);
    }

    await owner.goto('/dashboard/conversations');
    const rows = owner.locator('[aria-label$="konuşmasını seç"]');
    await expect(rows).toHaveCount(2);

    await test.step('the inbox with conversations in it: no serious axe problem', async () => {
      await openConversation(owner, 'Kargom nerede?');
      await expect(owner.getByRole('combobox', { name: 'Etiket ekle' })).toBeVisible();
      expect(await seriousProblems(owner)).toEqual([]);
    });

    await test.step('a tag on a conversation, then the filter', async () => {
      await openConversation(owner, 'Kargom nerede?');
      const box = owner.getByRole('combobox', { name: 'Etiket ekle' });
      await box.fill('Kargo');
      await box.press('Enter');
      await expect(owner.getByRole('button', { name: 'Kargo etiketini kaldır' })).toBeVisible();
      await owner.getByRole('combobox', { name: 'Etikete göre filtrele' }).selectOption('Kargo');
      await expect(rows).toHaveCount(1);
      await owner.getByRole('combobox', { name: 'Etikete göre filtrele' }).selectOption('all');
      await expect(rows).toHaveCount(2);
    });

    await test.step('the keyboard: "?" shows the list, j and k move', async () => {
      await owner.locator('h1').click();
      await owner.keyboard.press('?');
      const help = owner.getByRole('dialog', { name: 'Klavye kısayolları' });
      await expect(help).toBeVisible();
      expect(await seriousProblems(owner, '[role="dialog"]')).toEqual([]);
      await owner.keyboard.press('Escape');
      await expect(help).toBeHidden();

      // The open conversation is the older one, the last row: k moves up to
      // the newer one, j back down.
      const selectedTicket = () =>
        owner
          .locator('aside')
          .getByText(/^#\d+$/)
          .first()
          .innerText();
      const first = await selectedTicket();
      await owner.keyboard.press('k');
      await expect.poll(selectedTicket).not.toBe(first);
      await owner.keyboard.press('j');
      await expect.poll(selectedTicket).toBe(first);
    });

    await test.step('snooze: out of the inbox, into the snoozed view', async () => {
      await openConversation(owner, 'Fatura lazım');
      await owner.getByRole('button', { name: 'Ertele' }).click();
      await owner.getByRole('button', { name: /1 saat sonra/ }).click();
      await expect(rows).toHaveCount(1);
      await owner.getByRole('combobox', { name: 'Görünüm' }).selectOption('snoozed');
      await expect(rows).toHaveCount(1);
      await expect(owner.getByText(/tarihine kadar ertelendi/).first()).toBeVisible();
      await owner.getByRole('combobox', { name: 'Görünüm' }).selectOption('inbox');
      await expect(rows).toHaveCount(1);
    });

    await test.step('a bulk resolve from the ticked rows', async () => {
      await owner.getByRole('checkbox', { name: 'Görünenlerin tümünü seç' }).check();
      await expect(owner.getByText('1 konuşma seçildi').first()).toBeVisible();
      expect(await seriousProblems(owner)).toEqual([]);
      await owner.getByRole('button', { name: 'Çözüldü', exact: true }).click();
      await expect(owner.getByText('1 konuşma güncellendi')).toBeVisible();
      await expect(owner.getByText('1 konuşma seçildi')).toHaveCount(0);
    });

    await test.step('the merge dialog is a proper dialog', async () => {
      await openConversation(owner, 'Kargom nerede?');
      await owner.getByRole('button', { name: 'Birleştir' }).click();
      const dialog = owner.getByRole('dialog', { name: 'Başka bir konuşmayla birleştir' });
      await expect(dialog).toBeVisible();
      await expect(dialog.getByText(/birleştirilebilecek başka konuşması yok/)).toBeVisible();
      expect(await seriousProblems(owner, '[role="dialog"]')).toEqual([]);
      await owner.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
    });
  } finally {
    await shop.close();
  }
});
