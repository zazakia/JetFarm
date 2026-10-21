import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginAsExpensesEncoder } from './playwright-auth';

// The deleted route groups are the point of this suite: on the agribusiness build a role must
// never land on a blank screen when it is pushed at a group that no longer exists. Guarded at the
// unit level by src/__tests__/agribusinessRouteManifest.test.ts; this proves it in the browser.
const DELETED_GROUPS = ['/(collector)', '/(loan-encoder)', '/(payment-encoder)', '/(cashier)', '/(borrower)'];

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

  test('Expenses Encoder should NOT be able to access Admin routes', async ({ page }) => {
    await loginAsExpensesEncoder(page);

    console.log('--- Attempting unauthorized navigate to /(admin) ---');
    await page.evaluate(() => {
      window.location.href = '/(admin)';
    });

    // Either its own workspace or a login guard — never admin content.
    await expect(page.getByText(/Record Expense|Login to Account|Sign In/i).first()).toBeVisible({ timeout: 60000 });
    await expect(page.getByTestId('admin-portal-title')).not.toBeVisible();
  });

  test('Admin should NOT be stuck on a deleted role group', async ({ page }) => {
    await loginAsAdmin(page);

    for (const group of DELETED_GROUPS) {
      console.log(`--- Attempting navigate to retired group ${group} ---`);
      await page.evaluate((target) => {
        window.location.href = target;
      }, group);

      // The app resolves to an allowed workspace or the login guard; a blank body would fail here.
      await page.waitForTimeout(2000);
      const text = (await page.locator('body').innerText()).trim();
      expect(text.length, `Retired group ${group} rendered an empty screen at ${page.url()}`).toBeGreaterThan(0);
      expect(text).not.toMatch(/New Loan Entry|Collection Sheet|Record Loan Payment|Borrower Profile/);
    }
  });
});
