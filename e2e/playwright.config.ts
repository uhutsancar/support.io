// Browser end-to-end tests (plan §18), run against a stack that is already up.
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
// Projects (plan v10 UX-03, TST-01): every spec on desktop Chrome; the
// widget's own specs again on phones and a tablet (iPhone 14 on WebKit, Pixel
// 7 on Chromium, iPad on WebKit) and on desktop Firefox and Safari.

import { defineConfig, devices } from '@playwright/test';

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
    baseURL: process.env.E2E_APP_URL || 'http://localhost',
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
