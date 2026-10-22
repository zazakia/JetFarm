import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live CRUD + invalid-input coverage for two agribusiness write modules that had
 * no automated spec before (Investor Ledger, Farm Laborers & Staff), plus a
 * characterization test for defect D4.
 *
 * Why these two: `parcels`/`cycles` are already covered by
 * `agribusiness_registry_crud.spec.ts`, and `investors`/`workers` are the two
 * writable agribusiness screens whose create path needs no prerequisite record
 * (`harvest`, `labor` and agri `expenses` all require an existing crop cycle,
 * which itself requires a parcel).
 *
 * Persistence is asserted by re-reading WatermelonDB storage through the global
 * the app exposes (`window.__WATERMELON_DB__`) using the same access pattern as
 * `sync-verify.spec.ts`, so a green run means the row really exists, not merely
 * that the list re-rendered.
 *
 * D4: react-native-web 0.21.2 ships `class Alert { static alert() {} }`, so the
 * Alert-based confirmation used by these screens' delete handlers never renders
 * on the web build. The last test documents that observed behaviour; it is
 * expected to FAIL once the screens are migrated to the ConfirmDialog pattern
 * that `parcels.tsx` / `cycles.tsx` already use.
 */

const INVESTORS_ROUTE = '/agribusiness/investors';
const WORKERS_ROUTE = '/agribusiness/workers';
const INVESTORS_TITLE = 'Investor Capital & Off-Take';
const WORKERS_TITLE = 'Farm Laborers & Staff';

const stamp = Date.now().toString().slice(-6);

async function rowCount(page: Page, table: string): Promise<number> {
    return page.evaluate(async (name: string) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return -1;
        return await db.collections.get(name).query().fetchCount();
    }, table);
}

/** Read selected columns straight out of WatermelonDB (storage, not the UI). */
async function readRows(page: Page, table: string, columns: string[]) {
    return page.evaluate(async ({ name, cols }: { name: string; cols: string[] }) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return null;
        const records = await db.collections.get(name).query().fetch();
        return records.map((r: any) => {
            const raw = r._raw ?? {};
            const out: Record<string, any> = { id: r.id };
            for (const c of cols) out[c] = raw[c] ?? r[c];
            return out;
        });
    }, { name: table, cols: columns });
}

/** The Expo/RNW dev error overlay, when one is mounted. */
async function redBoxVisible(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const text = document.body?.innerText || '';
        return /Uncaught Error|Application Error|something went wrong/i.test(text);
    });
}

async function openInvestorModal(page: Page) {
    await page.getByText('Add Investor', { exact: true }).first().click();
    await expect(page.getByPlaceholder('e.g. BioGreen Agri Solutions')).toBeVisible();
}

async function openWorkerModal(page: Page) {
    await page.getByText('Register Worker', { exact: true }).first().click();
    await expect(page.getByPlaceholder('e.g. Juan dela Cruz')).toBeVisible();
}

test.describe('Agribusiness write modules: investors + workers', () => {
    test('registers an investor and the row really exists in WatermelonDB', async ({ page }) => {
        const company = `E2E Investor ${stamp}`;
        await loginAsAdmin(page);
        await safeNavigate(page, INVESTORS_ROUTE, INVESTORS_TITLE);

        const before = await rowCount(page, 'agri_investors');
        expect(before, 'agri_investors collection must exist in the web build').toBeGreaterThan(-1);

        await openInvestorModal(page);
        await page.getByPlaceholder('e.g. BioGreen Agri Solutions').fill(company);
        await page.getByPlaceholder('Representative Name').fill(`E2E Rep ${stamp}`);
        await page.getByPlaceholder('4.00').fill('4.75');
        await page.getByText('Save Investor', { exact: true }).click();

        await expect(page.getByPlaceholder('e.g. BioGreen Agri Solutions')).toHaveCount(0);

        expect(await rowCount(page, 'agri_investors')).toBe(before + 1);
        const rows = await readRows(page, 'agri_investors', ['company_name', 'default_offtake_price_per_kg', 'deleted_at']);
        const saved = rows?.find(r => r.company_name === company);
        expect(saved, `investor "${company}" absent from storage after save`).toBeTruthy();
        expect(Number(saved!.default_offtake_price_per_kg)).toBe(4.75);
        expect(saved!.deleted_at, 'investor must not be soft-deleted on create').toBeFalsy();

        await expect(page.getByText(company).first()).toBeVisible();
    });

    test('refuses an investor with no company name: no write, no crash', async ({ page }) => {
        await loginAsAdmin(page);
        await safeNavigate(page, INVESTORS_ROUTE, INVESTORS_TITLE);

        const before = await rowCount(page, 'agri_investors');

        await openInvestorModal(page);
        await page.getByText('Save Investor', { exact: true }).click();

        // Validation early-return: the modal stays open and nothing is written.
        await expect(page.getByPlaceholder('e.g. BioGreen Agri Solutions')).toBeVisible();
        expect(await rowCount(page, 'agri_investors'), 'empty company name must not create a row').toBe(before);
        expect(await redBoxVisible(page), 'invalid input must not crash the app').toBe(false);
    });

    test('registers a worker, persists it, then edits the daily rate and re-reads storage', async ({ page }) => {
        const name = `E2E Worker ${stamp}`;
        await loginAsAdmin(page);
        await safeNavigate(page, WORKERS_ROUTE, WORKERS_TITLE);

        const before = await rowCount(page, 'agri_farm_workers');
        expect(before, 'agri_farm_workers collection must exist in the web build').toBeGreaterThan(-1);

        await openWorkerModal(page);
        await page.getByPlaceholder('e.g. Juan dela Cruz').fill(name);
        await page.getByPlaceholder('e.g. 0917-123-4567').fill('0917-555-0000');
        await page.getByPlaceholder('450').fill('620');
        await page.getByText('Register Worker', { exact: true }).last().click();

        await expect(page.getByPlaceholder('e.g. Juan dela Cruz')).toHaveCount(0);
        expect(await rowCount(page, 'agri_farm_workers')).toBe(before + 1);

        let rows = await readRows(page, 'agri_farm_workers', ['name', 'daily_rate', 'deleted_at']);
        let saved = rows?.find(r => r.name === name);
        expect(saved, `worker "${name}" absent from storage after register`).toBeTruthy();
        expect(Number(saved!.daily_rate)).toBe(620);

        // Edit path: open the record, change the rate, confirm the new value is what storage holds.
        await page.getByText('Edit Record', { exact: true }).first().click();
        await expect(page.getByText('Edit Worker & Staff Record')).toBeVisible();
        await page.getByPlaceholder('450').fill('775');
        await page.getByText('Save Changes', { exact: true }).click();

        await expect(page.getByText('Edit Worker & Staff Record')).toHaveCount(0);
        rows = await readRows(page, 'agri_farm_workers', ['name', 'daily_rate']);
        saved = rows?.find(r => r.name === name);
        expect(saved, 'worker row must still exist after edit').toBeTruthy();
        expect(Number(saved!.daily_rate), 'edit must persist the new rate in storage').toBe(775);
    });

    test('refuses a worker with an invalid daily rate: no write, no crash', async ({ page }) => {
        await loginAsAdmin(page);
        await safeNavigate(page, WORKERS_ROUTE, WORKERS_TITLE);

        const before = await rowCount(page, 'agri_farm_workers');

        await openWorkerModal(page);
        await page.getByPlaceholder('e.g. Juan dela Cruz').fill(`E2E Bad Rate ${stamp}`);
        await page.getByPlaceholder('450').fill('0');
        await page.getByText('Register Worker', { exact: true }).last().click();

        await expect(page.getByPlaceholder('e.g. Juan dela Cruz')).toBeVisible();
        expect(await rowCount(page, 'agri_farm_workers'), 'invalid rate must not create a row').toBe(before);
        expect(await redBoxVisible(page), 'invalid input must not crash the app').toBe(false);
    });

    test('CHARACTERIZES D4 (fails once fixed): Alert-based delete confirmation is unreachable on web', async ({ page }) => {
        const name = `E2E D4 Probe ${stamp}`;
        await loginAsAdmin(page);
        await safeNavigate(page, WORKERS_ROUTE, WORKERS_TITLE);

        const before = await rowCount(page, 'agri_farm_workers');
        await openWorkerModal(page);
        await page.getByPlaceholder('e.g. Juan dela Cruz').fill(name);
        await page.getByPlaceholder('450').fill('500');
        await page.getByText('Register Worker', { exact: true }).last().click();
        await expect(page.getByPlaceholder('e.g. Juan dela Cruz')).toHaveCount(0);
        expect(await rowCount(page, 'agri_farm_workers')).toBe(before + 1);

        await page.getByText('Delete', { exact: true }).first().click();

        // D4 evidence: react-native-web Alert.alert() is a no-op, so the confirmation
        // never renders (no ConfirmDialog is mounted on this screen either), and the
        // row stays in storage undeleted. After a fix the assertions below must flip.
        await expect(page.getByTestId('confirm-dialog-confirm')).toHaveCount(0);
        await expect(page.getByText('Confirm Delete')).toHaveCount(0);

        const rows = await readRows(page, 'agri_farm_workers', ['name', 'deleted_at']);
        const probe = rows?.find(r => r.name === name);
        expect(probe, 'D4: delete cannot reach its callback on web, so the row must still exist').toBeTruthy();
        expect(probe!.deleted_at, 'D4: row must not be soft-deleted when the confirmation never renders').toBeFalsy();
    });
});
