import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './playwright-auth';

test.describe('CBU and Share Capital UI/UX E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.setDefaultTimeout(120000);
        await loginAsAdmin(page);
    });

    test('should navigate to CBU Report and verify search/back navigation', async ({ page }) => {
        // Click the CBU Report link in the sidebar menu
        await page.getByText('CBU Report').first().click();

        // Check if back button is visible
        const backButton = page.getByTestId('back-button');
        await expect(backButton).toBeVisible({ timeout: 30000 });

        // Verify the search box is visible
        const searchInput = page.getByTestId('search-input');
        await expect(searchInput).toBeVisible();

        // Search for a dummy name to check filter functionality and "No members found" state
        await searchInput.fill('NonExistentDummyMemberNamexyz');
        await expect(page.getByText('No members found')).toBeVisible({ timeout: 15000 });
        
        // Clear search
        await searchInput.fill('');
    });

    test('should navigate to Share Capital Report and verify search/back navigation', async ({ page }) => {
        // Click the Share Capital link in the sidebar menu
        await page.getByText('Share Capital').first().click();

        // Check if back button is visible
        const backButton = page.getByTestId('back-button');
        await expect(backButton).toBeVisible({ timeout: 30000 });

        // Verify the search box is visible
        const searchInput = page.getByTestId('search-input');
        await expect(searchInput).toBeVisible();

        // Search for a dummy name to verify search filters properly
        await searchInput.fill('NonExistentDummyMemberNamexyz');
        await expect(page.getByText('No members found')).toBeVisible({ timeout: 15000 });
    });
});
