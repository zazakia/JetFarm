import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './playwright-auth';

type InstitutionalScenario = {
  loanType: 'petty_cash' | 'livelihood' | 'salary' | 'emergency';
  label: string;
  targetPayment: string;
  expectedPaymentText: string;
  savingsPerPayment?: string;
  expectedSavingsText?: string;
};

const scenarios: InstitutionalScenario[] = [
  {
    loanType: 'petty_cash',
    label: 'Petty Cash Loan',
    targetPayment: '2000',
    expectedPaymentText: 'PHP 2,000.00',
  },
  {
    loanType: 'livelihood',
    label: 'Livelihood Loan',
    targetPayment: '3500',
    expectedPaymentText: 'PHP 3,500.00',
    savingsPerPayment: '150',
    expectedSavingsText: 'PHP 150.00',
  },
  {
    loanType: 'salary',
    label: 'Salary Loan',
    targetPayment: '3500',
    expectedPaymentText: 'PHP 3,500.00',
    savingsPerPayment: '0',
    expectedSavingsText: 'PHP 0.00',
  },
  {
    loanType: 'emergency',
    label: 'Emergency Loan',
    targetPayment: '6000',
    expectedPaymentText: 'PHP 6,000.00',
  },
];

async function goToAdminDashboard(page: Page) {
  const onDashboard = await page.getByTestId('admin-portal-title').isVisible().catch(() => false);
  if (onDashboard) return;

  // Sidebar label is "Admin Dashboard" (exact "Dashboard" is only on feature-disabled notices).
  await page.getByText(/Admin Dashboard/i).first().click({ force: true });
  await expect(page.getByTestId('admin-portal-title')).toBeVisible({ timeout: 60000 });
}

async function navigateToNewLoan(page: Page) {
  await goToAdminDashboard(page);
  await expect(page.getByText(/New Loan/i).first()).toBeVisible({ timeout: 30000 });
  await page.getByText(/New Loan/i).first().click({ force: true });
  await expect(page.getByTestId('page-title')).toHaveText(/Loan Parameters/i, { timeout: 30000 });
}

async function createBorrower(page: Page, fullName: string) {
  await goToAdminDashboard(page);
  await page.getByText(/New Borrower/i).first().click({ force: true });
  await expect(page.getByTestId('new-borrower-fab')).toBeVisible({ timeout: 30000 });
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

async function saveDraftAndOpenNewestLoan(page: Page) {
  await page.getByTestId('save-draft-loan-button').click();

  const saveOutcome = await Promise.race([
    page.getByText(/Proceed Anyway/i).waitFor({ state: 'visible', timeout: 30000 }).then(() => 'audit' as const).catch(() => null),
    page.getByTestId('admin-portal-title').waitFor({ state: 'visible', timeout: 30000 }).then(() => 'dashboard' as const).catch(() => null),
  ]);

  if (saveOutcome === 'audit') {
    await page.getByText(/Proceed Anyway/i).click();
  }

  await expect(page.getByTestId('admin-portal-title')).toBeVisible({ timeout: 60000 });
  await page.getByText(/^Loans$/).first().click({ force: true });

  await page.getByText('Card', { exact: true }).first().click();

  const firstLoanCard = page.locator('[data-testid^="loan-card-"]').first();
  await expect(firstLoanCard).toBeVisible({ timeout: 60000 });
  await firstLoanCard.click();
}

async function assertCanPrintInstitutionalForms(page: Page) {
  await expect(page.getByTestId('print-computation-slip')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('print-loan-forms')).toBeVisible({ timeout: 30000 });

  await page.getByTestId('print-computation-slip').click();
  await page.waitForTimeout(500);
  await page.getByTestId('print-loan-forms').click();
  await page.waitForTimeout(500);
}

test.describe('Institutional loan computation and printing workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    page.on('dialog', async (dialog) => dialog.accept());
    await loginAsAdmin(page);
  });

  for (const scenario of scenarios) {
    test(`1-6 creates ${scenario.label}, verifies computation, and triggers reports/forms`, async ({ page }) => {
      const borrowerName = `E2E ${scenario.loanType} ${Date.now()}`;
      await createBorrower(page, borrowerName);

      await navigateToNewLoan(page);
      await chooseBorrowerByName(page, borrowerName);

      await page.getByTestId(`loan-type-${scenario.loanType}`).click();
      await expect(page.getByText(scenario.label, { exact: true })).toBeVisible();

      await page.getByTestId('loan-target-payment-input').fill(scenario.targetPayment);
      if (scenario.savingsPerPayment !== undefined) {
        await page.getByTestId('loan-savings-per-payment-input').fill(scenario.savingsPerPayment);
      }

      await expect(page.getByText(/Computed loan amount from target/i)).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(scenario.expectedPaymentText).first()).toBeVisible({ timeout: 30000 });

      await saveDraftAndOpenNewestLoan(page);

      await expect(page.getByText(scenario.label, { exact: true })).toBeVisible({ timeout: 30000 });
      await expect(page.getByText(scenario.expectedPaymentText).first()).toBeVisible({ timeout: 30000 });
      if (scenario.expectedSavingsText) {
        await expect(page.getByText(scenario.expectedSavingsText).first()).toBeVisible({ timeout: 30000 });
      }

      await assertCanPrintInstitutionalForms(page);
    });
  }
});

