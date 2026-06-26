import { type Page, expect } from '@playwright/test';

export class QuizPage {
  constructor(readonly page: Page) {}

  /**
   * Must be called before page.goto() to patch the Fullscreen API.
   * The quiz component tries to enter fullscreen; this prevents failures in headless mode.
   */
  async mockFullscreen() {
    await this.page.addInitScript(() => {
      Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
        value: () => Promise.resolve(),
        configurable: true,
      });
      Object.defineProperty(document, 'exitFullscreen', {
        value: () => Promise.resolve(),
        configurable: true,
      });
      Object.defineProperty(document, 'fullscreenElement', {
        get: () => document.documentElement,
        configurable: true,
      });
    });
  }

  async goto(projectId: string) {
    await this.page.goto(`/projects/${projectId}/quiz`);
    await this.page.waitForLoadState('networkidle');
  }

  async isQuizAvailable(): Promise<boolean> {
    return this.page.locator('input[type="checkbox"]').isVisible({ timeout: 5_000 });
  }

  async confirmAndStart() {
    const checkbox = this.page.locator('input[type="checkbox"]');
    await expect(checkbox).toBeVisible();
    await checkbox.check();
    const startBtn = this.page.getByRole('button', { name: 'Start Quiz' });
    await expect(startBtn).toBeEnabled();
    await startBtn.click();
    await expect(this.page.getByText(/question/i).first()).toBeVisible({ timeout: 10_000 });
  }

  async selectAnswer(optionLetter: 'A' | 'B' | 'C' | 'D') {
    await this.page.getByRole('button', { name: optionLetter }).click();
  }

  async advance() {
    const btn = this.page.getByRole('button', {
      name: /Next Question|Complete .+ Section|Submit Quiz/,
    });
    await expect(btn).toBeEnabled({ timeout: 5_000 });
    await btn.click();
  }

  async answerAndAdvance(optionLetter: 'A' | 'B' | 'C' | 'D' = 'A') {
    await this.selectAnswer(optionLetter);
    await this.advance();
  }

  async waitForResults(timeout = 15_000) {
    await expect(
      this.page.getByText(/score|result|passed|failed|percentage/i).first(),
    ).toBeVisible({ timeout });
  }

  async requestRetake() {
    await this.page.getByRole('button', { name: /Request Retake/i }).click();
    await this.page.waitForLoadState('networkidle');
  }
}
