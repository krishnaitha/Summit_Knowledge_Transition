import { type Page, type Download, expect } from '@playwright/test';

export class ChatPage {
  constructor(readonly page: Page) {}

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/chat`);
    await this.page.waitForLoadState('networkidle');
  }

  async sendMessage(text: string) {
    await this.page.fill('#chat-message', text);
    await this.page.getByRole('button', { name: 'Send' }).click();
  }

  async sendMessageViaEnter(text: string) {
    await this.page.fill('#chat-message', text);
    await this.page.press('#chat-message', 'Enter');
  }

  async waitForAssistantResponse(timeout = 20_000) {
    // Chat responses typically render inside a .prose container or a data-role="assistant" element
    await this.page.waitForTimeout(300);
    await expect(
      this.page.locator('[data-role="assistant"], .prose, [class*="assistant"]').first(),
    ).toBeVisible({ timeout });
  }

  async clickStarterPrompt(partialText: string) {
    await this.page.getByRole('button', { name: new RegExp(partialText, 'i') }).first().click();
  }

  async setResponseStyle(style: 'Default' | 'Concise' | 'Step-by-step' | 'Bullet list') {
    await this.page.getByRole('button', { name: style }).click();
  }

  async startNewChat() {
    await this.page.getByRole('button', { name: 'New Chat' }).click();
    await this.page.waitForLoadState('networkidle');
  }

  async exportSession(format: 'MD' | 'PDF'): Promise<Download> {
    const [download] = await Promise.all([
      this.page.waitForEvent('download'),
      this.page.getByRole('button', { name: format }).click(),
    ]);
    return download;
  }

  async expectMessageVisible(text: string) {
    await expect(this.page.getByText(text, { exact: false })).toBeVisible({ timeout: 5_000 });
  }

  async inputHasValue(expected: string) {
    await expect(this.page.locator('#chat-message')).toHaveValue(expected);
  }
}
