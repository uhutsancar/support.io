// Reports in the panel (plan v10 PRD-22): the analytics page shows when
// conversations start and which were answered late, compares agents, and
// downloads a report as CSV or Excel on a plan with exports — on Free the
// buttons offer the upgrade instead. axe finds nothing serious.

import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { ownerThroughApi } from './support';

test('the analytics page: heatmap, late answers, a CSV and an Excel file', async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await (
    await browser.newContext({ reducedMotion: 'reduce', acceptDownloads: true })
  ).newPage();
  const { csrf } = await ownerThroughApi(page.request, {
    email: `reports${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await page.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: 'https://reports.example', title: 'Rapor Mağazası' }
  });
  expect(onboarded.ok()).toBeTruthy();

  await page.goto('/dashboard/analytics');
  await expect(
    page.getByRole('heading', { name: 'Konuşmalar hangi gün ve saatte başlıyor' })
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Geç yanıtlanan konuşmalar' })).toBeVisible();
  await expect(page.getByText('Bu dönemde geç yanıtlanan konuşma yok.')).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(
    violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`)
  ).toEqual([]);

  await test.step('a CSV of the conversations', async () => {
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'CSV' }).click()
    ]);
    expect(download.suggestedFilename()).toMatch(
      /^support-io-conversations-7days-\d{4}-\d{2}-\d{2}\.csv$/
    );
    const text = fs.readFileSync((await download.path())!, 'utf8');
    expect(text.charCodeAt(0)).toBe(0xfeff);
    expect(text).toContain('Talep no,Başlangıç,Site,Durum');
  });

  await test.step('the agents as an Excel workbook', async () => {
    await page.getByLabel('İndirilecek rapor').selectOption('agents');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Excel' }).click()
    ]);
    expect(download.suggestedFilename()).toMatch(/^support-io-agents-7days-.*\.xlsx$/);
    const bytes = fs.readFileSync((await download.path())!);
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
  });

  await test.step('on Free, the buttons offer the upgrade', async () => {
    const ended = await page.request.post('/api/dev/end-trial', { headers: csrf });
    expect(ended.status()).toBe(204);
    await page.reload();
    await page.getByRole('button', { name: 'CSV' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});
