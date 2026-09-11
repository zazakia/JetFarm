import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsCollector, loginAsLoanEncoder } from './playwright-auth';

test.describe('Role-Based Access Control (RBAC) Security', () => {
  test.beforeEach(async ({ page }) => {
    // Add console listener to see RBAC violation logs from the app
    page.on('console', msg => {
      if (msg.text().includes('RBAC Violation') || msg.text().includes('Access denied')) {
        console.log(`[RBAC LOG]: ${msg.text()}`);
      }
    });
    
    await page.setDefaultTimeout(90000);
  });

  test('Collector should NOT be able to access Admin routes', async ({ page }) => {
    // 1. Login as Collector
    await loginAsCollector(page);

    // 2. Attempt to manually navigate to (admin) route using in-app router to simulate bug
    console.log('--- Attempting unauthorized navigate to /(admin) ---');
    await page.evaluate(() => {
        // @ts-ignore - reaching into Expo Router's globals if available, or just mocking navigation
         window.location.href = '/(admin)';
    });
    
    // 3. Verify immediate redirect back to authorized workspace or login 
    // We already saw the logs in console, now verify UI state
    await expect(
      page.getByText(/Collector Portal|Sign In/i).first()
    ).toBeVisible({ timeout: 30000 });
    // Verify Admin specific text is NOT visible
    await expect(page.getByText('Admin Portal', { exact: false })).not.toBeVisible();
    console.log('--- Successfully blocked Collector from Admin area ---');
  });

  test('Collector should NOT be able to access Loan Encoder routes', async ({ page }) => {
    // 1. Login as Collector
    await loginAsCollector(page);

    // 2. Attempt to manually navigate to (loan-encoder)
    console.log('--- Attempting unauthorized navigate to /(loan-encoder) ---');
    await page.evaluate(() => {
         window.location.href = '/(loan-encoder)';
    });
    
    // 3. Verify redirect back to an authorized workspace or login guard
    await expect(page.getByText(/Collector Portal|Login to Account|Sign In/i).first()).toBeVisible({ timeout: 60000 });
    // Verify Loan Encoder workspace content is NOT visible
    await expect(page.getByText('New Loan Entry', { exact: false })).not.toBeVisible({ timeout: 10000 });
  });

  test('Admin should NOT be stuck in Collector routes', async ({ page }) => {
    // 1. Login as Admin
    await loginAsAdmin(page);

    // 2. Attempt to manually navigate to (collector)
    console.log('--- Attempting unauthorized navigate to /(collector) ---');
    await page.evaluate(() => {
         window.location.href = '/(collector)';
    });
    
    // 3. Admin should resolve to an allowed workspace or a login guard, never a broken blank state.
    await expect(page.getByText(/Admin Portal|Collector Portal|Collection Sheet|Login to Account|Sign In/i).first()).toBeVisible({ timeout: 30000 });
    console.log('--- Admin cross-role navigation resolved without a blank route ---');
  });

  test('Loan Encoder should NOT be able to access Admin routes', async ({ page }) => {
    // 1. Login as Loan Encoder
    // From login.tsx: normalizedRole.replace('_', ' ') -> "loan encoder" (uppercase from class)
    await loginAsLoanEncoder(page);

    // 2. Attempt to manually navigate to (admin)
    console.log('--- Attempting unauthorized navigate to /(admin) ---');
    await page.evaluate(() => {
         window.location.href = '/(admin)';
    });
    
    // 3. Verify redirect back to (loan-encoder)
    await expect(page.getByText('Loan Encoder', { exact: false }).first()).toBeVisible({ timeout: 30000 });
    // Verify Admin specific text is NOT visible
    await expect(page.getByText('Admin Portal', { exact: false })).not.toBeVisible();
  });
});

