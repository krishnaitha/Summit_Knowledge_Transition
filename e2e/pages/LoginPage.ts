import { type Page, expect } from '@playwright/test';

export class LoginPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto('/login');
    await expect(this.page.locator('#email')).toBeVisible();
  }

  async login(email: string, password: string) {
    await this.page.locator('#email').click();
    await this.page.locator('#email').pressSequentially(email, { delay: 30 });
    await this.page.locator('#password').click();
    await this.page.locator('#password').pressSequentially(password, { delay: 30 });
    await this.page.click('button:has-text("Sign in")');
  }

  async expectOnLoginPage() {
    await expect(this.page).toHaveURL(/login/);
    await expect(this.page.locator('#email')).toBeVisible();
  }

  async expectErrorVisible() {
    await expect(
      this.page
        .locator('[role="alert"], .text-rose-600, .text-red-600, .text-destructive')
        .first(),
    ).toBeVisible({ timeout: 5_000 });
  }

  async expectSignedOutBanner() {
    await expect(this.page.getByText(/signed out/i)).toBeVisible({ timeout: 5_000 });
  }
}
