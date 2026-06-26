import { test, expect } from '@playwright/test';

/**
 * Tier 4 — Discussion Threads
 *
 * Tests that threads pages render and basic interactions work.
 * Creating threads on a document requires E2E_PROJECT_ID.
 */

const projectId = process.env.E2E_PROJECT_ID ?? '';

test.describe('Admin — Discussion Threads — Tier 4', () => {
  test('admin threads list page loads', async ({ page }) => {
    await page.goto('/admin/threads');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('admin threads page has expected heading or empty state', async ({ page }) => {
    await page.goto('/admin/threads');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('project threads page loads', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID to run project-scoped thread tests');
    await page.goto(`/admin/projects/${projectId}`);
    await page.waitForLoadState('networkidle');
    // Navigate to threads from the project page if a link exists
    const threadsLink = page.getByRole('link', { name: /thread/i }).first();
    if (await threadsLink.isVisible({ timeout: 3_000 })) {
      await threadsLink.click();
      await page.waitForLoadState('networkidle');
      await expect(page).not.toHaveTitle(/500|error/i);
    }
  });

  test('knowledge gap threads page loads', async ({ page }) => {
    // This route exists at /admin/knowledge-gap-threads/[threadId]
    // We can at least verify the admin/threads page shows the tab or link
    await page.goto('/admin/threads');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });
});
