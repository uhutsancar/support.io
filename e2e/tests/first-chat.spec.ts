// A new customer, from sign-up to a paid plan, in real browsers (plan §18):
// register → "check your inbox" → the mailed link signs in → onboarding
// creates the site → the
// install code goes on a separate website → a visitor writes → the agent sees
// it and answers → the visitor sees the answer → after a reload the history
// is still there → the agent closes the conversation → a paid upgrade raises
// the limits.
//
// The visitor and the agent are separate browser contexts, so they share no
// cookies or storage. The upgrade is the webhook Paddle sends after a sandbox
// payment, signed like Paddle signs it; paying in Paddle's own overlay needs
// a sandbox account and is checked by hand (docs/production-runbook.md §7).

import { expect, test, type Page } from '@playwright/test';
import { customerWebsite, mailedLink, paidSubscription } from './support';

const PASSWORD = 'E2ePassw0rd!';
const SHOP_PORT = Number(process.env.E2E_SHOP_PORT) || 5181;

test('a new customer answers their first visitor and upgrades', async ({ browser }) => {
  const stamp = Date.now();
  const email = `owner${stamp}@e2e.test`;
  const question = `Kargo ne zaman gelir? (${stamp})`;
  const answer = `Yarın kargoda olur. (${stamp})`;

  const agentContext = await browser.newContext();
  const panel = await agentContext.newPage();
  let shop: Awaited<ReturnType<typeof customerWebsite>> | undefined;

  try {
    await test.step('register', async () => {
      await panel.goto('/register');
      await panel.locator('input[autocomplete="name"]').fill('E2E Owner');
      await panel.locator('input[type="email"]').fill(email);
      await panel.locator('input[type="password"]').fill(PASSWORD);
      await panel.locator('form button[type="submit"]').click();
      // Sign-up is e-mail first: no session until the link is opened.
      await expect(panel.getByText('Gelen kutunuzu kontrol edin')).toBeVisible();
    });

    await test.step('the mailed link verifies the address and signs in', async () => {
      await panel.goto(await mailedLink(panel.request, email, '/verify-email'));
      await expect(panel.getByText('E-posta adresiniz doğrulandı')).toBeVisible();
      await panel.waitForURL(/\/onboarding/);
    });

    await test.step('onboarding creates the site', async () => {
      await panel.getByText('Müşteri hizmetlerimizi iyileştirmek için').click();
      await panel.getByRole('button', { name: /İlerle/ }).click();
      await panel.locator('input[type="url"]').fill(`http://127.0.0.1:${SHOP_PORT}`);
      await panel.getByRole('button', { name: /İlerle/ }).click();
      await panel.getByRole('button', { name: /İlerle/ }).click();
      await panel.getByRole('button', { name: /Tamamla/ }).click();
      await panel.waitForURL(/\/dashboard/);
    });

    await test.step('the install code goes on the customer website', async () => {
      await panel.goto('/dashboard/sites');
      const code = panel.locator('pre').filter({ hasText: 'data-site-key' }).first();
      await expect(code).toBeVisible();
      // The panel prints the public address (a placeholder until the domain
      // is live, never localhost); the copy points at the stack under test.
      const appOrigin = new URL(panel.url()).origin;
      const installCode = (await code.innerText()).replace(
        /src="https?:\/\/[^/"]+\/widget\.js"/,
        `src="${appOrigin}/widget.js"`
      );
      expect(installCode).toContain(`src="${appOrigin}/widget.js"`);
      shop = await customerWebsite(SHOP_PORT, installCode);
    });

    const visitorContext = await browser.newContext();
    const visitor = await visitorContext.newPage();
    // What the website's console says is the first thing to read when the
    // widget does not show up.
    const debug = Boolean(process.env.E2E_DEBUG);
    visitor.on('console', (m) => {
      if (debug || m.type() === 'error' || m.type() === 'warning') {
        console.log(`[website] ${m.type()}: ${m.text()}`);
      }
    });
    if (debug) {
      visitor.on('request', (r) => console.log(`[website] -> ${r.method()} ${r.url()}`));
      visitor.on('websocket', (ws) => {
        console.log(`[website] websocket ${ws.url()}`);
        ws.on('close', () => console.log('[website] websocket closed'));
      });
    }
    visitor.on('requestfailed', (r) => console.log(`[website] failed ${r.url()}`));
    visitor.on('response', (r) => {
      if (r.status() >= 400) console.log(`[website] ${r.status()} ${r.url()}`);
    });

    await test.step('a visitor writes from the website', async () => {
      await visitor.goto(shop!.url);
      await visitor.locator('.js-launcher').click();
      await visitor.locator('.js-start').click();
      await visitor.locator('.js-input').fill(question);
      await visitor.locator('.js-send').click();
      await expect(visitor.locator('.msg.visitor').filter({ hasText: question })).toBeVisible();
    });

    await test.step('the agent sees it and answers', async () => {
      await panel.goto('/dashboard/conversations');
      const item = panel
        .locator('div.cursor-pointer')
        .filter({ hasText: `127.0.0.1:${SHOP_PORT}` })
        .first();
      await expect(item).toBeVisible();
      await item.click();
      const claim = panel.getByRole('button', { name: 'Talebi Üzerime Al' });
      if (await claim.isVisible().catch(() => false)) await claim.click();
      await expect(panel.getByText(question).last()).toBeVisible();
      await panel.getByPlaceholder(/^Mesajınızı yazın/).fill(answer);
      await panel.getByPlaceholder(/^Mesajınızı yazın/).press('Enter');
    });

    await test.step('the visitor sees the answer live', async () => {
      await expect(visitor.locator('.msg.agent').filter({ hasText: answer })).toBeVisible();
    });

    await test.step('after a reload the history is still there', async () => {
      await visitor.reload();
      await openMessages(visitor);
      await expect(visitor.locator('.msg.visitor').filter({ hasText: question })).toBeVisible();
      await expect(visitor.locator('.msg.agent').filter({ hasText: answer })).toBeVisible();
    });

    await test.step('the agent closes the conversation', async () => {
      await panel.getByLabel('Durumu değiştir').selectOption('closed');
      await panel.reload();
      await panel.getByLabel('Duruma göre filtrele').selectOption('closed');
      const item = panel
        .locator('div.cursor-pointer')
        .filter({ hasText: `127.0.0.1:${SHOP_PORT}` })
        .first();
      await expect(item).toContainText('Kapalı');
    });

    await test.step('the trial ends in Free; paying for Pro raises the limits again', async () => {
      // A new workspace starts on the free Pro trial (PRD-15).
      await panel.goto('/dashboard/billing');
      await expect(panel.getByText('Ücretsiz deneme').first()).toBeVisible();
      await expect(panel.getByText('1 / 3').first()).toBeVisible();
      // The trial runs out; the plan in force is Free again.
      const cookies = await agentContext.cookies();
      const ended = await panel.request.post('/api/dev/end-trial', {
        headers: { 'X-CSRF-Token': cookies.find((c) => c.name === 'sc_csrf')?.value ?? '' }
      });
      expect(ended.status()).toBe(204);
      await panel.reload();
      await expect(panel.getByText('1 / 1').first()).toBeVisible();

      await panel.goto('/dashboard/upgrade?plan=PRO');
      await expect(panel.getByText('490').first()).toBeVisible();

      const me = await (await panel.request.get('/api/auth/me')).json();
      const { body, signature } = paidSubscription(String(me.user.organizationId));
      const delivered = await panel.request.post('/api/billing/paddle/webhook', {
        headers: { 'Content-Type': 'application/json', 'Paddle-Signature': signature },
        data: body
      });
      expect(delivered.status()).toBe(200);

      await panel.goto('/dashboard/billing');
      await expect(panel.getByText('Pro', { exact: true }).first()).toBeVisible();
      await expect(panel.getByText('1 / 3').first()).toBeVisible();
    });

    await visitorContext.close();
  } finally {
    await agentContext.close();
    await shop?.close();
  }
});

async function openMessages(page: Page) {
  const panelOpen = await page
    .locator('.js-view-messages.active')
    .isVisible()
    .catch(() => false);
  if (panelOpen) return;
  if (
    !(await page
      .locator('.panel')
      .isVisible()
      .catch(() => false))
  ) {
    await page.locator('.js-launcher').click();
  }
  await page.locator('.js-nav-messages').click();
}
