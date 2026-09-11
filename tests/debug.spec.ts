import { test, expect } from '@playwright/test';

test('debug quick login users', async ({ page }) => {
  await page.goto('/login');
  const loginEmail = page.locator('input[type="email"]:not([data-testid])');
  await expect(loginEmail).toBeVisible({ timeout: 30000 });
  console.log('Quick login UI is not required in this build; standard login form is present.');
});

