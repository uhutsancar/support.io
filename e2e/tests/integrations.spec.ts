// The Integrations page (plan v10 PRD-11): an owner adds Slack, sends a
// test, reads the delivery history, adds a webhook and sees its signing
// secret once, then deletes it. The development API records the calls
// instead of making them (INTEGRATION_TRANSPORT=memory), so nothing reaches
// Slack. axe runs on the page and on its dialogs.

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { ownerThroughApi } from './support';

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

test('Slack and a webhook, from adding to the delivery history', async ({ browser }) => {
  test.setTimeout(180_000);
  const page = await (await browser.newContext({ reducedMotion: 'reduce' })).newPage();
  const { csrf } = await ownerThroughApi(page.request, {
    email: `integ${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: 'https://integrations.example', title: 'Entegrasyon' }
  });
  expect(onboarded.ok()).toBeTruthy();

  await page.goto('/dashboard/integrations');
  await expect(page.getByRole('heading', { level: 1, name: 'Entegrasyonlar' })).toBeVisible();
  expect(await seriousProblems(page)).toEqual([]);

  await test.step('add Slack', async () => {
    await page.getByRole('button', { name: 'Entegrasyon ekle' }).click();
    const dialog = page.getByRole('dialog', { name: 'Entegrasyon ekle' });
    await expect(dialog).toBeVisible();
    expect(await seriousProblems(page, '[role="dialog"]')).toEqual([]);
    await dialog.getByLabel('Ad', { exact: true }).fill('Destek kanalı');
    await dialog
      .getByLabel('Slack webhook adresi')
      .fill('https://hooks.slack.com/services/T0000000/B0000000/XXXXXXXXXXXXXXXXXXXXXXXX');
    await dialog.getByLabel('Konuşma kapandı').check();
    await dialog.getByRole('button', { name: 'Ekle', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Destek kanalı' })).toBeVisible();
    await expect(page.getByText(/hooks\.slack\.com\/…XXXX/)).toBeVisible();
  });

  await test.step('a test message, then the history', async () => {
    await page.getByRole('button', { name: 'Deneme gönder' }).click();
    await expect(page.getByText('Deneme mesajı ulaştı.')).toBeVisible();
    await page.getByRole('button', { name: 'Gönderim geçmişi' }).click();
    const history = page.getByRole('dialog', { name: /Gönderim geçmişi/ });
    await expect(history.getByText('Ulaştı · HTTP 200')).toBeVisible();
    expect(await seriousProblems(page, '[role="dialog"]')).toEqual([]);
    await page.keyboard.press('Escape');
  });

  await test.step('a webhook shows its signing secret once', async () => {
    await page.getByRole('button', { name: 'Entegrasyon ekle' }).click();
    const dialog = page.getByRole('dialog', { name: 'Entegrasyon ekle' });
    await dialog.getByText('Webhook', { exact: true }).click();
    await dialog.getByLabel('Ad', { exact: true }).fill('CRM');
    await dialog.getByLabel('Adres', { exact: true }).fill('https://1.1.1.1/support-hook');
    await dialog.getByRole('button', { name: 'Ekle', exact: true }).click();
    const secret = page.getByRole('dialog', { name: 'İmza anahtarınız' });
    await expect(secret.getByText(/^whsec_/)).toBeVisible();
    await secret.getByRole('button', { name: 'Tamam' }).click();
    await expect(page.getByRole('heading', { name: 'CRM' })).toBeVisible();
    // The page shows only the host, never the path or the secret.
    await expect(page.getByText('support-hook')).toHaveCount(0);
  });

  await test.step('delete one', async () => {
    const card = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('heading', { name: 'CRM' }) });
    await card.getByRole('button', { name: 'Sil' }).click();
    await page
      .getByRole('dialog', { name: 'Entegrasyon silinsin mi?' })
      .getByRole('button', { name: 'Sil' })
      .click();
    await expect(page.getByRole('heading', { name: 'CRM' })).toHaveCount(0);
  });
});
