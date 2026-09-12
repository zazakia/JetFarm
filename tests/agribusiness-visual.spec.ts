import { test, expect } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

test.describe('Agribusiness Outgrower Platform E2E & Visual Verification', () => {
    test.beforeEach(async ({ page }) => {
        await page.setDefaultTimeout(120000);
        await loginAsAdmin(page);
    });

    test('Operator Command Center loads and renders KPI cards and operational hub', async ({ page }) => {
        await safeNavigate(page, '/agribusiness');
        
        await expect(page.getByText(/Command Center/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Managed Land/i).first()).toBeVisible();
        await expect(page.getByText(/Active Cycles/i).first()).toBeVisible();
        await expect(page.getByText(/Total Harvest/i).first()).toBeVisible();
        await expect(page.getByText(/Settlements Paid/i).first()).toBeVisible();

        await expect(page.getByText(/Weigh-in Scale/i).first()).toBeVisible();
        await expect(page.getByText(/Weekly Settlements/i).first()).toBeVisible();
        await expect(page.getByText(/Land Parcels/i).first()).toBeVisible();
        await expect(page.getByText(/GPS Mapping/i).first()).toBeVisible();
        await expect(page.getByText(/Planting Cycles/i).first()).toBeVisible();
        await expect(page.getByText(/BioGreen Investor/i).first()).toBeVisible();
        await expect(page.getByText(/Farm Labor/i).first()).toBeVisible();
        await expect(page.getByText(/Farm Expenses/i).first()).toBeVisible();
        await expect(page.getByText(/Cycle P&L & Forecast/i).first()).toBeVisible();

        await page.screenshot({ path: 'docs/images/agribusiness-command-center.png', fullPage: true });
    });

    test('Weigh-in Scale Terminal renders gross tare net scale', async ({ page }) => {
        await safeNavigate(page, '/agribusiness/harvest');
        await expect(page.getByText(/Weigh-in Scale/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Gross Weight/i).first()).toBeVisible();
        await expect(page.getByText(/Tare Weight/i).first()).toBeVisible();
        await expect(page.getByText(/Computed Net Weight/i).first()).toBeVisible();
        await page.screenshot({ path: 'docs/images/agribusiness-harvest-scale.png', fullPage: true });
    });

    test('Land Owner Settlement Engine verifies guaranteed minimum banner', async ({ page }) => {
        await safeNavigate(page, '/agribusiness/settlements');
        await expect(page.getByText(/Settlement Engine/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Guaranteed Minimum/i).first()).toBeVisible();
        await page.screenshot({ path: 'docs/images/agribusiness-settlements.png', fullPage: true });
    });

    test('Farm Input Expenses screen loads and displays category filters', async ({ page }) => {
        await safeNavigate(page, '/agribusiness/expenses');
        await expect(page.getByText(/Farm Input Expenses/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Total Expenses/i).first()).toBeVisible();
        await expect(page.getByText(/Log Farm Expense/i).first()).toBeVisible();
        await page.screenshot({ path: 'docs/images/agribusiness-expenses.png', fullPage: true });
    });

    test('PnL and Yield Analytics screen displays unit economics matrix', async ({ page }) => {
        await safeNavigate(page, '/agribusiness/analytics');
        await expect(page.getByText(/P&L & Unit Economics/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Select Crop Cycle/i).first()).toBeVisible();
        await page.screenshot({ path: 'docs/images/agribusiness-analytics.png', fullPage: true });
    });

    test('Mobile Viewport Audit 390x844', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await safeNavigate(page, '/agribusiness');
        await expect(page.getByText(/Command Center/i).first()).toBeVisible({ timeout: 20000 });
        await page.screenshot({ path: 'docs/images/agribusiness-mobile-view.png' });
    });
});
