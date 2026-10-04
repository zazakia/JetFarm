import { test, expect } from '@playwright/test';
import { expectLoginScreen, loginAsLoanEncoder, loginWithCredentials } from './playwright-auth';
import { LENDING_E2E_ENABLED, LENDING_SKIP_REASON } from './lending-gate';

// Loan management ships dark (system.lending=false): every screen below is feature-gated.
// Re-run with E2E_LENDING=1 against a profile that enables the flag.
test.beforeEach(() => test.skip(!LENDING_E2E_ENABLED, LENDING_SKIP_REASON));

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

  test('Loan Encoder should load the new loan form', async ({ page }) => {
    await loginAsLoanEncoder(page);

    await expect(page.getByText('Principal (', { exact: false })).toBeVisible();
    await expect(page.getByText('Rate (%)')).toBeVisible();
  });

  test('Payment Encoder should load the payment entry page', async ({ page }) => {
    await loginWithCredentials(page, 'payment_encoder@jetfarm.com');

    await expect(page.getByText('Record Loan Payment', { exact: false })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Amount (', { exact: false })).toBeVisible();
  });

  test('Expenses Encoder should load the expense entry page', async ({ page }) => {
    await loginWithCredentials(page, 'expenses_encoder@jetfarm.com');

    await expect(page.getByText('Record Expense', { exact: false })).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Category', { exact: false })).toBeVisible();
    await expect(page.getByText('Amount (', { exact: false })).toBeVisible();
  });
});

