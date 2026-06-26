import { test as setup } from '@playwright/test';
import { expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(process.cwd(), 'e2e/.auth/admin.json');

setup('authenticate as admin', async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

  if (!email || !password) {
    throw new Error('E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD must be set in .env.test');
  }

  // Use page.context().request so API calls and page navigation share the same cookie jar
  const ctx = page.context();

  // Step 1: get CSRF token
  const csrfRes = await ctx.request.get(`${baseURL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };

  // Step 2: post credentials — session cookie is written into the shared context
  await ctx.request.post(`${baseURL}/api/auth/callback/credentials`, {
    form: {
      email,
      password,
      csrfToken,
      callbackUrl: `${baseURL}/dashboard`,
      json: 'true',
    },
  });

  // Step 3: navigate with the now-authenticated page context
  await page.goto(`${baseURL}/admin/dashboard`);
  await expect(page).toHaveURL(/admin\/dashboard/, { timeout: 15_000 });

  await ctx.storageState({ path: authFile });
});
