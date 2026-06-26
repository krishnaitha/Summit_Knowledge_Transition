import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(process.cwd(), 'e2e/.auth/member.json');

setup('authenticate as member', async ({ page }) => {
  const email = process.env.E2E_MEMBER_EMAIL;
  const password = process.env.E2E_MEMBER_PASSWORD;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  if (!email || !password) {
    throw new Error('E2E_MEMBER_EMAIL and E2E_MEMBER_PASSWORD must be set in .env.test');
  }

  const ctx = page.context();

  // Step 1: get CSRF token
  const csrfRes = await ctx.request.get(`${baseURL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };

  // Step 2: post credentials
  await ctx.request.post(`${baseURL}/api/auth/callback/credentials`, {
    form: {
      email,
      password,
      csrfToken,
      callbackUrl: `${baseURL}/dashboard`,
      json: 'true',
    },
  });

  // Step 3: navigate — admin-role user lands on /admin/dashboard
  await page.goto(`${baseURL}/admin/dashboard`);
  await page.waitForURL(/dashboard/, { timeout: 15_000 });

  await ctx.storageState({ path: authFile });
});
