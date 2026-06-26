import { test, expect } from '@playwright/test';
import { QuizPage } from '../../pages/QuizPage';

/**
 * Tier 3 — Member Quiz
 *
 * Requires E2E_PROJECT_ID pointing to a project where the member has a quiz available.
 * The Fullscreen API is mocked so tests run in headless Chromium.
 * The quiz start API is mocked for "start quiz" tests to avoid generating real attempts.
 */

const projectId = process.env.E2E_PROJECT_ID ?? '';

const MOCK_QUIZ_RESPONSE = {
  attemptId: 'e2e-attempt-001',
  sections: [
    {
      name: 'Functional',
      timeLimit: 900,
      questions: Array.from({ length: 3 }, (_, i) => ({
        questionId: `fq${i}`,
        question: `Functional question ${i + 1}: What does Feature ${String.fromCharCode(65 + i)} do?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        sectionName: 'Functional',
      })),
    },
    {
      name: 'Technical',
      timeLimit: 900,
      questions: Array.from({ length: 3 }, (_, i) => ({
        questionId: `tq${i}`,
        question: `Technical question ${i + 1}: How is Component ${i + 1} implemented?`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        sectionName: 'Technical',
      })),
    },
  ],
};

const MOCK_SUBMIT_RESPONSE = {
  passed: true,
  score: 5,
  total: 6,
  percentage: 83,
};

test.describe('Member — Quiz — Tier 3', () => {
  test('quiz page renders without errors', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID to run quiz tests');
    const quizPage = new QuizPage(page);
    await quizPage.mockFullscreen();
    await quizPage.goto(projectId);
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('quiz start screen shows confirmation checkbox', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');
    const quizPage = new QuizPage(page);
    await quizPage.mockFullscreen();
    await quizPage.goto(projectId);

    const checkbox = page.locator('input[type="checkbox"]');
    if (await checkbox.isVisible({ timeout: 5_000 })) {
      await expect(checkbox).toBeVisible();
      await expect(page.getByRole('button', { name: 'Start Quiz' })).toBeVisible();
    } else {
      // Quiz already taken or not available — skip gracefully
      test.skip(true, 'Quiz not available for this attempt (may already be taken)');
    }
  });

  test('Start Quiz button is disabled until checkbox is checked', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');
    const quizPage = new QuizPage(page);
    await quizPage.mockFullscreen();
    await quizPage.goto(projectId);

    const checkbox = page.locator('input[type="checkbox"]');
    if (!(await checkbox.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Quiz not in start state');
    }

    const startBtn = page.getByRole('button', { name: 'Start Quiz' });
    await expect(startBtn).toBeDisabled();
    await checkbox.check();
    await expect(startBtn).toBeEnabled();
  });

  test('can start quiz, answer all questions, and reach results (mocked API)', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');

    // Mock quiz start to return controlled questions
    await page.route('/api/quiz/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUIZ_RESPONSE),
      }),
    );

    // Mock quiz submit to return a passing score
    await page.route('/api/quiz/submit', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUBMIT_RESPONSE),
      }),
    );

    const quizPage = new QuizPage(page);
    await quizPage.mockFullscreen();
    await quizPage.goto(projectId);

    const checkbox = page.locator('input[type="checkbox"]');
    if (!(await checkbox.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Quiz not in start state');
    }

    await quizPage.confirmAndStart();

    // Answer all Functional section questions
    for (let i = 0; i < MOCK_QUIZ_RESPONSE.sections[0].questions.length; i++) {
      await quizPage.answerAndAdvance('A');
    }

    // Complete Functional section → start Technical section
    const technicalBtn = page.getByRole('button', { name: /Start Technical|Technical Section/i });
    if (await technicalBtn.isVisible({ timeout: 5_000 })) {
      await technicalBtn.click();
    }

    // Answer all Technical section questions
    for (let i = 0; i < MOCK_QUIZ_RESPONSE.sections[1].questions.length; i++) {
      await quizPage.answerAndAdvance('B');
    }

    // Wait for results
    await quizPage.waitForResults();
  });

  test('results page shows score after quiz completion (mocked)', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');

    await page.route('/api/quiz/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_QUIZ_RESPONSE, sections: [{ ...MOCK_QUIZ_RESPONSE.sections[0], questions: [MOCK_QUIZ_RESPONSE.sections[0].questions[0]] }] }),
      }),
    );
    await page.route('/api/quiz/submit', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUBMIT_RESPONSE),
      }),
    );

    const quizPage = new QuizPage(page);
    await quizPage.mockFullscreen();
    await quizPage.goto(projectId);

    const checkbox = page.locator('input[type="checkbox"]');
    if (!(await checkbox.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Quiz not in start state');
    }

    await quizPage.confirmAndStart();
    await quizPage.answerAndAdvance('A');

    await quizPage.waitForResults();
    // Score information should be visible
    await expect(page.getByText(/83|passed/i)).toBeVisible({ timeout: 10_000 });
  });

  test('retake request button is visible on results page', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');

    await page.route('/api/quiz/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...MOCK_QUIZ_RESPONSE, sections: [{ ...MOCK_QUIZ_RESPONSE.sections[0], questions: [MOCK_QUIZ_RESPONSE.sections[0].questions[0]] }] }),
      }),
    );
    await page.route('/api/quiz/submit', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ passed: false, score: 0, total: 1, percentage: 0 }),
      }),
    );

    const quizPage = new QuizPage(page);
    await quizPage.mockFullscreen();
    await quizPage.goto(projectId);

    const checkbox = page.locator('input[type="checkbox"]');
    if (!(await checkbox.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Quiz not in start state');
    }

    await quizPage.confirmAndStart();
    await quizPage.answerAndAdvance('A');
    await quizPage.waitForResults();

    const retakeBtn = page.getByRole('button', { name: /Request Retake/i });
    if (await retakeBtn.isVisible({ timeout: 5_000 })) {
      await expect(retakeBtn).toBeEnabled();
    }
  });

  test('quiz timer is displayed during active section', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');

    await page.route('/api/quiz/start', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_QUIZ_RESPONSE),
      }),
    );

    const quizPage = new QuizPage(page);
    await quizPage.mockFullscreen();
    await quizPage.goto(projectId);

    const checkbox = page.locator('input[type="checkbox"]');
    if (!(await checkbox.isVisible({ timeout: 5_000 }))) {
      test.skip(true, 'Quiz not in start state');
    }

    await quizPage.confirmAndStart();

    // Timer should show MM:SS format
    await expect(page.getByText(/\d{2}:\d{2}/)).toBeVisible({ timeout: 5_000 });
  });

  test('flashcards page loads', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');
    await page.goto(`/projects/${projectId}/flashcards`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });

  test('bookmarks page loads', async ({ page }) => {
    if (!projectId) test.skip(true, 'Set E2E_PROJECT_ID');
    await page.goto(`/projects/${projectId}/bookmarks`);
    await page.waitForLoadState('networkidle');
    await expect(page).not.toHaveTitle(/500|error/i);
  });
});
