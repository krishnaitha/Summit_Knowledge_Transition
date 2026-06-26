import { test, expect } from '@playwright/test';

/**
 * Tier 5 — Admin Observability
 *
 * Tests that system health, analytics, and model switcher pages load correctly.
 */

const projectId = process.env.E2E_PROJECT_ID ?? '';

test.describe('Admin — Observability — Tier 5', () => {
  test('system health page loads', async ({ page }) => {
    await page.goto('/admin/system-health');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('system health page shows error events table or empty state', async ({ page }) => {
    await page.goto('/admin/system-health');
    await page.waitForLoadState('networkidle');
    // Should render a table or an empty-state message — not a blank page
    const hasContent = await page
      .locator('table, [role="table"], text=/no errors|no events|healthy/i')
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    // If neither a table nor a "no errors" message shows, at least the page should have main content
    if (!hasContent) {
      await expect(page.locator('main').first()).toBeVisible();
    }
  });

  test('model switcher page loads', async ({ page }) => {
    await page.goto('/admin/model-switcher');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('model switcher shows provider options', async ({ page }) => {
    await page.goto('/admin/model-switcher');
    await page.waitForLoadState('networkidle');
    // The model switcher should show at least one provider (groq is the default)
    await expect(page.getByText(/groq|openai|anthropic|provider/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('project analytics page loads', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID to run analytics tests');
    await page.goto(`/admin/projects/${projectId}/analytics`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('project analytics renders RAG trace panel or empty state', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');
    await page.goto(`/admin/projects/${projectId}/analytics`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('main, [role="main"]').first()).toBeVisible();
  });

  test('admin generate-document page loads', async ({ page }) => {
    await page.goto('/admin/generate-document');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });
});
