// The Google Tag Manager template (plan v10 PRD-13). GTM's own sandbox runs
// only inside Tag Manager, so this test does two honest things instead: it
// checks that the template file is well formed and that its permissions
// allow exactly what its code does, and it runs the template's code in a real
// page with the three GTM calls it uses written out as GTM documents them —
// config into window, then a plain script tag with no attributes. The real
// widget must then find its site key and show the bubble.

import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { customerWebsite, ownerThroughApi } from './support';

const SHOP_PORT = Number(process.env.E2E_SHOP_PORT) || 5196;
const TEMPLATE = fs.readFileSync(
  path.join(__dirname, '..', '..', 'integrations', 'gtm', 'template.tpl'),
  'utf8'
);

function section(name: string): string {
  const match = new RegExp(`___${name}___\\n([\\s\\S]*?)(?=\\n___[A-Z_]+___|$)`).exec(TEMPLATE);
  if (!match) throw new Error(`no ${name} section`);
  return match[1].trim();
}

test('the template is well formed and asks only for what it uses', () => {
  const info = JSON.parse(section('INFO'));
  expect(info.type).toBe('TAG');
  expect(info.containerContexts).toEqual(['WEB']);
  const parameters = JSON.parse(section('TEMPLATE_PARAMETERS'));
  expect(parameters.map((p: { name: string }) => p.name)).toEqual(['siteKey']);

  const code = section('SANDBOXED_JS_FOR_WEB_TEMPLATE');
  const required = [...code.matchAll(/require\('([a-zA-Z]+)'\)/g)].map((m) => m[1]).sort();
  expect(required).toEqual(['copyFromWindow', 'injectScript', 'setInWindow']);

  const permissions = JSON.parse(section('WEB_PERMISSIONS')) as Array<{
    instance: { key: { publicId: string }; param: Array<{ value: { listItem: unknown[] } }> };
  }>;
  expect(permissions.map((p) => p.instance.key.publicId).sort()).toEqual([
    'access_globals',
    'inject_script'
  ]);
  const urls = JSON.stringify(
    permissions.find((p) => p.instance.key.publicId === 'inject_script')!.instance.param
  );
  const injected = /injectScript\(\s*'([^']+)'/.exec(code)![1];
  expect(urls).toContain(injected);
  expect(JSON.stringify(permissions)).toContain('"SupportChatConfig"');
});

test("the template's code puts the chat on a page", async ({ browser, baseURL }) => {
  const owner = await (await browser.newContext()).newPage();
  const { csrf } = await ownerThroughApi(owner.request, {
    email: `gtm${Date.now()}@e2e.test`,
    password: 'E2ePassw0rd!'
  });
  const onboarded = await owner.request.post('/api/onboarding', {
    headers: csrf,
    data: { websiteUrl: `http://127.0.0.1:${SHOP_PORT}`, title: 'GTM Mağazası' }
  });
  expect(onboarded.ok()).toBeTruthy();
  const { sites } = await (await owner.request.get('/api/sites')).json();
  const siteKey = (sites[0] as { siteKey: string }).siteKey;

  // The page has already set an option of its own; the template keeps it.
  const shop = await customerWebsite(
    SHOP_PORT,
    `<script>window.SupportChatConfig = { position: 'bottom-left' };</script>`
  );
  const visitor = await (await browser.newContext()).newPage();
  try {
    await visitor.goto(shop.url);
    const code = section('SANDBOXED_JS_FOR_WEB_TEMPLATE').replaceAll(
      'https://__APP_DOMAIN__',
      baseURL!
    );
    await visitor.evaluate(
      ([source, key]) => {
        const w = window as unknown as Record<string, unknown>;
        const apis: Record<string, unknown> = {
          copyFromWindow: (name: string) =>
            w[name] === undefined ? undefined : JSON.parse(JSON.stringify(w[name])),
          setInWindow: (name: string, value: unknown, override: boolean) => {
            if (!override && w[name] !== undefined) return false;
            w[name] = value;
            return true;
          },
          injectScript: (url: string, onSuccess: () => void, onFailure: () => void) => {
            const script = document.createElement('script');
            script.src = url;
            script.async = true;
            script.onload = onSuccess;
            script.onerror = onFailure;
            document.head.appendChild(script);
          }
        };
        const data = {
          siteKey: key,
          gtmOnSuccess: () => (w.__gtm = 'success'),
          gtmOnFailure: () => (w.__gtm = 'failure')
        };
        new Function('require', 'data', source)((name: string) => apis[name], data);
      },
      [code, siteKey] as const
    );
    await expect.poll(() => visitor.evaluate(() => (window as any).__gtm)).toBe('success');
    expect(await visitor.evaluate(() => (window as any).SupportChatConfig)).toEqual({
      position: 'bottom-left',
      siteKey
    });
    await expect(visitor.locator('.js-launcher')).toBeVisible();
    const state = await visitor.evaluate(() => (window as any).SupportChat.debug());
    expect(state.initialized).toBe(true);
    expect(state.fatal ?? null).toBeNull();
  } finally {
    await shop.close();
  }
});
