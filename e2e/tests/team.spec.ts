// The team (plan v10 TST-01 #1 and #14): the owner invites an agent from the
// Team page, the agent joins through the mailed link with a password of
// their own, works in the inbox but cannot open the owner's billing page,
// and the two talk in a team group chat.

import { expect, test } from '@playwright/test';
import { mailedLink, ownerThroughApi } from './support';

const SHOP_PORT = Number(process.env.E2E_SHOP_PORT) || 5186;

test('an invited agent joins, works within their role, and talks in team chat', async ({
  browser
}) => {
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `teamowner${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!',
    name: 'Ayla Sahip'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${SHOP_PORT}`, title: 'Ekip Mağazası' }
  });
  expect(onboarded.ok()).toBeTruthy();
  // A new workspace runs the Pro trial: seats and team chat are open.
  const agentEmail = `agent${Date.now()}@e2e.test`;

  await test.step('the owner invites from the Team page', async () => {
    await owner.goto('/dashboard/team');
    await owner.getByRole('button', { name: 'Üye davet et' }).click();
    await owner.locator('#invite-email').fill(agentEmail);
    await owner.locator('#invite-role').selectOption('agent');
    await owner.getByRole('button', { name: 'Daveti gönder' }).click();
    await expect(owner.getByText(`Davet ${agentEmail} adresine gönderildi.`)).toBeVisible();
  });

  const agent = await (await browser.newContext()).newPage();
  await test.step('the agent joins with the mailed link', async () => {
    await agent.goto(await mailedLink(owner.request, agentEmail, '/invite/accept'));
    await agent.getByLabel('Adınız').fill('Deniz Temsilci');
    await agent.getByLabel('Şifreniz (en az 10 karakter)').fill('AgentPassw0rd!');
    await agent.getByRole('button', { name: 'Daveti kabul et' }).click();
    await agent.waitForURL(/\/dashboard/);
  });

  await test.step('the inbox is theirs, the billing page is not', async () => {
    await agent.goto('/dashboard/conversations');
    await expect(agent.locator('main')).toBeVisible();
    await agent.goto('/dashboard/billing');
    await expect(agent.getByText('Bu sayfayı yalnızca hesap sahibi görebilir.')).toBeVisible();
    const billing = await agent.request.get('/api/billing');
    expect(billing.status()).toBe(403);
  });

  await test.step('a team group chat, both ways', async () => {
    await owner.goto('/dashboard/team-chat');
    await owner.getByTitle('Yeni Sohbet').click();
    await owner.getByRole('button', { name: 'Yeni Grup' }).click();
    await owner.getByPlaceholder('Grup adı girin...').fill('Vardiya');
    await owner.locator('label').filter({ hasText: 'Deniz Temsilci' }).locator('input').check();
    await owner.getByRole('button', { name: /^Grubu Oluştur/ }).click();
    const box = owner.getByPlaceholder('Mesajınızı yazın...');
    await box.fill('Bugün vardiya sende.');
    await box.press('Enter');
    await expect(owner.getByText('Bugün vardiya sende.').last()).toBeVisible();

    await agent.goto('/dashboard/team-chat');
    await agent.getByText('Vardiya').first().click();
    await expect(agent.getByText('Bugün vardiya sende.').last()).toBeVisible();
    const reply = agent.getByPlaceholder('Mesajınızı yazın...');
    await reply.fill('Tamam, bende.');
    await reply.press('Enter');
    await expect(owner.getByText('Tamam, bende.').last()).toBeVisible();
  });
});
