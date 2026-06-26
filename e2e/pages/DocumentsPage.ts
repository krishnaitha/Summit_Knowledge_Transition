import { type Page, expect } from '@playwright/test';
import path from 'path';

export class DocumentsPage {
  constructor(readonly page: Page) {}

  async goto(projectId: string) {
    await this.page.goto(`/admin/projects/${projectId}/documents`);
    await this.page.waitForLoadState('networkidle');
  }

  async selectFile(filePath: string) {
    const fileInput = this.page.locator('input[type="file"]');
    await fileInput.setInputFiles(filePath);
    const filename = path.basename(filePath);
    await expect(this.page.getByText(filename)).toBeVisible({ timeout: 5_000 });
  }

  async clickUpload() {
    const uploadBtn = this.page.getByRole('button', { name: /Upload \d+ file/ });
    await expect(uploadBtn).toBeVisible();
    await uploadBtn.click();
  }

  async selectAndUpload(filePath: string) {
    await this.selectFile(filePath);
    await this.clickUpload();
  }

  async waitForJobComplete(filename: string, timeout = 60_000) {
    // Polls until the document row shows "Ready in knowledge base" or similar success text
    await expect(
      this.page.locator(`text=${filename}`).locator('xpath=ancestor::div[contains(@class,"rounded")]').getByText(/ready|knowledge base/i),
    ).toBeVisible({ timeout });
  }

  async getAcceptedFileTypes(): Promise<string> {
    const attr = await this.page.locator('input[type="file"]').getAttribute('accept');
    return attr ?? '';
  }

  async addSampleConnector(type: 'Confluence' | 'SharePoint' | 'Jira' | 'Monday' | 'OneDrive' | 'GitHub') {
    await this.page.click(`button:has-text("Sample ${type}")`);
    await this.page.waitForLoadState('networkidle');
  }

  async expectConnectorVisible(label: string) {
    await expect(this.page.getByText(label, { exact: false })).toBeVisible({ timeout: 8_000 });
  }

  async clickSyncNow() {
    await this.page.getByRole('button', { name: 'Sync now' }).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickTestConnection() {
    await this.page.getByRole('button', { name: 'Test connection' }).first().click();
    await this.page.waitForLoadState('networkidle');
  }

  async clickDryRun() {
    await this.page.getByRole('button', { name: 'Dry run' }).first().click();
    await this.page.waitForLoadState('networkidle');
  }
}
