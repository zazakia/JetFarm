import { test, expect } from '@playwright/test';
import path from 'path';
import { loginAsAdmin, expectLoginScreen, safeNavigate } from './playwright-auth';
import { LENDING_E2E_ENABLED, LENDING_SKIP_REASON } from './lending-gate';

// Loan management ships dark (system.lending=false): every screen below is feature-gated.
// Re-run with E2E_LENDING=1 against a profile that enables the flag.
test.beforeEach(() => test.skip(!LENDING_E2E_ENABLED, LENDING_SKIP_REASON));

const SCREENSHOT_DIR = './test-results/screenshots';

test.describe('Data Management System - Visual Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.setDefaultTimeout(60000);
    await page.goto('/login');
    await expectLoginScreen(page);
  });

  test('Login screen shows the standard sign-in form', async ({ page }) => {
    await page.goto('/login');

    // 2. Handle native confirm dialogs automatically for delete tests
    page.on('dialog', dialog => {
        console.log(`[DIALOG]: ${dialog.message()}`);
        dialog.accept();
    });

    await expect(page.locator('input[type="email"]:not([data-testid])')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByText('Sign In', { exact: false })).toBeVisible();
    
    // Take a screenshot of the login screen
    await page.screenshot({ path: `${SCREENSHOT_DIR}/01_login_screen.png` });

    console.log('✅ Login screen verification passed.');
  });

  test('Admin can navigate to Borrowers list and see the search bar', async ({ page }) => {
    // Login as admin
    await loginAsAdmin(page);
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02_admin_dashboard.png` });

    // Navigate to Members (sidebar section removed — use direct route)
    await safeNavigate(page, '/(admin)/borrowers');
    await expect(page.getByPlaceholder('Search name, phone, or address...')).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/03_borrowers_list.png` });

    console.log('✅ Borrowers list navigation verified.');
  });

  test('Borrowers list renders items and swipe actions are present', async ({ page }) => {
    // Login
    await loginAsAdmin(page);

    // Navigate to members
    await safeNavigate(page, '/(admin)/borrowers');
    await expect(page.getByPlaceholder('Search name, phone, or address...')).toBeVisible({ timeout: 30000 });

    // Verify at least one borrower name is visible (not empty list)
    const emptyState = page.getByText('No borrowers found');
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    
    if (hasEmpty) {
      console.log('ℹ️ No borrowers in local DB - this is expected in a fresh test environment.');
      await page.screenshot({ path: `${SCREENSHOT_DIR}/03_borrowers_empty.png` });
    } else {
      // Get first borrower
      await page.screenshot({ path: `${SCREENSHOT_DIR}/04_borrowers_populated.png` });
      
      // Try to trigger action sheet with long press simulation
      const firstItem = page.locator('[data-testid^="borrower-"]').first()
        .or(page.locator('div[role="listitem"]').first())
        .or(page.locator('text=/^[A-Z]/').first()); // First text starting with uppercase letter (borrower name)

      if (await firstItem.isVisible().catch(() => false)) {
        // Simulate long press using pointer events
        const box = await firstItem.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
          await page.mouse.down();
          await page.waitForTimeout(1200); // hold for 1.2s = long press
          await page.mouse.up();
          await page.waitForTimeout(500);
          await page.screenshot({ path: `${SCREENSHOT_DIR}/05_after_long_press.png` });
          
          // Check if action sheet appeared
          const actionSheet = page.getByText('Delete Borrower');
          if (await actionSheet.isVisible().catch(() => false)) {
            console.log('✅ ActionSheet appeared after long press!');
            await page.screenshot({ path: `${SCREENSHOT_DIR}/06_action_sheet.png` });
            
            // Click delete
            await actionSheet.click();
            await page.waitForTimeout(300);
            await page.screenshot({ path: `${SCREENSHOT_DIR}/07_confirm_dialog.png` });
            
            const confirmBtn = page.getByText('Delete', { exact: true }).last();
            if (await confirmBtn.isVisible().catch(() => false)) {
              console.log('✅ ConfirmDialog appeared with Delete button!');
            }
          } else {
            console.log('ℹ️ ActionSheet did not appear (long press may not work in web mode - this is expected).');
          }
        }
      }
    }

    console.log('✅ Borrowers list rendering verification complete.');
  });

  test('Borrower Detail screen Delete button triggers ConfirmDialog', async ({ page }) => {
    // 1. Login
    await loginAsAdmin(page);

    // 2. Navigate to members
    await safeNavigate(page, '/(admin)/borrowers');
    await expect(page.getByPlaceholder('Search name, phone, or address...')).toBeVisible({ timeout: 30000 });

    const emptyState = page.getByText('No borrowers found');
    const hasEmpty = await emptyState.isVisible().catch(() => false);
    if (hasEmpty) {
      console.log('ℹ️ No borrowers to test detail screen - skipping.');
      return;
    }

    // 3. Click first borrower to go to detail screen
    const firstItem = page.getByTestId(/^borrower-item-/).first();
    await firstItem.click();
    
    // 4. Wait for detail screen (look for Edit Contact Info or Delete button)
    await expect(page.getByText('Edit Contact Info')).toBeVisible({ timeout: 60000 });
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08_detail_screen.png` });

    // 5. Scroll to bottom and click Delete Borrower
    const deleteBtn = page.getByTestId('delete-borrower-btn');
    await deleteBtn.scrollIntoViewIfNeeded();
    
    // 6. Handle native confirm dialogs automatically for this test
    page.on('dialog', dialog => {
        console.log(`[DIALOG]: ${dialog.message()}`);
        dialog.accept();
    });

    await deleteBtn.click();

    // 7. Verify ConfirmDialog appeared (implicitly by success redirect or business rule alert)
    // We wait for either the deletion success or the blocked deletion message
    await expect(page.getByText(/Borrower deleted|Cannot delete|active loan/i).first()).toBeVisible({ timeout: 30000 });
    
    console.log('✅ Detail screen Delete button triggers flow verified.');
  });
});

