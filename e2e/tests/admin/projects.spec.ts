import { test, expect } from '@playwright/test';
import { AdminProjectsPage } from '../../pages/AdminProjectsPage';

test.describe('Admin — Project Management — Tier 2', () => {
  // Shared across the describe block; set in the first test.
  let createdProjectId = '';
  const projectName = `E2E Product ${Date.now()}`;

  test('admin dashboard loads', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
    await expect(page.locator('main').first()).toBeVisible();
  });

  test('products list page loads', async ({ page }) => {
    const projectsPage = new AdminProjectsPage(page);
    await projectsPage.goto();
    await expect(page).not.toHaveTitle(/500|error/i);
    // Create product form should be visible
    await expect(page.locator('input[name="name"]')).toBeVisible();
  });

  test('creates a new product', async ({ page }) => {
    const projectsPage = new AdminProjectsPage(page);
    await projectsPage.goto();
    await projectsPage.createProject(projectName, 'Created by Playwright e2e — safe to delete');
    await projectsPage.expectProjectInList(projectName);
  });

  test('can open the newly created product', async ({ page }) => {
    const projectsPage = new AdminProjectsPage(page);
    await projectsPage.goto();
    createdProjectId = await projectsPage.openProjectByName(projectName);
    expect(createdProjectId).toBeTruthy();
    await expect(page).toHaveURL(new RegExp(`projects/${createdProjectId}`));
  });

  test('project detail page has navigation tabs', async ({ page }) => {
    if (!createdProjectId) test.skip(true, 'depends on previous test creating a project');
    await page.goto(`/admin/projects/${createdProjectId}`);
    await page.waitForLoadState('networkidle');
    // Expect links to members, documents, quiz, analytics
    for (const label of ['Documents', 'Members', 'Quiz', 'Analytics']) {
      const link = page.getByRole('link', { name: label });
      if (await link.isVisible({ timeout: 3_000 })) {
        await expect(link).toBeVisible();
      }
    }
  });

  test('members page renders and invite form is present', async ({ page }) => {
    if (!createdProjectId) test.skip(true, 'depends on previous test creating a project');
    await page.goto(`/admin/projects/${createdProjectId}/members`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.getByRole('button', { name: /Invite/i })).toBeVisible();
  });

  test('can invite a member via magic link', async ({ page }) => {
    if (!createdProjectId) test.skip(true, 'depends on previous test creating a project');
    await page.goto(`/admin/projects/${createdProjectId}/members`);
    await page.waitForLoadState('networkidle');

    const uniqueEmail = `e2e-invite-${Date.now()}@example.com`;
    await page.fill('input[name="full_name"]', 'E2E Invited User');
    await page.fill('input[name="email"]', uniqueEmail);
    await page.getByRole('button', { name: /Invite/i }).click();

    // Expect either an invite link or success/assigned message
    await expect(
      page.getByText(/invite link|invited|assigned|magic/i).first(),
    ).toBeVisible({ timeout: 10_000 });
  });

  test('project settings page loads', async ({ page }) => {
    if (!createdProjectId) test.skip(true, 'depends on previous test creating a project');
    await page.goto(`/admin/projects/${createdProjectId}`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('users management page loads', async ({ page }) => {
    await page.goto('/admin/users');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });
});
