/* eslint-disable @typescript-eslint/no-require-imports */
const { defineConfig } = require('@playwright/test');

// Dedicated port avoids reusing another app already on :3000 (e.g. branch CRA).
const defaultBase = 'http://localhost:3001';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || defaultBase;

module.exports = defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm start',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
        env: { ...process.env, BROWSER: 'none', PORT: '3001' },
      },
});
