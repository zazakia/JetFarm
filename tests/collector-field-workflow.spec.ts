import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './playwright-auth';

test.describe('Collector field workflow UI', () => {
  test.describe.configure({ retries: 0, timeout: 60000 });

  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(90000);
    page.on('dialog', async (dialog) => dialog.accept());
    await loginWithCredentials(page, 'cresencio.junco@poscursor.com');
    await expect(page.getByText(/Collector Portal/i).first()).toBeVisible({ timeout: 60000 });
  });

  test('shows route summary and field actions on collection sheet', async ({ page }) => {
    await page.getByText(/Field List/i).first().click();
    await expect(page.getByText(/Collection Sheet/i).first()).toBeVisible({ timeout: 60000 });

    await expect(page.getByTestId('collector-route-summary')).toHaveCount(1);
    await expect(page.getByText(/Route Summary/i)).toBeVisible();
    await expect(page.getByText(/Expected/i).first()).toBeVisible();
    await expect(page.getByText(/Overdue/i).first()).toBeVisible();

    const firstCall = page.locator('[data-testid^="collector-call-"]').first();
    const firstSms = page.locator('[data-testid^="collector-sms-"]').first();
    const hasCollectionItems = await firstCall.isVisible().catch(() => false);

    if (hasCollectionItems) {
      await expect(firstCall).toBeVisible();
      await expect(firstSms).toBeVisible();
      await expect(page.getByText(/Quick Collect/i).first()).toBeVisible();
    } else {
      await expect(page.getByText(/All collections done|No matches found/i).first()).toBeVisible();
    }
  });

  test('shows remittance controls and balance context', async ({ page }) => {
    await page.getByText(/Remit Cash/i).first().click();
    await expect(page.getByText(/Submit Cash/i).first()).toBeVisible({ timeout: 60000 });

    const amountInput = page.getByTestId('collector-remittance-amount-input');
    await amountInput.scrollIntoViewIfNeeded();
    await expect(amountInput).toBeVisible();
    await page.getByTestId('collector-remittance-notes-input').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('collector-remittance-notes-input')).toBeVisible();
    await page.getByTestId('collector-remittance-submit-button').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('collector-remittance-submit-button')).toBeVisible();
    await expect(page.getByText(/Collected Today/i)).toBeVisible();
    await expect(page.getByText(/Total Cash Held/i)).toBeVisible();

    await amountInput.fill('0');
    await page.getByTestId('collector-remittance-submit-button').scrollIntoViewIfNeeded();
    await expect(page.getByTestId('collector-remittance-submit-button')).toBeVisible();
  });
});

