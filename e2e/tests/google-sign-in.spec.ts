// Sign-in with Google in the browser (plan v10 PRD-14), against the API's
// stand-in for Google's account chooser (GOOGLE_SIGN_IN_TRANSPORT=memory):
// the same redirects, state cookie, PKCE and ID-token checks as with Google,
// without Google's servers. Real Google needs the owner's OAuth client.
//
// A new Google account lands in the set-up of its own workspace; an address
// that already has an account is told to sign in and connect Google from
// settings; connected there, Google opens it.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ownerThroughApi } from './support';

const stamp = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;

async function seriousProblems(page: Page) {
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

/** The stand-in's account chooser: the Google account to come back as. */
async function chooseGoogleAccount(
  page: Page,
  account: { sub: string; email: string; name: string }
) {
  await expect(page.getByRole('heading', { name: 'Stand-in Google' })).toBeVisible();
  await page.getByLabel('Subject').fill(account.sub);
  await page.getByLabel('E-mail').fill(account.email);
  await page.getByLabel('Name').fill(account.name);
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('a new Google account opens its own workspace', async ({ browser }) => {
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  await page.goto('/register');
  const button = page.getByRole('link', { name: 'Google ile devam et' });
  await expect(button).toBeVisible();
  expect(await seriousProblems(page)).toEqual([]);
  await button.click();
  await chooseGoogleAccount(page, {
    sub: `pw-new-${stamp()}`,
    email: `google${stamp()}@gmail.test`,
    name: 'Deniz Google'
  });
  await expect(page).toHaveURL(/\/onboarding$/);
  const me = await (await page.request.get('/api/auth/me')).json();
  expect(me.user.name).toBe('Deniz Google');
  expect(me.user.emailVerified).toBe(true);
});

test('an existing address is not opened by Google until its owner connects it', async ({
  browser
}) => {
  test.setTimeout(120_000);
  const email = `connect${stamp()}@e2e.test`;
  const sub = `pw-link-${stamp()}`;
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const { csrf } = await ownerThroughApi(page.request, { email, password: 'E2ePassw0rd!' });
  const onboarded = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: 'https://google-connect.example', title: 'Google Bağlama' }
  });
  expect(onboarded.ok()).toBeTruthy();

  await test.step('signed out, Google with the same address is turned away', async () => {
    const stranger = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
    await stranger.goto('/login');
    expect(await seriousProblems(stranger)).toEqual([]);
    await stranger.getByRole('link', { name: 'Google ile devam et' }).click();
    await chooseGoogleAccount(stranger, { sub: `pw-other-${stamp()}`, email, name: 'Başkası' });
    await expect(stranger).toHaveURL(/\/login\?google=exists$/);
    await expect(stranger.getByRole('alert')).toContainText('zaten bir hesabınız var');
    const me = await stranger.request.get('/api/auth/me');
    expect(me.status()).toBe(401);
  });

  await test.step('the owner connects Google from settings', async () => {
    await page.goto('/dashboard/settings');
    const card = page.locator('section', { hasText: 'Google ile giriş' });
    await card.getByRole('button', { name: 'Google hesabını bağla' }).click();
    await chooseGoogleAccount(page, { sub, email: `kisisel${stamp()}@gmail.test`, name: 'Sahip' });
    await expect(page).toHaveURL(/\/dashboard\/settings#security$/);
    await expect(page.getByText('Google hesabınız bağlandı.')).toBeVisible();
    await expect(card.getByText(/Bağlı Google hesabı: kisisel/)).toBeVisible();
  });

  await test.step('now Google opens the account', async () => {
    const elsewhere = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
    await elsewhere.goto('/login');
    await elsewhere.getByRole('link', { name: 'Google ile devam et' }).click();
    await chooseGoogleAccount(elsewhere, { sub, email: 'any@gmail.test', name: 'Sahip' });
    await expect(elsewhere).toHaveURL(/\/dashboard$/);
    const me = await (await elsewhere.request.get('/api/auth/me')).json();
    expect(me.user.email).toBe(email);
  });

  await test.step('and disconnecting it is one click', async () => {
    const card = page.locator('section', { hasText: 'Google ile giriş' });
    await card.getByRole('button', { name: 'Bağlantıyı kaldır' }).click();
    await expect(page.getByText('Google bağlantısı kaldırıldı.')).toBeVisible();
    await expect(card.getByRole('button', { name: 'Google hesabını bağla' })).toBeVisible();
  });
});
