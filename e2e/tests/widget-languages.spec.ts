// The widget's languages in the browser (plan v10 PRD-16). Turkish and
// English are in the script; German, French, Spanish, Dutch, Russian and
// Arabic are fetched from our origin only when a visitor reads them. A site
// can fix the language in Widget Studio; otherwise the widget follows the
// page and the browser. Arabic runs right to left: the visitor's messages sit
// on the left, axe finds nothing serious.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

const BASE_PORT = Number(process.env.E2E_SHOP_PORT) || 5197;

async function siteOn(page: Page, port: number, label: string) {
  const { csrf } = await ownerThroughApi(page.request, {
    email: `${label}${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${port}`, title: `Dil ${label}` }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await page.request.get('/api/sites')).json();
  return { csrf, site: sites[0] as { _id: string; siteKey: string } };
}

const installCode = (baseURL: string, siteKey: string) =>
  `<script src="${baseURL}/widget.js" data-site-key="${siteKey}" async></script>`;

/** Requests for a language file, by code. */
function watchLocales(page: Page): string[] {
  const asked: string[] = [];
  page.on('request', (req) => {
    const match = /\/widget\/v4\/locales\/([a-z]{2})\.json$/.exec(req.url());
    if (match) asked.push(match[1]);
  });
  return asked;
}

test('a language fixed in Widget Studio, and back to automatic', async ({ browser, baseURL }) => {
  const port = BASE_PORT;
  const owner = await (await browser.newContext()).newPage();
  const { csrf, site } = await siteOn(owner, port, 'sabit');
  const setLanguage = async (language: string) => {
    const res = await owner.request.put(`/api/widget-config/site/${site._id}`, {
      headers: csrf,
      data: { behavior: { language } }
    });
    expect(res.status(), await res.text()).toBe(200);
  };
  await setLanguage('de');

  const shop = await customerWebsite(port, installCode(baseURL!, site.siteKey));
  try {
    const visitor = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
    const asked = watchLocales(visitor);
    await visitor.goto(shop.url);
    const launcher = visitor.locator('.js-launcher');
    await expect(launcher).toHaveAttribute('aria-label', 'Support-Chat öffnen');
    await expect(visitor.locator('.root')).toHaveAttribute('lang', 'de');
    await launcher.click();
    await expect(visitor.locator('.js-start')).toContainText('Unterhaltung beginnen');
    await visitor.locator('.js-start').click();
    await expect(visitor.locator('.msg.bot').first()).toContainText(
      'Hallo! Wie können wir Ihnen helfen?'
    );
    expect(asked).toEqual(['de']);

    await setLanguage('auto');
    const again = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
    const askedAgain = watchLocales(again);
    await again.goto(shop.url);
    await expect(again.locator('.js-launcher')).toHaveAttribute(
      'aria-label',
      'Destek sohbetini aç'
    );
    // Turkish is in the script: nothing more is downloaded.
    expect(askedAgain).toEqual([]);
  } finally {
    await shop.close();
  }
});

test('an Arabic page gets the widget in Arabic, right to left', async ({ browser, baseURL }) => {
  const port = BASE_PORT + 1;
  const owner = await (await browser.newContext()).newPage();
  const { site } = await siteOn(owner, port, 'arapca');
  const shop = await customerWebsite(port, installCode(baseURL!, site.siteKey), { lang: 'ar' });
  try {
    const visitor = await (
      await browser.newContext({ locale: 'ar', reducedMotion: 'reduce' })
    ).newPage();
    await visitor.goto(shop.url);
    const launcher = visitor.locator('.js-launcher');
    await expect(launcher).toHaveAttribute('aria-label', 'فتح محادثة الدعم');
    const root = visitor.locator('.root');
    await expect(root).toHaveAttribute('dir', 'rtl');
    await expect(root).toHaveAttribute('lang', 'ar');
    await launcher.click();
    await visitor.locator('.js-start').click();
    // The words onboarding wrote are ours, not the owner's: said in Arabic.
    await expect(visitor.locator('.js-input')).toHaveAttribute('placeholder', 'اكتب رسالتك...');
    await expect(visitor.locator('.msg.bot').first()).toContainText('مرحبًا! كيف يمكننا مساعدتك؟');
    await visitor.locator('.js-input').fill('مرحبا، أين طلبي؟');
    await visitor.locator('.js-send').click();
    const sent = visitor.locator('.msg.visitor').filter({ hasText: 'أين طلبي' });
    await expect(sent).not.toHaveClass(/pending|failed/);

    // The visitor's own message sits on the start side, which is the left.
    const panel = await visitor.locator('.panel').boundingBox();
    const bubble = await sent.locator('.bubble').boundingBox();
    expect(bubble!.x + bubble!.width / 2).toBeLessThan(panel!.x + panel!.width / 2);

    const { violations } = await new AxeBuilder({ page: visitor })
      .include('#support-chat-widget')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(
      violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id)
    ).toEqual([]);
  } finally {
    await shop.close();
  }
});

test('the page switches the language through the command queue', async ({ browser, baseURL }) => {
  const port = BASE_PORT + 2;
  const owner = await (await browser.newContext()).newPage();
  const { site } = await siteOn(owner, port, 'komut');
  const shop = await customerWebsite(port, installCode(baseURL!, site.siteKey));
  try {
    const visitor = await (await browser.newContext({ locale: 'tr-TR' })).newPage();
    await visitor.goto(shop.url);
    const launcher = visitor.locator('.js-launcher');
    await expect(launcher).toHaveAttribute('aria-label', 'Destek sohbetini aç');
    for (const [code, label] of [
      ['fr', 'Ouvrir le chat d’assistance'],
      ['ru', 'Открыть чат поддержки'],
      ['es', 'Abrir el chat de soporte'],
      ['nl', 'Supportchat openen'],
      ['en', 'Open support chat']
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await visitor.evaluate((c) => (window as any).SupportChat.q.push(['setLocale', c]), code);
      // eslint-disable-next-line no-await-in-loop
      await expect(visitor.locator('.js-launcher')).toHaveAttribute('aria-label', label);
    }
    await expect(visitor.locator('.root')).toHaveAttribute('dir', 'ltr');
  } finally {
    await shop.close();
  }
});
