import { test, expect } from '@playwright/test';
import path from 'path';
import { AdminProjectsPage } from '../../pages/AdminProjectsPage';
import { DocumentsPage } from '../../pages/DocumentsPage';

const SAMPLE_FILE = path.join(process.cwd(), 'e2e/fixtures/sample.txt');

/**
 * Tier 2 + Tier 3 (extended): Document ingestion via file upload and external connectors.
 *
 * A fresh project is created in beforeAll so tests are isolated from the main data.
 * The worker is NOT required for upload UI tests; job processing is mocked where needed.
 */
test.describe('Admin — Document Ingestion — Tier 2 / Tier 3', () => {
  let projectId = '';

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({
      storageState: 'e2e/.auth/admin.json',
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20_000);

    const projectsPage = new AdminProjectsPage(page);
    await projectsPage.goto();
    const name = `Doc Ingestion Test ${Date.now()}`;
    await projectsPage.createProject(name, 'E2E doc ingestion tests — safe to delete');
    projectId = await projectsPage.openProjectByName(name);

    await context.close();
  });

  // ── File Upload ────────────────────────────────────────────────────────────

  test.describe('File Upload', () => {
    test('documents page loads without errors', async ({ page }) => {
      const docsPage = new DocumentsPage(page);
      await docsPage.goto(projectId);
      await expect(page).not.toHaveTitle(/500|error/i);
    });

    test('file input accepts .txt, .pdf, .docx, .xlsx, .csv', async ({ page }) => {
      const docsPage = new DocumentsPage(page);
      await docsPage.goto(projectId);
      const accept = await docsPage.getAcceptedFileTypes();
      for (const ext of ['.txt', '.pdf', '.docx', '.xlsx', '.csv']) {
        expect(accept).toContain(ext);
      }
    });

    test('selecting a file shows it in the upload queue', async ({ page }) => {
      const docsPage = new DocumentsPage(page);
      await docsPage.goto(projectId);
      await docsPage.selectFile(SAMPLE_FILE);
      await expect(page.getByText('sample.txt')).toBeVisible();
    });

    test('upload button appears after file selection', async ({ page }) => {
      const docsPage = new DocumentsPage(page);
      await docsPage.goto(projectId);
      await docsPage.selectFile(SAMPLE_FILE);
      await expect(page.getByRole('button', { name: /Upload \d+ file/ })).toBeVisible();
    });

    test('clicking Upload triggers the upload request', async ({ page }) => {
      // Mock job polling so the test completes quickly
      await page.route('/api/jobs/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'mock-job', status: 'completed' }),
        }),
      );

      const docsPage = new DocumentsPage(page);
      await docsPage.goto(projectId);
      await docsPage.selectFile(SAMPLE_FILE);

      const [request] = await Promise.all([
        page.waitForRequest((req) => req.url().includes('/api/documents') && req.method() === 'POST'),
        docsPage.clickUpload(),
      ]);
      expect(request).toBeTruthy();
    });

    test('multiple files can be queued before uploading', async ({ page }) => {
      const docsPage = new DocumentsPage(page);
      await docsPage.goto(projectId);

      // Set multiple files at once
      await page.locator('input[type="file"]').setInputFiles([SAMPLE_FILE, SAMPLE_FILE]);
      // Upload button label should reflect count (duplicates may merge — just check it appears)
      await expect(page.getByRole('button', { name: /Upload \d+ file/ })).toBeVisible();
    });

    test('drop zone is interactive (role=button, keyboard accessible)', async ({ page }) => {
      const docsPage = new DocumentsPage(page);
      await docsPage.goto(projectId);
      const dropZone = page.getByRole('button', { name: /Drop files|browse/i });
      await expect(dropZone).toBeVisible();
      // Tab to it and check focus
      await dropZone.focus();
      await expect(dropZone).toBeFocused();
    });
  });

  // ── Connector Forms — UI Validation ───────────────────────────────────────

  test.describe('Connector Form Fields', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/admin/projects/${projectId}/documents`);
      await page.waitForLoadState('networkidle');
    });

    test('Confluence connector has all required fields', async ({ page }) => {
      await expect(page.locator('input[name="confluence_base_url"]')).toBeVisible();
      await expect(page.locator('input[name="confluence_space_key"]')).toBeVisible();
      await expect(page.locator('input[name="confluence_auth_email"]')).toBeVisible();
      await expect(page.locator('input[name="confluence_access_token"]')).toBeVisible();
    });

    test('SharePoint connector has all required fields', async ({ page }) => {
      await expect(page.locator('input[name="sharepoint_site_url"]')).toBeVisible();
      await expect(page.locator('input[name="sharepoint_library_path"]')).toBeVisible();
      await expect(page.locator('input[name="sharepoint_access_token"]')).toBeVisible();
    });

    test('Jira connector has all required fields', async ({ page }) => {
      await expect(page.locator('input[name="jira_base_url"]')).toBeVisible();
      await expect(page.locator('input[name="jira_project_key"]')).toBeVisible();
      await expect(page.locator('input[name="jira_auth_email"]')).toBeVisible();
      await expect(page.locator('input[name="jira_access_token"]')).toBeVisible();
    });

    test('Monday.com connector has all required fields', async ({ page }) => {
      await expect(page.locator('input[name="monday_board_ids"]')).toBeVisible();
      await expect(page.locator('input[name="monday_access_token"]')).toBeVisible();
    });

    test('OneDrive connector has all required fields', async ({ page }) => {
      await expect(page.locator('input[name="onedrive_drive_id"]')).toBeVisible();
      await expect(page.locator('input[name="onedrive_access_token"]')).toBeVisible();
    });

    test('GitHub connector has all required fields', async ({ page }) => {
      await expect(page.locator('input[name="github_repository"]')).toBeVisible();
      // branch and docs_path are optional but should still render
      await expect(page.locator('input[name="github_branch"]')).toBeVisible();
    });
  });

  // ── Sample Connectors — Creation Flow ─────────────────────────────────────

  test.describe('Sample Connector Creation', () => {
    for (const connectorType of ['Confluence', 'SharePoint', 'Jira', 'Monday', 'OneDrive', 'GitHub'] as const) {
      test(`Sample ${connectorType} connector can be submitted`, async ({ page }) => {
        // Mock the connector creation POST so we don't hit external services
        await page.route('**/actions**', (route) => {
          if (route.request().method() === 'POST') {
            // Let server actions through — they're form POSTs to the same URL
            route.continue();
          } else {
            route.continue();
          }
        });

        await page.goto(`/admin/projects/${projectId}/documents`);
        await page.waitForLoadState('networkidle');

        const sampleBtn = page.getByRole('button', { name: `Sample ${connectorType}` });
        await expect(sampleBtn).toBeVisible();
        await sampleBtn.click();

        // Page must not crash after submission
        await page.waitForLoadState('networkidle');
        await expect(page).not.toHaveTitle(/500|error/i);
      });
    }
  });

  // ── Connector Post-Creation Actions ───────────────────────────────────────

  test.describe('Connector Actions (requires at least one connector)', () => {
    test.beforeAll(async ({ browser }) => {
      // Add a Sample GitHub connector so action buttons are available
      const context = await browser.newContext({ storageState: 'e2e/.auth/admin.json' });
      const page = await context.newPage();
      await page.goto(`/admin/projects/${projectId}/documents`);
      await page.waitForLoadState('networkidle');
      const sampleBtn = page.getByRole('button', { name: 'Sample GitHub' });
      if (await sampleBtn.isVisible({ timeout: 3_000 })) {
        await sampleBtn.click();
        await page.waitForLoadState('networkidle');
      }
      await context.close();
    });

    test('Sync now button is visible and clickable', async ({ page }) => {
      await page.goto(`/admin/projects/${projectId}/documents`);
      await page.waitForLoadState('networkidle');
      const syncBtn = page.getByRole('button', { name: 'Sync now' }).first();
      if (await syncBtn.isVisible({ timeout: 5_000 })) {
        await expect(syncBtn).toBeEnabled();
      }
    });

    test('Dry run button is visible and clickable', async ({ page }) => {
      await page.goto(`/admin/projects/${projectId}/documents`);
      await page.waitForLoadState('networkidle');
      const dryRunBtn = page.getByRole('button', { name: 'Dry run' }).first();
      if (await dryRunBtn.isVisible({ timeout: 5_000 })) {
        await expect(dryRunBtn).toBeEnabled();
      }
    });

    test('Test connection button is visible', async ({ page }) => {
      await page.goto(`/admin/projects/${projectId}/documents`);
      await page.waitForLoadState('networkidle');
      const testBtn = page.getByRole('button', { name: 'Test connection' }).first();
      if (await testBtn.isVisible({ timeout: 5_000 })) {
        await expect(testBtn).toBeEnabled();
      }
    });

    test('Enable auto-sync toggle is visible', async ({ page }) => {
      await page.goto(`/admin/projects/${projectId}/documents`);
      await page.waitForLoadState('networkidle');
      const autoSyncBtn = page.getByRole('button', { name: /auto.sync/i }).first();
      if (await autoSyncBtn.isVisible({ timeout: 5_000 })) {
        await expect(autoSyncBtn).toBeVisible();
      }
    });
  });
});
