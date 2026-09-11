import { test, expect } from '@playwright/test';

test.describe('New User Verification', () => {
  test('should login successfully with newly created account', async ({ page }) => {
    // Navigate to the login page
    await page.goto('/login');
    
    // Wait for the login form to be visible
    await page.waitForSelector('input[type="email"]:not([data-testid])', { state: 'visible', timeout: 30000 });

    // Fill in the credentials
    await page.fill('input[type="email"]:not([data-testid])', 'cybergada@gmail.com');
    await page.getByPlaceholder(/••••••••/).fill('12345678');

    // Click the login button
    await page.getByText(/SIGN IN/i).first().click();

    // Verification: Wait for the dashboard to load (assuming Admin role)
    await expect(page.getByText(/Admin Portal/i)).toBeVisible({ timeout: 60000 });
    
    console.log('Login successful for cybergada@gmail.com');
  });
});

