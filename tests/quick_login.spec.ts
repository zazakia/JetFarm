import { test, expect } from '@playwright/test';
import { expectLoginScreen, dismissOnboardingTour } from './playwright-auth';

// The seeded identities are the ones supabase/seed.sql creates and AuthService still recognises:
// the collector/loan/payment encoder accounts went with the lending domain.
const accountsToTest = [
    { name: 'Admin User', email: 'admin@agri-one.com', portal: 'admin' as const },
    { name: 'Expenses Encoder', email: 'expenses_encoder@agri-one.com', portal: 'encoder' as const },
    { name: 'Main Office', email: 'mainoffice@agri-one.com', portal: 'admin' as const },
];

test.describe('Role Login Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await expectLoginScreen(page);
    });

    for (const account of accountsToTest) {
        test(`should login ${account.email.split('@')[0]}`, async ({ page }) => {
            await page.locator('input[type="email"]:not([data-testid])').fill(account.email);
            await page.locator('input[type="password"]').fill('12345678');
            await page.getByText('Sign In', { exact: false }).click();

            if (account.portal === 'admin') {
                await expect(page.getByTestId('admin-portal-title')).toBeVisible({ timeout: 60000 });
                await dismissOnboardingTour(page);
            } else {
                await expect(page.getByText('Record Expense', { exact: false }).first()).toBeVisible({ timeout: 60000 });
            }

            await expect(page.getByText(new RegExp(account.name.split(' ')[0], 'i')).first()).toBeVisible({ timeout: 15000 });
            console.log(`Login successful for ${account.name}`);
        });
    }
});
