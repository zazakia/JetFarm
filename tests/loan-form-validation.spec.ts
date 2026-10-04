import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';
import { LENDING_E2E_ENABLED, LENDING_SKIP_REASON } from './lending-gate';

// Loan management ships dark (system.lending=false): every screen below is feature-gated.
// Re-run with E2E_LENDING=1 against a profile that enables the flag.
test.beforeEach(() => test.skip(!LENDING_E2E_ENABLED, LENDING_SKIP_REASON));

async function expectValidationNotification(page: Page, submitTestId: string) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  await page.getByTestId(submitTestId).click();

  const notification = page.getByTestId('loan-form-notification');
  await expect(notification).toBeVisible();
  await expect(notification).toContainText(/Cannot save loan/i);
  await expect(notification).toContainText(/Borrower is required/i);
  expect(pageErrors).toEqual([]);
}

test.describe('Loan form validation notifications', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdmin(page);
    // Dashboard quick-access tiles were removed — reach the form by direct route.
    await safeNavigate(page, '/(admin)/loans/new');
    await expect(page).toHaveURL(/.*loans\/new.*/, { timeout: 30000 });
    await expect(page.getByTestId('save-draft-loan-button')).toBeVisible();
  });

  test('shows an inline notification instead of throwing when Save Draft is invalid', async ({ page }) => {
    await expectValidationNotification(page, 'save-draft-loan-button');
  });

  test('shows an inline notification instead of throwing when Disburse is invalid', async ({ page }) => {
    await expectValidationNotification(page, 'disburse-loan-button');
  });
});

