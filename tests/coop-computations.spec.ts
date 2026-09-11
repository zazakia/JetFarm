import { test, expect } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

test.describe('Cooperative Computations Settings', () => {
    test.beforeEach(async ({ page }) => {
        await loginAsAdmin(page);
    });

    test('should navigate to Cooperative Computations and verify validations', async ({ page }) => {
        // Log console messages from the browser
        page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));

        // Click the Settings tab in the navigation bar
        await page.getByText('System Settings').first().click();
        await expect(page.getByText('Business Rules').first()).toBeVisible({ timeout: 15000 });

        // Click the Business Rules card
        await page.getByText('Business Rules').first().click();
        await expect(page.getByText('Loan Products').first()).toBeVisible({ timeout: 15000 });

        // Click the Cooperative Computations card
        await page.click('text=Cooperative Computations');

        // Verify form loads and displays input fields
        await expect(page.getByText('Cooperative Computations').first()).toBeVisible();
        await expect(page.getByText('Savings Settings').first()).toBeVisible();

        // Find the Net Surplus allocation input.
        // It has valueType: 'number' and placeholder="e.g. 70"
        const netSurplusInput = page.locator('input[placeholder="e.g. 70"]').first();
        await expect(netSurplusInput).toBeVisible();

        // Clear and fill with '80' to trigger validation error (total will be 110%)
        await netSurplusInput.fill('80');

        // Resolve only after the dialog has been handled so neither the click nor
        // the assertion can race the browser event.
        const validationMessagePromise = new Promise<string>(resolve => {
            page.once('dialog', async dialog => {
                const message = dialog.message();
                await dialog.dismiss();
                resolve(message);
            });
        });
        await page.click('text=Save Parameters');
        const validationMessage = await validationMessagePromise;

        expect(validationMessage).toContain('The sum of all statutory allocations must be exactly 100%');

        // Restore back to 70
        await netSurplusInput.fill('70');

        // Take a screenshot of the correct screen
        await page.screenshot({ path: 'C:/Users/HI/.gemini/antigravity/brain/0b198a79-dc8e-46dd-9491-030e554b2b65/coop_settings_success.png' });

        const successMessagePromise = new Promise<string>(resolve => {
            page.once('dialog', async dialog => {
                const message = dialog.message();
                await dialog.accept();
                resolve(message);
            });
        });
        await page.click('text=Save Parameters');
        const successMessage = await successMessagePromise;

        expect(successMessage).toContain('updated successfully');
    });
});
