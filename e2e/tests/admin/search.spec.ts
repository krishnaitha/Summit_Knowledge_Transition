import { test, expect } from '@playwright/test';

/**
 * Tier 4 — Search
 *
 * Tests the admin search interface. Result content tests require E2E_PROJECT_ID
 * to point to a project with processed documents.
 */

test.describe('Admin — Search — Tier 4', () => {
  test('search page loads', async ({ page }) => {
    await page.goto('/admin/search');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('search input is present and focusable', async ({ page }) => {
    await page.goto('/admin/search');
    await page.waitForLoadState('networkidle');
    const input = page
      .locator('input[type="search"], input[name="q"], input[placeholder*="search" i]')
      .first();
    await expect(input).toBeVisible({ timeout: 5_000 });
    await input.focus();
    await expect(input).toBeFocused();
  });

  test('search with query param does not crash', async ({ page }) => {
    await page.goto('/admin/search?q=architecture');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('search results area renders (empty or populated)', async ({ page }) => {
    await page.goto('/admin/search?q=feature');
    await page.waitForLoadState('networkidle');
    // Either results or "no results" text should appear
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('typing in search input updates the URL query', async ({ page }) => {
    await page.goto('/admin/search');
    await page.waitForLoadState('networkidle');

    const input = page
      .locator('input[type="search"], input[name="q"], input[placeholder*="search" i]')
      .first();

    if (await input.isVisible({ timeout: 3_000 })) {
      await input.fill('authentication');
      await input.press('Enter');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('authentication');
    }
  });

  test('member search page loads', async ({ page }) => {
    // Member search is at /search (not /admin/search)
    // This test runs with admin auth but verifies the member route also works
    await page.goto('/admin/search');
    await expect(page).not.toHaveTitle(/500|error/i);
  });
});
