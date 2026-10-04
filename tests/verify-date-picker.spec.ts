import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsCollector, loginAsPaymentEncoder, safeNavigate } from './playwright-auth';
import { LENDING_E2E_ENABLED, LENDING_SKIP_REASON } from './lending-gate';

// Loan management ships dark (system.lending=false): every screen below is feature-gated.
// Re-run with E2E_LENDING=1 against a profile that enables the flag.
test.beforeEach(() => test.skip(!LENDING_E2E_ENABLED, LENDING_SKIP_REASON));

test.describe('DatePicker Web Verification', () => {

  test('Admin New Payment form has DatePicker', async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdmin(page);

    // Dashboard "Record Payment" tile was removed — reach the form by direct route
    await safeNavigate(page, '/(admin)/payments/new');
    await expect(page.locator('[data-testid="page-title"]')).toBeVisible({ timeout: 30000 });

    // Look for the Date of Payment label
    const dateLabel = page.getByText(/Date of Payment/i).first();
    await expect(dateLabel).toBeVisible({ timeout: 30000 });
    
    // Check for web input
    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeAttached();
  });

  test('Admin Payments list can open edit payment form with DatePicker', async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdmin(page);

    // Dashboard "Record Payment" tile was removed — reach the list by direct route
    await safeNavigate(page, '/(admin)/payments');

    const editButton = page.locator('[data-testid^="edit-payment-"]').first();
    const emptyState = page.getByText('No payments found', { exact: false });

    try {
      await expect(editButton).toBeVisible({ timeout: 15000 });
    } catch {
      await expect(emptyState).toBeVisible({ timeout: 60000 });
      return;
    }

    const testId = await editButton.getAttribute('data-testid');
    const paymentId = testId?.replace('edit-payment-', '');
    expect(paymentId).toBeTruthy();
    
    await editButton.click();

    await expect(page.getByText('Edit Payment', { exact: true })).toBeVisible({ timeout: 60000 });
    await expect(page.locator('input[type="date"]').first()).toBeAttached();
  });

  test('Payment Encoder form has DatePicker', async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsPaymentEncoder(page);
    await expect(page.getByText(/Record.*Payment/i).first()).toBeVisible({ timeout: 60000 });
    
    const dateLabel = page.getByText(/Date of Payment/i).first();
    await expect(dateLabel).toBeVisible({ timeout: 30000 });
    
    await expect(page.locator('input[type="date"]').first()).toBeAttached();
  });

  test('Collection Sheet header has DatePicker', async ({ page }) => {
    await page.setDefaultTimeout(120000);
    
    // Login as collector
    await loginAsCollector(page);
    
    await page.getByText('Field List').first().click();

    // Check for the header date label
    await expect(page.getByText(/Sheet Date/i).first()).toBeVisible({ timeout: 60000 });
    
    // The date picker input should be present
    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeAttached();
  });

  test.skip('DatePicker interaction updates UI label', async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdmin(page);
    
    await safeNavigate(page, '/payments/new', /Record Payment/i);

    const dateInput = page.locator('input[type="date"]').first();
    await expect(dateInput).toBeAttached({ timeout: 30000 });

    // Use evaluate to set value and trigger events
    const targetDate = '2025-12-25';
    await dateInput.evaluate((el: HTMLInputElement, val: string) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.blur();
    }, targetDate);
    
    // Also try fill as a backup
    await dateInput.fill(targetDate);
    await dateInput.blur();

    // Verify the label updates - format is MMM d, yyyy
    await expect(page.locator('body')).toHaveText(/Dec 2[456], 2025/, { timeout: 30000 });
  });

});

