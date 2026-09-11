import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './playwright-auth';

test.describe('Admin Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    await loginAsAdmin(page);
  });

  test('should display admin dashboard with Admin Portal heading', async ({ page }) => {
    await expect(page.getByTestId('admin-portal-title')).toBeVisible();
  });

  test('should display KPI stat cards', async ({ page }) => {
    const kpis = [
      'Active Loans',
      'Outstanding',
      'Total Disbursed',
      'Collected Today',
      'This Month',
      'Cash on Hand',
      'Cash on Bank',
      'Petty Cash',
      'Members',
    ];

    for (const kpi of kpis) {
      await expect(page.getByText(kpi, { exact: true }).first()).toBeVisible({ timeout: 30000 });
    }
  });

  test('should display quick action buttons', async ({ page }) => {
    const actions = [
      'New Loan',
      'New Borrower',
      'Record Payment',
      'Add Expense',
      'Cash Vault',
    ];

    for (const action of actions) {
      await expect(page.getByText(action, { exact: false }).first()).toBeVisible({ timeout: 15000 });
    }
  });

  test('should navigate to Borrowers when clicking New Borrower', async ({ page }) => {
    // Use regex for case-insensitive and match only visible elements
    await page.getByText(/New Borrower/i).first().click({ force: true });
    await expect(page).toHaveURL(/.*borrowers.*/, { timeout: 30000 });
  });

  test('should navigate to Loans when clicking New Loan', async ({ page }) => {
    await page.getByText(/New Loan/i).first().click({ force: true });
    await expect(page).toHaveURL(/.*loans.*/, { timeout: 30000 });
  });

  test('should show Sync status in header', async ({ page }) => {
    // Scroll to top to ensure the header (which contains SyncStatusIndicator) is visible
    await page.evaluate(() => window.scrollTo(0, 0));
    // Use testID for more stable identification
    const syncIndicator = page.getByTestId('sync-status-indicator').first();
    await expect(syncIndicator).toBeVisible({ timeout: 45000 });
    
    // Also verify it contains some relevant text
    const text = await syncIndicator.innerText();
    expect(text).toMatch(/Synced|Syncing|Sync Fail|Pend/i);
  });
});

