import { test, expect } from '@playwright/test';
import { expectLoginScreen, loginAsCollector } from './playwright-auth';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expectLoginScreen(page);
  });

  test('should load the login page correctly', async ({ page }) => {
    await expect(page.locator('input[type="email"]:not([data-testid])')).toBeVisible();
    await expect(page.locator('input[placeholder="••••••••"]')).toBeVisible();
    await expect(page.getByText('Sign In', { exact: false })).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.locator('input[type="email"]:not([data-testid])').fill('nonexistent@example.com');
    await page.locator('input[placeholder="••••••••"]').fill('wrongpassword');
    await page.getByText('Sign In', { exact: false }).click();

    // The app should show an error message.
    await expect(page.locator('text=Email or password is incorrect')).toBeVisible({ timeout: 15000 });
  });

  test('should login successfully using quick login as collector', async ({ page }) => {
    await loginAsCollector(page);
  });

  test('should logout successfully', async ({ page }) => {
    await loginAsCollector(page);

    // Find and click logout button using testID
    await page.getByTestId('logout-button').click();

    // Should return to login page
    await expect(page.locator('input[type="email"]:not([data-testid])')).toBeVisible({ timeout: 60000 });

    // Verify that navigating to a protected collector route redirects to login
    // Use a concrete collector page path rather than the route-group alias,
    // which is not stable on web navigation.
    await page.goto('/collection-sheet');
    await expect(page.locator('input[type="email"]:not([data-testid])')).toBeVisible({ timeout: 30000 });
  });
});

