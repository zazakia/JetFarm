import { test, expect } from '@playwright/test';
import { loginWithCredentials } from './playwright-auth';
import { LENDING_E2E_ENABLED, LENDING_SKIP_REASON } from './lending-gate';

// Loan management ships dark (system.lending=false): every screen below is feature-gated.
// Re-run with E2E_LENDING=1 against a profile that enables the flag.
test.beforeEach(() => test.skip(!LENDING_E2E_ENABLED, LENDING_SKIP_REASON));

test.describe('Collector Module E2E', () => {
  async function loginCollector(page: any) {
    await loginWithCredentials(page, 'cresencio.junco@jetfarm.com');
    await expect(page.getByText('Collector Portal', { exact: false }).first()).toBeVisible({ timeout: 60000 });
  }

  test.beforeEach(async ({ page }) => {
    // Add console listener to see browser console logs
    page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));

    await page.setDefaultTimeout(60000);
    await loginCollector(page);
  });

  test('should display collector dashboard with correct KPI cards', async ({ page }) => {
    // These labels come from the current KPI grid in (collector)/index.tsx
    await expect(page.locator('text=Active Cases')).toBeVisible();
    await expect(page.locator('text=Outstanding')).toBeVisible();
    await expect(page.locator('text=Collected')).toBeVisible();
    await expect(page.locator('text=Efficiency')).toBeVisible();
  });

  test('should display borrower list with assigned clients', async ({ page }) => {
    await expect(
      page.locator('text=/\\d+ Assigned/')
        .or(page.locator('text=No assignments yet'))
        .first()
    ).toBeVisible({ timeout: 20000 });
  });

  test('should show sync status indicator', async ({ page }) => {
    // SyncStatusIndicator renders current short labels like Synced, Syncing, Sync Fail, or N Pend
    await expect(
      page.getByTestId('sync-status-indicator').getByText(/Synced|Syncing|Sync Fail|\d+ Pend/)
    ).toBeVisible({ timeout: 60000 });
  });
});

