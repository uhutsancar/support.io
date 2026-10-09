// The WordPress plugin against a real WordPress (plan v10 PRD-13). The
// administrator pastes the installation code under Settings → Support.io; a
// wrong code is refused; the bubble then appears on the site, and a signed-in
// WordPress user reaches the team as a verified customer.
//
// Needs the throw-away WordPress from integrations/wordpress/
// docker-compose.test.yml; without WP_URL the test is skipped.

import { expect, test } from '@playwright/test';
import { ownerThroughApi } from './support';

const WP_URL = process.env.WP_URL || '';
const WP_USER = process.env.WP_USER || 'admin';
const WP_PASSWORD = process.env.WP_PASSWORD || 'WpTestPassw0rd!';

test.skip(!WP_URL, 'needs WP_URL: see integrations/wordpress/docker-compose.test.yml');

test('the plugin puts the chat on a WordPress site and introduces its users', async ({
  browser,
  baseURL
}) => {
  test.setTimeout(180_000);
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `wordpress${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: WP_URL, title: 'WordPress Mağazası' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await owner.request.get('/api/sites')).json();
  const site = sites[0] as { _id: string; siteKey: string };
  const keyRes = await owner.request.post(`/api/sites/${site._id}/integrations/identity-secret`, {
    headers: csrf
  });
  expect(keyRes.ok()).toBeTruthy();
  const { secret } = await keyRes.json();
  const installCode = `<script\n  src="${baseURL}/widget.js"\n  data-site-key="${site.siteKey}"\n  async></script>`;

  const wp = await (await browser.newContext({ locale: 'en-US' })).newPage();

  await test.step('the administrator signs in', async () => {
    await wp.goto(`${WP_URL}/wp-login.php`);
    await wp.locator('#user_login').fill(WP_USER);
    await wp.locator('#user_pass').fill(WP_PASSWORD);
    await wp.locator('#wp-submit').click();
    await expect(wp.locator('#wpadminbar')).toBeVisible();
  });

  await test.step('a wrong code is refused, the right one is kept', async () => {
    await wp.goto(`${WP_URL}/wp-admin/options-general.php?page=support-io-live-chat`);
    await expect(wp.getByRole('heading', { level: 1, name: 'Support.io Live Chat' })).toBeVisible();
    await wp
      .getByLabel('Installation code')
      .fill('<script src="https://evil.example/x.js"></script>');
    await wp.getByRole('button', { name: 'Save Changes' }).click();
    await expect(wp.getByText('That is not a Support.io installation code.')).toBeVisible();

    await wp.getByLabel('Installation code').fill(installCode);
    await wp.getByRole('checkbox', { name: /Tell your team who they are talking to/ }).check();
    await wp.getByLabel('Identity key (optional)').fill(secret);
    await wp.getByRole('button', { name: 'Save Changes' }).click();
    await expect(wp.getByText('The chat bubble is on every page of your site')).toBeVisible();
    await expect(wp.getByText(`${site.siteKey.slice(0, 8)}…`)).toBeVisible();
    await expect(wp.getByText('A key is saved.')).toBeVisible();
    // The key never comes back to the page.
    expect(await wp.content()).not.toContain(secret);
  });

  await test.step('the site shows the bubble, with the key and the user', async () => {
    await wp.goto(`${WP_URL}/`);
    const tag = wp.locator(`script[data-site-key="${site.siteKey}"]`);
    await expect(tag).toHaveAttribute('src', `${baseURL}/widget.js?ver=1.0.0`);
    await expect(tag).toHaveAttribute('async', '');
    const html = await wp.content();
    expect(html).not.toContain(secret);
    expect(html).toMatch(/"userHash":"[0-9a-f]{64}"/);

    const launcher = wp.locator('.js-launcher');
    await expect(launcher).toBeVisible();
    await launcher.click();
    await wp.locator('.js-start').click();
    await wp.locator('.js-input').fill('WordPress’ten merhaba');
    await wp.locator('.js-send').click();
    await expect(
      wp.locator('.msg.visitor').filter({ hasText: 'WordPress’ten merhaba' })
    ).not.toHaveClass(/pending|failed/);
  });

  await test.step('the team sees a verified customer', async () => {
    await expect
      .poll(async () => {
        const res = await owner.request.get(`/api/conversations/${site._id}?limit=5`);
        const { conversations } = (await res.json()) as {
          conversations: Array<{ metadata?: { verifiedUserId?: string }; visitorEmail?: string }>;
        };
        const found = conversations[0];
        return found ? [found.metadata?.verifiedUserId ?? null, found.visitorEmail ?? null] : null;
      })
      .toEqual(['1', 'admin@wp.test']);
  });

  await test.step('signed out, the chat forgets the user', async () => {
    await wp.goto(`${WP_URL}/wp-login.php?action=logout`);
    await wp.getByRole('link', { name: 'log out' }).click();
    await wp.goto(`${WP_URL}/`);
    await expect(wp.locator('.js-launcher')).toBeVisible();
    await expect
      .poll(() => wp.evaluate(() => localStorage.getItem('supportio_wp_identified')))
      .toBeNull();
    expect(await wp.content()).not.toContain('admin@wp.test');
  });
});
