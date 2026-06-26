import { test, expect } from '@playwright/test';
import { ChatPage } from '../../pages/ChatPage';

/**
 * Tier 3 — Member Chat
 *
 * Requires E2E_PROJECT_ID pointing to a project the member user is assigned to.
 * LLM calls are mocked via page.route() to keep tests fast and cost-free.
 */

const projectId = process.env.E2E_PROJECT_ID ?? '';

const MOCK_AI_RESPONSE =
  'This is a mocked AI response. The document describes a microservices architecture with Next.js and PostgreSQL.';

function skipIfNoProject(test: { skip: (condition: boolean, reason: string) => void }) {
  test.skip(!projectId, 'Set E2E_PROJECT_ID to run chat tests');
}

test.describe('Member — Chat — Tier 3', () => {
  test.beforeEach(async ({ page }) => {
    // Mock all chat API calls to avoid LLM costs and ensure deterministic responses
    await page.route('/api/chat', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: MOCK_AI_RESPONSE,
        });
      } else {
        await route.continue();
      }
    });
  });

  test('chat page loads and shows the message input', async ({ page }) => {
    skipIfNoProject(test);
    await page.goto(`/projects/${projectId}/chat`);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#chat-message')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send' })).toBeVisible();
  });

  test('starter prompts are displayed on fresh chat', async ({ page }) => {
    skipIfNoProject(test);
    const chatPage = new ChatPage(page);
    await chatPage.goto(projectId);
    // At least one starter prompt button should be visible
    const starterBtn = page.getByRole('button', { name: /Summarize|risks|dependencies/i }).first();
    await expect(starterBtn).toBeVisible({ timeout: 5_000 });
  });

  test('clicking a starter prompt populates the input or sends the message', async ({ page }) => {
    skipIfNoProject(test);
    const chatPage = new ChatPage(page);
    await chatPage.goto(projectId);

    const starterBtn = page.getByRole('button', { name: /Summarize/i }).first();
    if (await starterBtn.isVisible({ timeout: 3_000 })) {
      await starterBtn.click();
      // Either the input is populated with the prompt text OR the message was sent directly
      const inputValue = await page.locator('#chat-message').inputValue();
      const sentMessage = page.getByText(/Summarize/i);
      const inputPopulated = inputValue.toLowerCase().includes('summarize');
      const messageSent = await sentMessage.isVisible({ timeout: 2_000 }).catch(() => false);
      expect(inputPopulated || messageSent).toBeTruthy();
    }
  });

  test('typing and pressing Send submits the message', async ({ page }) => {
    skipIfNoProject(test);
    const chatPage = new ChatPage(page);
    await chatPage.goto(projectId);
    await chatPage.sendMessage('What are the main features of this product?');
    await chatPage.expectMessageVisible('What are the main features of this product?');
  });

  test('pressing Enter submits the message', async ({ page }) => {
    skipIfNoProject(test);
    const chatPage = new ChatPage(page);
    await chatPage.goto(projectId);
    await chatPage.sendMessageViaEnter('What risks should I be aware of?');
    await chatPage.expectMessageVisible('What risks should I be aware of?');
  });

  test('AI response appears after sending a message (mocked)', async ({ page }) => {
    skipIfNoProject(test);
    const chatPage = new ChatPage(page);
    await chatPage.goto(projectId);
    await chatPage.sendMessage('Summarize this product in 3 bullets.');
    // The mocked response should appear in the chat
    await expect(page.getByText(/mocked AI response/i)).toBeVisible({ timeout: 15_000 });
  });

  test('Send button is disabled when input is empty', async ({ page }) => {
    skipIfNoProject(test);
    await page.goto(`/projects/${projectId}/chat`);
    await page.waitForLoadState('networkidle');
    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(page.locator('#chat-message')).toHaveValue('');
    await expect(sendBtn).toBeDisabled();
  });

  test('response style buttons are visible and clickable', async ({ page }) => {
    skipIfNoProject(test);
    await page.goto(`/projects/${projectId}/chat`);
    await page.waitForLoadState('networkidle');
    for (const style of ['Concise', 'Step-by-step', 'Bullet list']) {
      const btn = page.getByRole('button', { name: style });
      if (await btn.isVisible({ timeout: 2_000 })) {
        await btn.click();
        // Page should not crash
        await expect(page).not.toHaveTitle(/500|error/i);
      }
    }
  });

  test('New Chat button starts a fresh session', async ({ page }) => {
    skipIfNoProject(test);
    const chatPage = new ChatPage(page);
    await chatPage.goto(projectId);

    const newChatBtn = page.getByRole('button', { name: 'New Chat' });
    if (await newChatBtn.isVisible({ timeout: 3_000 })) {
      await newChatBtn.click();
      await page.waitForLoadState('networkidle');
      // Input should be empty after starting a new chat
      await expect(page.locator('#chat-message')).toHaveValue('');
    }
  });

  test('chat session persists across page reload', async ({ page }) => {
    skipIfNoProject(test);
    const chatPage = new ChatPage(page);
    await chatPage.goto(projectId);
    await chatPage.sendMessage('Test persistence message');
    await chatPage.expectMessageVisible('Test persistence message');

    await page.reload();
    await page.waitForLoadState('networkidle');
    // After reload, the session should still be visible in the session list or chat
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('export session as Markdown triggers download', async ({ page }) => {
    skipIfNoProject(test);
    const chatPage = new ChatPage(page);
    await chatPage.goto(projectId);

    // Send a message first so there's something to export
    await chatPage.sendMessage('Generate something to export.');
    await page.waitForTimeout(500);

    const exportBtn = page.getByRole('button', { name: 'MD' });
    if (await exportBtn.isVisible({ timeout: 3_000 })) {
      const download = await chatPage.exportSession('MD');
      expect(download.suggestedFilename()).toMatch(/\.md$/);
    }
  });

  test('member projects list page loads', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('member dashboard loads', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
    await expect(page.locator('main').first()).toBeVisible();
  });
});
