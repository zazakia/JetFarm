import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './playwright-auth';

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
    await page.getByText(/New Loan/i).first().click({ force: true });
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

