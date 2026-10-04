/**
 * Guards the shipped-dark posture of loan management (2026-10-04):
 * `system.lending` defaults to disabled (src/constants/configDefaults.ts), so on a
 * FRESH profile every loan-management surface must be unreachable:
 *   - router.push to a lending route never reveals the real screen (the expo-router
 *     web navigator silently refuses the gated route, and the (admin) layout would
 *     render FeatureDisabledNotice if a deep link did mount it — both outcomes are
 *     accepted here; what must NOT happen is the actual lending UI);
 *   - no lending entries in the admin sidebar.
 * A control push to an ungated route (/(admin)/settings) proves navigation works.
 *
 * NOTE: profiles seeded before the default change keep the old enabled flag row
 * (SettingsService.ensureFeatureFlags only inserts missing rows) — that is the
 * documented upgrade caveat, not a regression.
 */
import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin } from './playwright-auth';

// Each route + a text fragment that only appears on the REAL screen.
const GATED_ROUTES = [
    { route: '/(admin)/borrowers', realScreen: /Add Borrower|New Borrower|Member List/i },
    { route: '/(admin)/loans', realScreen: /Outstanding Balance|Loan Portfolio|New Loan/i },
    { route: '/(admin)/payments', realScreen: /Record Payment|Payment Breakdown/i },
    { route: '/(admin)/reports/daily-collection', realScreen: /Daily Collection Sheet —|Total Collected Today/i },
    { route: '/(admin)/settings/loan-products', realScreen: /Processing Fee|Savings Per Amortization/i },
];

async function tryPush(page: Page, route: string) {
    await page.evaluate((url) => (window as any).router.push(url), route);
    // Give the navigator time to commit (accepted routes change URL within ~2s).
    await page.waitForTimeout(3000);
}

test.describe('Lending dark default (system.lending=false)', () => {
    test.beforeEach(async ({ page }) => {
        await page.setDefaultTimeout(90000);
        await loginAsAdmin(page);
    });

    test('control: ungated admin route still navigates', async ({ page }) => {
        await tryPush(page, '/(admin)/settings');
        await expect(page).toHaveURL(/settings/);
        await expect(page.getByText(/System Settings/i).first()).toBeVisible({ timeout: 30000 });
    });

    for (const { route, realScreen } of GATED_ROUTES) {
        test(`${route} cannot reach the lending screen`, async ({ page }) => {
            // Navigate away from settings first (control test pattern) to agribusiness.
            await tryPush(page, route);
            await tryPush(page, route); // second attempt: gated pushes sometimes need a retry

            // Either the navigator refused (still on the previous route) or a
            // FeatureDisabledNotice took over — the real lending UI must not show.
            await expect(page.getByText(realScreen).first()).toBeHidden({ timeout: 5000 });
            const noticeShown = await page.getByText(/ Disabled$/i).first().isVisible().catch(() => false);
            if (noticeShown) {
                await expect(page.getByText(/turned off in Feature Flags settings/i)).toBeVisible();
            } else {
                expect(page.url()).not.toMatch(new RegExp(route.replace('/(admin)', '')));
            }
        });
    }

    test('admin sidebar exposes no lending entries', async ({ page }) => {
        const sidebar = page.locator('xpath=//div[contains(@class,"border-r")]');
        const scope = (await sidebar.count()) ? sidebar : page.locator('body');
        for (const label of ['Loans', 'Borrowers', 'Payments', 'Loan Approvals', 'Portfolio at Risk']) {
            await expect(scope.getByText(new RegExp(`^${label}$`, 'i'))).toHaveCount(0, { timeout: 10000 });
        }
        // ...while the agribusiness section is intact.
        await expect(page.getByText(/Agribusiness Dashboard/i).first()).toBeVisible();
    });
});
