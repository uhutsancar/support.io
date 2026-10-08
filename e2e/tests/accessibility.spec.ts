// Accessibility (plan v10 UX-01, UX-02): axe finds no serious or critical
// WCAG 2.2 AA problem in the widget (closed, open, in a conversation) or on
// the panel's main pages, and the widget works from the keyboard — the
// bubble is a button that says whether it is open, Esc closes and gives the
// focus back, opening a conversation puts the focus in the message box, and
// only the other side's messages are read out.

import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { APIRequestContext, Page } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

const SHOP_PORT = Number(process.env.E2E_SHOP_PORT) || 5183;
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

async function seriousProblems(page: Page, include?: string) {
  // Product mockups on the marketing pages are pictures of the panel, hidden
  // from screen readers; their small grey text is incidental (WCAG 1.4.3).
  let builder = new AxeBuilder({ page }).withTags(TAGS).exclude('[data-mockup]');
  if (include) builder = builder.include(include);
  const { violations } = await builder.analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

/** The page has drawn: live sockets keep the network busy for ever. */
async function settle(page: Page) {
  await page.waitForLoadState('load');
  await page.waitForTimeout(1500);
}

/** A verified, onboarded owner with one site on the test shop's address. */
async function onboardedOwner(request: APIRequestContext) {
  const { csrf } = await ownerThroughApi(request, {
    email: `a11y${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${SHOP_PORT}`, title: 'Erişilebilir Mağaza' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await request.get('/api/sites')).json();
  return { csrf, site: sites[0] as { _id: string; siteKey: string } };
}

test('the widget: no serious axe problem, keyboard, and what is read out', async ({
  browser,
  baseURL
}) => {
  const owner = await (await browser.newContext()).newPage();
  const { csrf, site } = await onboardedOwner(owner.request);
  // A mid-tone colour where white text used to fall to 3:1.
  const colour = await owner.request.put(`/api/widget-config/site/${site._id}`, {
    headers: csrf,
    data: { colors: { primary: '#3B82F6', header: '#3B82F6', visitorMessageBg: '#3B82F6' } }
  });
  expect(colour.status(), await colour.text()).toBe(200);

  const shop = await customerWebsite(
    SHOP_PORT,
    `<main><h1>Mağaza</h1><p>Ürünler</p></main><script src="${baseURL}/widget.js" data-site-key="${site.siteKey}" async></script>`
  );
  const visitor = await (await browser.newContext()).newPage();
  try {
    await visitor.goto(shop.url);
    const launcher = visitor.locator('.js-launcher');
    await expect(launcher).toBeVisible();
    await expect(launcher).toHaveAttribute('aria-expanded', 'false');
    expect(await seriousProblems(visitor, '#support-chat-widget')).toEqual([]);

    await test.step('the keyboard opens and closes it', async () => {
      await launcher.focus();
      await visitor.keyboard.press('Enter');
      await expect(launcher).toHaveAttribute('aria-expanded', 'true');
      await expect(visitor.locator('.panel')).toBeFocused();
      expect(await seriousProblems(visitor, '#support-chat-widget')).toEqual([]);
      await visitor.keyboard.press('Escape');
      await expect(launcher).toHaveAttribute('aria-expanded', 'false');
      await expect(launcher).toBeFocused();
    });

    await test.step('a conversation: focus in the box, own messages not read out', async () => {
      await launcher.click();
      await visitor.locator('.js-start').click();
      await expect(visitor.locator('.js-input')).toBeFocused();
      await visitor.locator('.js-input').fill('Kargom nerede?');
      await visitor.keyboard.press('Enter');
      const sent = visitor.locator('.msg.visitor').filter({ hasText: 'Kargom' });
      await expect(sent).toBeVisible();
      // Delivered: the faded "sending" look is a moment, not the page.
      await expect(sent).not.toHaveClass(/pending|failed/);
      await expect(visitor.locator('.js-messages')).toHaveAttribute('aria-live', 'off');
      await expect(visitor.locator('.js-announce')).toHaveText('');
      expect(await seriousProblems(visitor, '#support-chat-widget')).toEqual([]);
    });

    await test.step('a reply from the team is read out', async () => {
      await owner.goto('/dashboard/conversations');
      const item = owner
        .locator('div.cursor-pointer')
        .filter({ hasText: `127.0.0.1:${SHOP_PORT}` })
        .first();
      await item.click();
      const claim = owner.getByRole('button', { name: 'Talebi Üzerime Al' });
      if (await claim.isVisible().catch(() => false)) await claim.click();
      await owner.getByPlaceholder(/^Mesajınızı yazın/).fill('Hemen bakıyorum.');
      await owner.getByPlaceholder(/^Mesajınızı yazın/).press('Enter');
      await expect(
        visitor.locator('.msg.agent').filter({ hasText: 'Hemen bakıyorum' })
      ).toBeVisible();
      await expect(visitor.locator('.js-announce')).toHaveText(/: Hemen bakıyorum\.$/);
    });

    await test.step('white or dark text, whichever reads on the chosen colour', async () => {
      const ratio = await visitor.locator('.js-send').evaluate((el) => {
        const parse = (c: string) => (c.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
        const lum = ([r, g, b]: number[]) => {
          const f = (v: number) => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const style = getComputedStyle(el);
        const a = lum(parse(style.color));
        const b = lum(parse(style.backgroundColor));
        return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      });
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    await test.step('touch targets are at least 44 px', async () => {
      for (const selector of ['.js-close', '.js-send']) {
        const box = await visitor.locator(selector).first().boundingBox();
        expect(box, selector).not.toBeNull();
        expect(Math.min(box!.width, box!.height), selector).toBeGreaterThanOrEqual(44);
      }
    });
  } finally {
    await shop.close();
  }
});

test('the panel: no serious axe problem on its pages', async ({ browser }) => {
  test.setTimeout(300_000);
  // Reduced motion: the pages draw their final state at once, so axe does
  // not judge a bubble halfway through fading in.
  const visitorPages = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  for (const path of [
    '/',
    '/ozellikler',
    '/yapay-zeka',
    '/fiyatlandirma',
    '/dokumantasyon',
    '/erisilebilirlik',
    '/yapay-zeka-kullanimi',
    '/en/accessibility',
    '/login',
    '/register'
  ]) {
    await visitorPages.goto(path);
    await settle(visitorPages);
    expect(await seriousProblems(visitorPages), path).toEqual([]);
  }

  const owner = await (await browser.newContext()).newPage();
  await onboardedOwner(owner.request);
  const { sites } = await (await owner.request.get('/api/sites')).json();
  // Every page of the panel (UX-02), not only the ones a customer meets first.
  const found: Record<string, string[]> = {};
  for (const path of [
    '/dashboard',
    '/dashboard/conversations',
    '/dashboard/settings',
    '/dashboard/billing',
    '/dashboard/upgrade',
    '/dashboard/sites',
    `/dashboard/widget-customization/${sites[0]._id}`,
    '/dashboard/faqs',
    '/dashboard/assistant',
    '/dashboard/team',
    '/dashboard/team-chat',
    '/dashboard/departments',
    '/dashboard/assigned',
    '/dashboard/analytics',
    '/dashboard/my-performance',
    '/dashboard/visitors',
    '/dashboard/crm',
    '/dashboard/integrations',
    '/dashboard/automation-rules',
    '/dashboard/proactive-rules',
    '/dashboard/audit-logs'
  ]) {
    await owner.goto(path);
    await settle(owner);
    await expect(owner.locator('main')).toBeVisible();
    const problems = await seriousProblems(owner);
    if (problems.length) found[path] = problems;
  }
  // Every page's problems at once, not only the first page's.
  expect(found).toEqual({});
});
