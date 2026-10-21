import { test, expect } from '@playwright/test';
import { expectLoginScreen, loginWithCredentials } from './playwright-auth';

// The loan and payment encoders were removed with the lending domain; the expenses encoder is a
// kept role and drives the same journal entries the agribusiness build posts.

test.describe('Encoder Modules E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(60000);
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.goto('/login');
    await expectLoginScreen(page);
  });

  test('Expenses Encoder should load the expense entry page', async ({ page }) => {
    await loginWithCredentials(page, 'expenses_encoder@agri-one.com');

    await expect(page.getByText('Record Expense', { exact: false }).first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Category', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Amount (', { exact: false }).first()).toBeVisible();
  });
});
