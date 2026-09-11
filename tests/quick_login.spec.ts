import { test, expect } from '@playwright/test';
import { expectLoginScreen } from './playwright-auth';

test.describe('Role Login Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await expectLoginScreen(page);
    });

    const collectorsToTest = [
        { name: 'Cresencio Junco', email: 'cresencio.junco@poscursor.com', id: 'cresencio' },
        { name: 'Gerald Gera', email: 'gerald.gera@poscursor.com', id: 'gerald' },
        { name: 'Bernie Casera', email: 'bernie.casera@poscursor.com', id: 'bernie' }
    ];

    for (const collector of collectorsToTest) {
        test(`should login collector: ${collector.name}`, async ({ page }) => {
            await page.locator('input[type="email"]:not([data-testid])').fill(collector.email);
            await page.locator('input[type="password"]').fill('12345678');
            await page.getByText('Sign In', { exact: false }).click();

            // Verification: Wait for the dashboard to load (Collector Portal)
            await expect(page.getByText(/Collector Portal/i)).toBeVisible({ timeout: 60000 });
            
            // Wait for specific user name element just to be absolutely sure
            await expect(page.getByText(new RegExp(collector.name.split(' ')[0], 'i'))).toBeVisible({ timeout: 10000 });
            
            console.log(`Login via Quick Access successful for ${collector.name}`);
        });
    }
});

