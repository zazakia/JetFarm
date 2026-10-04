import { test, expect } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';
import { LENDING_E2E_ENABLED, LENDING_SKIP_REASON } from './lending-gate';

// Loan management ships dark (system.lending=false): every screen below is feature-gated.
// Re-run with E2E_LENDING=1 against a profile that enables the flag.
test.beforeEach(() => test.skip(!LENDING_E2E_ENABLED, LENDING_SKIP_REASON));

test.describe('CBU and Share Capital UI/UX E2E Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.setDefaultTimeout(120000);
        await loginAsAdmin(page);
    });

    test('should navigate to CBU Report and verify search/back navigation', async ({ page }) => {
        // The reports sidebar section was removed — navigate by direct route
        await safeNavigate(page, '/(admin)/reports/cbu');

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
        // The reports sidebar section was removed — navigate by direct route
        await safeNavigate(page, '/(admin)/reports/share-capital');

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
