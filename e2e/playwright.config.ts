// Browser end-to-end tests (plan §18), run against a stack that is already up.
//
//   Local:  docker compose up -d   then   cd e2e && npm test
//           (panel and API through Caddy on http://localhost, system Chrome)
//   CI:     E2E_APP_URL=http://localhost:5050 with Playwright's own Chromium
//
// The test also starts a tiny "customer website" on E2E_SHOP_PORT that embeds
// the widget with the exact snippet the panel hands out.

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_APP_URL || 'http://localhost',
    locale: 'tr-TR',
    viewport: { width: 1440, height: 900 },
    // Locally the installed Chrome, so nothing has to be downloaded; CI runs
    // `npx playwright install chromium` and uses that.
    channel: process.env.CI ? undefined : 'chrome',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  }
});
