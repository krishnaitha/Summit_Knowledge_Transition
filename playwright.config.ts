import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'setup-admin',
      testMatch: 'e2e/auth/admin.setup.ts',
    },
    {
      name: 'setup-member',
      testMatch: 'e2e/auth/member.setup.ts',
    },
    {
      name: 'admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['setup-admin'],
      testMatch: ['e2e/tests/admin/**/*.spec.ts'],
    },
    {
      name: 'member',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/member.json',
      },
      dependencies: ['setup-member'],
      testMatch: ['e2e/tests/member/**/*.spec.ts'],
    },
    {
      name: 'unauthenticated',
      use: { ...devices['Desktop Chrome'] },
      testMatch: ['e2e/tests/public/**/*.spec.ts'],
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
