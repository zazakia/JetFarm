import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Agribusiness screen coverage.
 *
 * tests/agribusiness-visual.spec.ts covers the command center, harvest, settlements,
 * expenses, and analytics screens. The five routes below had no end-to-end coverage at
 * all — only cycles had a partial component test (mapping has its own spec). They are
 * registered in the route group but nothing proved they render, so a runtime crash on
 * any of them would pass every gate in the matrix.
 *
 * Uncaught exceptions are collected per screen and asserted empty — the only
 * pageerror convention left in the suite after the lending specs were deleted. Console noise is
 * deliberately not asserted here because Supabase Realtime fails to connect under E2E
 * (no local realtime port) and that is not an app defect.
 */
async function collectPageErrors(page: Page): Promise<string[]> {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));
    return pageErrors;
}

test.describe('Agribusiness screen routes render without runtime errors', () => {
    test.beforeEach(async ({ page }) => {
        await page.setDefaultTimeout(120000);
        await loginAsAdmin(page);
    });

    test('Planting Cycles screen renders the cycle registry', async ({ page }) => {
        const pageErrors = await collectPageErrors(page);
        await safeNavigate(page, '/agribusiness/cycles');

        await expect(page.getByText(/Cassava Planting Cycles/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Start New Cycle/i).first()).toBeVisible();

        expect(pageErrors).toEqual([]);
    });

    test('Land Parcels Registry screen renders the parcel list', async ({ page }) => {
        const pageErrors = await collectPageErrors(page);
        await safeNavigate(page, '/agribusiness/parcels');

        // The screen title string ("Land Parcels Registry") is also a label in
        // src/components/SidebarContent.tsx, so asserting it would pass on any admin
        // route. Assert the header subtitle and the testID'd action instead.
        await expect(page.getByText(/Track land parcels, acreage, soil quality/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByTestId('register-parcel-button')).toBeVisible();

        expect(pageErrors).toEqual([]);
    });

    test('Farm Labor screen renders worker and wage summaries', async ({ page }) => {
        const pageErrors = await collectPageErrors(page);
        await safeNavigate(page, '/agribusiness/labor');

        await expect(page.getByText(/Farm Labor & Field Workers/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Field Labor Logs/i).first()).toBeVisible();
        await expect(page.getByText(/Pending Wages/i).first()).toBeVisible();

        expect(pageErrors).toEqual([]);
    });

    test('Agri Accounting screen renders the general ledger and subsidiary ledgers', async ({ page }) => {
        const pageErrors = await collectPageErrors(page);
        await safeNavigate(page, '/agribusiness/accounting');

        await expect(page.getByText(/Agri Farm General Ledger/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Agri Direct Cost Subsidiary Ledger/i).first()).toBeVisible();
        await expect(page.getByText(/Agribusiness Journal Register/i).first()).toBeVisible();

        expect(pageErrors).toEqual([]);
    });

    test('Investor Capital screen renders the off-take ledger', async ({ page }) => {
        const pageErrors = await collectPageErrors(page);
        await safeNavigate(page, '/agribusiness/investors');

        await expect(page.getByText(/Investor Capital & Off-Take/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Ledger Transaction History/i).first()).toBeVisible();

        expect(pageErrors).toEqual([]);
    });

    test('Farm Expenses screen renders both Expense Ledger and Planned vs Actual Farming Steps', async ({ page }) => {
        const pageErrors = await collectPageErrors(page);
        await safeNavigate(page, '/agribusiness/expenses');

        await expect(page.getByText(/Farm Input Expenses/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Expense Ledger/i).first()).toBeVisible();
        await expect(page.getByText(/Planned vs Actual Steps/i).first()).toBeVisible();

        // Toggle to Planned vs Actual Steps
        await page.getByText(/Planned vs Actual Steps/i).first().click();

        await expect(page.getByText(/Schedule of Implementation/i).first()).toBeVisible({ timeout: 15000 });
        await expect(page.getByText(/Planned Budget/i).first()).toBeVisible();
        await expect(page.getByText(/Land Preparation & Tillage/i).first()).toBeVisible();

        expect(pageErrors).toEqual([]);
    });

    test('Implementation & P&L Report screen renders Bacalso Farm schedule matrix and P&L', async ({ page }) => {
        const pageErrors = await collectPageErrors(page);
        await safeNavigate(page, '/agribusiness/implementation-report');

        await expect(page.getByText(/BACALSO FARM/i).first()).toBeVisible({ timeout: 20000 });
        await expect(page.getByText(/Summary of Expenses & Net Income/i).first()).toBeVisible();
        await expect(page.getByText(/TOTAL COST/i).first()).toBeVisible();
        await expect(page.getByText(/NET INCOME/i).first()).toBeVisible();
        await expect(page.getByText(/Print \/ Export/i).first()).toBeVisible();

        expect(pageErrors).toEqual([]);
    });
});
