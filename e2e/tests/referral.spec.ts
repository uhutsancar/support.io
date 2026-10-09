// The referral programme in the browser (plan v10 PRD-23): the owner finds
// their link under Settings; someone opens it, looks at the pricing page,
// then signs up — and the owner's "signed up" count goes to one.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { mailedLink, ownerThroughApi } from './support';

test('a referral link brings a sign-up the owner can see', async ({ browser }) => {
  test.setTimeout(120_000);
  const owner = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `referrer${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: 'https://referrer.example', title: 'Tavsiye Eden' }
  });
  expect(onboarded.ok()).toBeTruthy();

  await owner.goto('/dashboard/settings');
  const card = owner.locator('section#referral');
  await expect(card.getByRole('heading', { name: 'Tavsiye programı' })).toBeVisible();
  const link = await card.getByLabel('Tavsiye bağlantınız').inputValue();
  expect(link).toMatch(/\/register\?ref=[A-Z2-9]{8}$/);
  const { violations } = await new AxeBuilder({ page: owner })
    .include('section#referral')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);

  const friend = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const email = `friend${Date.now()}@e2e.test`;
  await friend.goto(new URL(link).pathname + new URL(link).search);
  // A detour through the pricing page keeps the code for the session.
  await friend.goto('/fiyatlandirma');
  await friend.goto('/register');
  await friend.locator('input[autocomplete="name"]').fill('Davet Edilen');
  await friend.locator('input[type="email"]').fill(email);
  await friend.locator('input[type="password"]').fill('E2ePassw0rd!');
  await friend.locator('form button[type="submit"]').click();
  await expect(friend.getByText('Gelen kutunuzu kontrol edin')).toBeVisible();
  // The address is confirmed by its link, as a person would.
  const verify = new URL(await mailedLink(friend.request, email, '/verify-email'), 'http://x');
  const verified = await friend.request.post('/api/auth/verify-email', {
    data: { token: verify.searchParams.get('token') }
  });
  expect(verified.status()).toBe(200);

  await owner.reload();
  await expect(
    owner.locator('section#referral dl > div', { hasText: 'Kaydolan' }).locator('dd')
  ).toHaveText('1');
});
