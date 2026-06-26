import { type Page, expect } from '@playwright/test';

export class AdminProjectsPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/admin/projects');
    await this.page.waitForLoadState('networkidle');
  }

  async createProject(name: string, description = '') {
    await this.page.fill('input[name="name"]', name);
    if (description) {
      await this.page.fill('textarea[name="description"]', description);
    }
    await this.page.getByRole('button', { name: 'Create product' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async expectProjectInList(name: string) {
    await expect(this.page.getByText(name, { exact: false })).toBeVisible({ timeout: 8_000 });
  }

  async openProjectByName(name: string): Promise<string> {
    await this.page.getByText(name, { exact: false }).click();
    await this.page.waitForURL(/admin\/projects\/[^/]+$/, { timeout: 8_000 });
    const match = this.page.url().match(/projects\/([^/?#]+)/);
    if (!match) throw new Error(`Could not extract project ID from URL: ${this.page.url()}`);
    return match[1];
  }
}
