import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './playwright-auth';

async function createBorrower(page: Page, fullName: string) {
  const isDashboard = await page.getByTestId('admin-portal-title').isVisible().catch(() => false);
  if (!isDashboard) {
    await page.goto('/login');
    await expect(page.getByTestId('admin-portal-title')).toBeVisible({ timeout: 60000 });
  }
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

test.describe('Paginated Views & View Switching E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(120000);
    page.on('dialog', async (dialog) => dialog.accept());
    await loginAsAdmin(page);
  });

  test('should create a borrower, display in default Table view, and switch views', async ({ page }) => {
    const testBorrowerName = `E2E View Switcher ${Date.now()}`;
    await createBorrower(page, testBorrowerName);

    // Click "Members" in the sidebar/menu
    await page.getByText('Members').first().click();
    await expect(page).toHaveURL(/.*borrowers.*/, { timeout: 30000 });

    // Check default Table mode headers and borrower record
    await expect(page.getByText('Borrower Name').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('Phone').first()).toBeVisible();
    await expect(page.getByText(testBorrowerName).first()).toBeVisible({ timeout: 15000 });

    // Check view mode buttons are present
    const tableBtn = page.getByText('Table', { exact: true }).first();
    const listBtn = page.getByText('List', { exact: true }).first();
    const cardBtn = page.getByText('Card', { exact: true }).first();

    await expect(tableBtn).toBeVisible();
    await expect(listBtn).toBeVisible();
    await expect(cardBtn).toBeVisible();

    // Switch to List view
    await listBtn.click();
    await expect(page.getByText(testBorrowerName).first()).toBeVisible({ timeout: 15000 });
    // In List view, the custom list item layout should show the circular avatar or details like "Added:"
    await expect(page.getByText(/Added:/i).first()).toBeVisible({ timeout: 10000 });

    // Switch to Card view
    await cardBtn.click();
    // Card view should also display the borrower name
    await expect(page.getByText(testBorrowerName).first()).toBeVisible({ timeout: 15000 });

    // Switch back to Table view
    await tableBtn.click();
    await expect(page.getByText('Borrower Name').first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(testBorrowerName).first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Loans, display view mode toggles, and switch views (empty list)', async ({ page }) => {
    // Click "Loans" in the sidebar/menu
    await page.getByText('Loans').first().click();
    await expect(page).toHaveURL(/.*loans.*/, { timeout: 30000 });

    // When empty, it displays "No loans found"
    await expect(page.getByText(/No loans found/i).first()).toBeVisible({ timeout: 30000 });

    const tableBtn = page.getByText('Table', { exact: true }).first();
    const listBtn = page.getByText('List', { exact: true }).first();
    const cardBtn = page.getByText('Card', { exact: true }).first();

    await expect(tableBtn).toBeVisible();
    await expect(listBtn).toBeVisible();
    await expect(cardBtn).toBeVisible();

    // Verify toggling does not crash the page and still displays the empty message
    await listBtn.click();
    await expect(page.getByText(/No loans found/i).first()).toBeVisible({ timeout: 10000 });

    await cardBtn.click();
    await expect(page.getByText(/No loans found/i).first()).toBeVisible({ timeout: 10000 });

    await tableBtn.click();
    await expect(page.getByText(/No loans found/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('should navigate to Payments, display view mode toggles, and switch views (empty list)', async ({ page }) => {
    // Click "Payments" in the sidebar/menu
    await page.getByText('Payments').first().click();
    await expect(page).toHaveURL(/.*payments.*/, { timeout: 30000 });

    // When empty, it displays "No payments found"
    await expect(page.getByText(/No payments found/i).first()).toBeVisible({ timeout: 30000 });

    const tableBtn = page.getByText('Table', { exact: true }).first();
    const listBtn = page.getByText('List', { exact: true }).first();
    const cardBtn = page.getByText('Card', { exact: true }).first();

    await expect(tableBtn).toBeVisible();
    await expect(listBtn).toBeVisible();
    await expect(cardBtn).toBeVisible();

    // Verify toggling does not crash the page
    await listBtn.click();
    await expect(page.getByText(/No payments found/i).first()).toBeVisible({ timeout: 10000 });

    await cardBtn.click();
    await expect(page.getByText(/No payments found/i).first()).toBeVisible({ timeout: 10000 });

    await tableBtn.click();
    await expect(page.getByText(/No payments found/i).first()).toBeVisible({ timeout: 10000 });
  });

  test.skip('should navigate to Expenses, display view mode toggles, and switch views (empty list)', async ({ page }) => {
    // Click "Expenses" in the sidebar/menu
    await page.getByText('Expenses').first().click();
    await expect(page).toHaveURL(/.*expenses.*/, { timeout: 30000 });

    // When empty, it displays "No expenses found"
    await expect(page.getByText(/No expenses found/i).first()).toBeVisible({ timeout: 30000 });

    const tableBtn = page.getByText('Table', { exact: true }).first();
    const listBtn = page.getByText('List', { exact: true }).first();
    const cardBtn = page.getByText('Card', { exact: true }).first();

    await expect(tableBtn).toBeVisible();
    await expect(listBtn).toBeVisible();
    await expect(cardBtn).toBeVisible();

    // Verify toggling does not crash the page
    await listBtn.click();
    await expect(page.getByText(/No expenses found/i).first()).toBeVisible({ timeout: 10000 });

    await cardBtn.click();
    await expect(page.getByText(/No expenses found/i).first()).toBeVisible({ timeout: 10000 });

    await tableBtn.click();
    await expect(page.getByText(/No expenses found/i).first()).toBeVisible({ timeout: 10000 });
  });
});
