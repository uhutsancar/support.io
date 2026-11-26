// Browser end-to-end tests, run against a stack that is already up.
//
//   Local:  docker compose up -d   then   cd e2e && npm test
//           (panel and API through Caddy on http://localhost, system Chrome
//           for the Chromium projects; `npx playwright install webkit firefox`
//           once for the others)
//   CI:     E2E_APP_URL=http://localhost:5050 with Playwright's own browsers
//
// The tests also start a tiny "customer website" that embeds the widget with
// the exact snippet the panel hands out.
//
// Projects: every spec on desktop Chrome; the
// widget's own specs again on phones and a tablet (iPhone 14 on WebKit, Pixel
// 7 on Chromium, iPad on WebKit) and on desktop Firefox and Safari.

import { defineConfig, devices } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The stack's address: E2E_APP_URL, else Caddy on the PROXY_PORT the root .env
// gives docker compose. Exported to the specs, which build absolute URLs too.
const rootEnv = join(__dirname, '..', '.env');
const proxyPort = existsSync(rootEnv)
  ? /^PROXY_PORT=(\d+)/m.exec(readFileSync(rootEnv, 'utf8'))?.[1]
  : undefined;
process.env.E2E_APP_URL ||= `http://localhost${proxyPort && proxyPort !== '80' ? `:${proxyPort}` : ''}`;

const chromeChannel = process.env.CI ? undefined : 'chrome';
const WIDGET_SPECS = /(mobile-widget|widget-lazy)\.spec\.ts/;

export default defineConfig({
  testDir: './tests',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_APP_URL,
    locale: 'tr-TR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  projects: [
    {
      name: 'desktop-chrome',
      testIgnore: /mobile-widget\.spec\.ts/,
      use: { viewport: { width: 1440, height: 900 }, channel: chromeChannel }
    },
    {
      name: 'iphone-14',
      testMatch: WIDGET_SPECS,
      use: { ...devices['iPhone 14'] }
    },
    {
      name: 'pixel-7',
      testMatch: WIDGET_SPECS,
      use: { ...devices['Pixel 7'], channel: chromeChannel }
    },
    {
      name: 'ipad',
      testMatch: /mobile-widget\.spec\.ts/,
      use: { ...devices['iPad (gen 7)'] }
    },
    {
      name: 'desktop-firefox',
      testMatch: /widget-lazy\.spec\.ts/,
      use: { ...devices['Desktop Firefox'] }
    },
    {
      name: 'desktop-safari',
      testMatch: /widget-lazy\.spec\.ts/,
      use: { ...devices['Desktop Safari'] }
    }
  ]
});
