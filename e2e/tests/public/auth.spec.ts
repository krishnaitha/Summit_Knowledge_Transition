import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';

test.describe('Authentication — Tier 1', () => {
  test('login page renders correctly', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });

  test('admin credentials redirect to /admin/dashboard', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) test.skip(true, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set');

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email!, password!);
    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });
    await expect(page).toHaveURL(/admin\/dashboard/);
  });

  test('member credentials redirect to a dashboard', async ({ page }) => {
    const email = process.env.E2E_MEMBER_EMAIL;
    const password = process.env.E2E_MEMBER_PASSWORD;
    if (!email || !password) test.skip(true, 'E2E_MEMBER_EMAIL / E2E_MEMBER_PASSWORD not set');

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email!, password!);
    // Member → /dashboard; admin-as-member → /admin/dashboard; both are valid
    await page.waitForURL(/dashboard/, { timeout: 15_000 });
    await loginPage.expectOnLoginPage().catch(() => {
      // Not on login = success
    });
    expect(page.url()).toMatch(/dashboard/);
  });

  test('wrong password shows an error and stays on /login', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login('does-not-exist@example.com', 'BadPassword99!');
    await loginPage.expectErrorVisible();
    await loginPage.expectOnLoginPage();
  });

  test('sign-in button is disabled while request is in flight', async ({ page }) => {
    const loginPage = new LoginPage(page);
    await loginPage.goto();
    // Slow down the network response so we can observe the loading state
    await page.route('/api/auth/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1_000));
      await route.continue();
    });
    await page.fill('#email', process.env.E2E_ADMIN_EMAIL ?? 'test@test.com');
    await page.fill('#password', process.env.E2E_ADMIN_PASSWORD ?? 'password');
    await page.click('button:has-text("Sign in")');
    await expect(page.getByText(/Signing in/i)).toBeVisible({ timeout: 3_000 });
  });

  test('admin can log out and lands on /login', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    if (!email || !password) test.skip(true, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set');

    const loginPage = new LoginPage(page);
    await loginPage.goto();
    await loginPage.login(email!, password!);
    await page.waitForURL('**/admin/dashboard', { timeout: 15_000 });

    await page.click('button[title="Log out"]');
    await page.waitForURL('**/login', { timeout: 10_000 });
    await expect(page).toHaveURL(/login/);
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page).not.toHaveTitle(/500|error/i);
    await expect(page.locator('input[type="email"]').first()).toBeVisible();
  });

  test('accept-invite page renders without crashing on invalid token', async ({ page }) => {
    await page.goto('/auth/accept-invite?token=invalid-test-token');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('unauthenticated user redirected to /login when accessing admin route', async ({ page }) => {
    await page.goto('/admin/dashboard');
    // Should redirect to login (or show login form)
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });

  test('unauthenticated user redirected to login when accessing member route', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/login/, { timeout: 10_000 });
  });
});
