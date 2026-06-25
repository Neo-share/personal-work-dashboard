import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'on-first-retry',
    // 使用本机 Chrome，避免 CI/沙箱下载 Playwright 浏览器失败
    channel: 'chrome',
  },
  webServer: {
    command: 'pnpm dev',
    cwd: '..',
    url: 'http://localhost:5175',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
