// The account's own security in the panel (plan v10 SEC-03, SEC-04, TST-01):
// changing the password ends the other device's session, and two-step
// sign-in is set up from the QR screen and then asked for at sign-in.

import { expect, test } from '@playwright/test';
import { ownerThroughApi, totp } from './support';

const PASSWORD = 'E2ePassw0rd!';
const NEW_PASSWORD = 'Another-Passw0rd-9';

test('password change and two-step sign-in, from the settings page', async ({ browser }) => {
  const email = `security${Date.now()}@e2e.test`;
  const context = await browser.newContext();
  const page = await context.newPage();
  const { csrf } = await ownerThroughApi(page.request, { email, password: PASSWORD });
  // Past the first-run setup, so the panel opens on its pages.
  const onboarded = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: 'https://security.example', title: 'E2E Owner' }
  });
  expect(onboarded.ok()).toBeTruthy();

  // A second device, signed in with the old password.
  const other = await browser.newContext();
  const otherLogin = await other.request.post('/api/auth/login', {
    data: { email, password: PASSWORD }
  });
  expect(otherLogin.status()).toBe(200);

  await test.step('change the password from the settings page', async () => {
    await page.goto('/dashboard/settings');
    await page.getByLabel('Mevcut şifre').fill(PASSWORD);
    await page.getByLabel('Yeni şifre', { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel('Yeni şifre (tekrar)').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Şifreyi değiştir' }).click();
    await expect(page.getByText('Şifreniz değişti').first()).toBeVisible();
    // This browser stays in; the other device is out.
    expect((await page.request.get('/api/auth/me')).status()).toBe(200);
    expect((await other.request.get('/api/auth/me')).status()).toBe(401);
  });

  let secret = '';
  await test.step('turn on two-step sign-in with the QR screen', async () => {
    await page.getByRole('button', { name: 'İki adımlı doğrulamayı aç' }).click();
    await page.getByLabel('Devam etmek için şifrenizi girin').fill(NEW_PASSWORD);
    await page.getByRole('button', { name: 'Devam et' }).click();
    await expect(page.getByRole('img', { name: 'QR' })).toBeVisible();
    secret = (await page.getByTestId('totp-secret').innerText()).replace(/\s/g, '');
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    await page.getByLabel('Uygulamadaki 6 haneli kod').fill(totp(secret));
    await page.getByRole('button', { name: 'Doğrula ve aç' }).click();
    await expect(page.getByText('Kurtarma kodlarınız')).toBeVisible();
    await expect(page.locator('ul li')).toHaveCount(10);
    await page.getByRole('button', { name: 'Kaydettim' }).click();
    // On: the status badge and the recovery codes left (the page also has
    // an "Açık" theme button, so the badge is found next to its count).
    await expect(page.getByText('10 kurtarma kodu kaldı.')).toBeVisible();
    await expect(page.locator('span.rounded-full').filter({ hasText: /^Açık$/ })).toBeVisible();
  });

  await test.step('sign-in now asks for the code', async () => {
    const fresh = await browser.newContext();
    const login = await fresh.newPage();
    await login.goto('/login');
    await login.locator('input[type="email"]').fill(email);
    await login.locator('input[type="password"]').fill(NEW_PASSWORD);
    await login.locator('form button[type="submit"]').click();
    await expect(login.getByText('İki adımlı doğrulama')).toBeVisible();
    // The next 30-second step: the one used to turn it on is spent.
    await login.getByLabel('Doğrulama kodu').fill(totp(secret, 1));
    await login.getByRole('button', { name: 'Doğrula' }).click();
    await login.waitForURL(/\/(dashboard|onboarding)/);
    await fresh.close();
  });

  await other.close();
  await context.close();
});
