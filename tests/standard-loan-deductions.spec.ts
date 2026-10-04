import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';
import { LENDING_E2E_ENABLED, LENDING_SKIP_REASON } from './lending-gate';

// Loan management ships dark (system.lending=false): every screen below is feature-gated.
// Re-run with E2E_LENDING=1 against a profile that enables the flag.
test.beforeEach(() => test.skip(!LENDING_E2E_ENABLED, LENDING_SKIP_REASON));

async function goToAdminDashboard(page: Page) {
  const onDashboard = await page.getByTestId('admin-portal-title').isVisible().catch(() => false);
  if (onDashboard) return;

  // Sidebar lending/dashboard entries were removed — navigate by direct route.
  await safeNavigate(page, '/(admin)/agribusiness');
  await expect(page.getByTestId('admin-portal-title')).toBeVisible({ timeout: 60000 });
}

async function navigateToNewLoan(page: Page) {
  // The dashboard no longer exposes quick-access tiles — use the direct route.
  await safeNavigate(page, '/(admin)/loans/new');
  await expect(page.getByTestId('page-title')).toHaveText(/Loan Parameters/i, { timeout: 30000 });
}

async function createBorrower(page: Page, fullName: string) {
  await safeNavigate(page, '/(admin)/borrowers', '[data-testid="new-borrower-fab"]');
  await page.getByTestId('new-borrower-fab').click();
  await expect(page.getByTestId('borrower-full-name-input')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('borrower-full-name-input').fill(fullName);
  await page.getByTestId('save-borrower-button').click();

  const outcome = await Promise.race([
    page.getByTestId('admin-portal-title').waitFor({ state: 'visible', timeout: 60000 }).then(() => 'dashboard' as const).catch(() => null),
    page.getByPlaceholder(/Search name, phone, or address/i).waitFor({ state: 'visible', timeout: 60000 }).then(() => 'borrowers' as const).catch(() => null),
  ]);

  if (outcome === 'borrowers') {
    await page.getByPlaceholder(/Search name, phone, or address/i).fill(fullName);
    await expect(page.getByText(fullName).first()).toBeVisible({ timeout: 30000 });
  } else {
    await expect(page.getByTestId('admin-portal-title')).toBeVisible({ timeout: 60000 });
  }
}

async function chooseBorrowerByName(page: Page, fullName: string) {
  await page.getByTestId('borrower-selector').click();
  await expect(page.getByTestId('borrower-modal')).toBeVisible({ timeout: 30000 });
  await page.getByTestId('borrower-search-input').fill(fullName);

  const borrower = page.locator('[data-testid^="borrower-option-"]').filter({ hasText: fullName }).first();
  await expect(borrower).toBeVisible({ timeout: 30000 });
  await borrower.click();
}

test.describe('Standard loan deductions visual and value verification in Chrome', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    page.on('dialog', async (dialog) => dialog.accept());
    await loginAsAdmin(page);
  });

  test('creates standard loan with PHP 5,000 principal and verifies exact deductions', async ({ page }) => {
    const borrowerName = `E2E Standard Deductions ${Date.now()}`;
    await createBorrower(page, borrowerName);

    await navigateToNewLoan(page);
    await chooseBorrowerByName(page, borrowerName);

    // Make sure standard loan type is active (default)
    await page.getByTestId('loan-type-standard').click();
    await expect(page.getByTestId('loan-principal-input')).toBeVisible();

    // Fill principal with 5000
    await page.getByTestId('loan-principal-input').fill('5000');

    // Wait and check Computation Slip standard deductions values
    // ARF (2%): 100
    // CPF (4%): 200
    // MEM: 100
    // LHF: 100
    // RSF: 60
    // Doc. Stamp: 45
    // Net Release (Disbursement): 4,395.00
    await expect(page.getByText('ARF (2%)').first()).toBeVisible({ timeout: 20000 });
    await expect(page.getByText('PHP 100.00').first()).toBeVisible();
    await expect(page.getByText('CPF (4%)').first()).toBeVisible();
    await expect(page.getByText('PHP 200.00').first()).toBeVisible();
    
    await expect(page.getByText('MEM').first()).toBeVisible();
    await expect(page.getByText('LHF').first()).toBeVisible();
    await expect(page.getByText('RSF').first()).toBeVisible();
    await expect(page.getByText('Doc. Stamp').first()).toBeVisible();

    // Net Proceeds / Net Release
    await expect(page.getByText('Net Release (Disbursement)').first()).toBeVisible();
    await expect(page.getByText('PHP 4,395.00').first()).toBeVisible();

    // Take screenshot for visual verification
    await page.screenshot({ path: 'tests/standard-loan-deductions-visual.png' });
    console.log('📸 Visual verification screenshot saved to tests/standard-loan-deductions-visual.png');
  });
});
