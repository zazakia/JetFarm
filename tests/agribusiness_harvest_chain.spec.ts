import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Cross-module write chain E2E (web build): Parcel -> Crop Cycle (with investor + off-take
 * price) -> Harvest weigh-in, then every downstream effect is re-read from WatermelonDB
 * storage and its arithmetic recomputed by this spec instead of trusting the app's math.
 *
 * What must propagate (source: `AgriHarvestService.logWeighIn`, src/services/AgriHarvestService.ts:62-105):
 *   1. a new `agri_harvest_logs` row whose net = gross - tare,
 *   2. `agri_crop_cycles.total_actual_yield_kg` += net, and status -> 'harvesting',
 *   3. a `agri_investor_ledgers` off-take row whose amount = net x cycle.offtake_price_per_kg.
 *
 * The numbers below are chosen so an off-by-one in the accumulation is impossible to miss:
 * gross 12,500 kg - tare 2,500 kg = 10,000 kg net; 10,000 x 4.75 = 47,500.
 */

const PARCELS_ROUTE = '/agribusiness/parcels';
const CYCLES_ROUTE = '/agribusiness/cycles';
const INVESTORS_ROUTE = '/agribusiness/investors';
const HARVEST_ROUTE = '/agribusiness/harvest';

const stamp = Date.now().toString().slice(-6);
const VARIETY = `Bayong ${stamp}`;
const COMPANY = `E2E Chain Investor ${stamp}`;
const OFFTAKE_PRICE = 4.75;
const GROSS = 12500;
const TARE = 2500;
const EXPECTED_NET = GROSS - TARE;            // 10,000 — recomputed here, not by the app
const EXPECTED_OFFTAKE = EXPECTED_NET * OFFTAKE_PRICE; // 47,500

async function readRow(page: Page, table: string, id: string, columns: string[]) {
    return page.evaluate(async ({ name, rowId, cols }: { name: string; rowId: string; cols: string[] }) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return null;
        try {
            const record = await db.collections.get(name).find(rowId);
            const raw = (record as any)._raw ?? {};
            const out: Record<string, any> = { id: (record as any).id };
            for (const c of cols) out[c] = raw[c] ?? (record as any)[c];
            return out;
        } catch (e) {
            return null;
        }
    }, { name: table, rowId: id, cols: columns });
}

/** Find a row by an exact column value straight out of storage. */
async function findRow(page: Page, table: string, column: string, value: string, columns: string[]) {
    return page.evaluate(async ({ name, col, val, cols }: { name: string; col: string; val: string; cols: string[] }) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return null;
        const records = await db.collections.get(name).query().fetch();
        const hit = records.find((r: any) => String((r._raw ?? {})[col] ?? r[col]) === val);
        if (!hit) return null;
        const raw = hit._raw ?? {};
        const out: Record<string, any> = { id: hit.id };
        for (const c of cols) out[c] = raw[c] ?? hit[c];
        return out;
    }, { name: table, col: column, val: value, cols: columns });
}

async function rowCount(page: Page, table: string): Promise<number> {
    return page.evaluate(async (name: string) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return -1;
        return await db.collections.get(name).query().fetchCount();
    }, table);
}

async function redBoxVisible(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const text = document.body?.innerText || '';
        return /Uncaught Error|Application Error|something went wrong/i.test(text);
    });
}

/** Same UI path `agribusiness_registry_crud.spec.ts` uses, kept local so this spec is self-contained. */
async function createParcel(page: Page, name: string): Promise<string> {
    await safeNavigate(page, PARCELS_ROUTE, 'Track land parcels, acreage, soil quality');
    await page.getByTestId('register-parcel-button').click();
    await page.getByTestId('parcel-name-input').fill(name);
    await page.getByTestId('parcel-code-input').fill(`CHAIN-${stamp}`);
    await page.getByTestId('landowner-name-input').fill(`E2E Chain Owner ${stamp}`);
    await page.getByTestId('parcel-area-input').fill('3.5');
    await page.getByTestId('save-parcel-button').click();
    await expect(page.getByTestId('parcel-name-input')).toHaveCount(0);
    const card = page.locator('[data-testid^="parcel-card-"]').filter({ hasText: name }).first();
    await expect(card).toBeVisible();
    const testId = await card.getAttribute('data-testid');
    if (!testId || !testId.startsWith('parcel-card-')) {
        throw new Error(`Parcel card is missing its data-testid (got ${String(testId)})`);
    }
    return testId.replace('parcel-card-', '');
}

async function createInvestor(page: Page): Promise<void> {
    await safeNavigate(page, INVESTORS_ROUTE, 'Investor Capital & Off-Take');
    await page.getByText('Add Investor', { exact: true }).first().click();
    await page.getByPlaceholder('e.g. BioGreen Agri Solutions').fill(COMPANY);
    await page.getByPlaceholder('Representative Name').fill('E2E Chain Rep');
    await page.getByPlaceholder('4.00').fill(OFFTAKE_PRICE.toString());
    await page.getByText('Save Investor', { exact: true }).first().click();
    await expect(page.getByPlaceholder('e.g. BioGreen Agri Solutions')).toHaveCount(0, { timeout: 30000 });
    await expect(page.getByText(COMPANY).first()).toBeVisible();
}

/** Starts a cycle on `parcelName`, links the chain investor, and returns the variety chip text. */
async function createCycle(page: Page, parcelName: string): Promise<void> {
    await safeNavigate(page, CYCLES_ROUTE, 'Cassava Planting Cycles');
    await page.getByText(/Start New Cycle/i).first().click();
    await page.getByText(`${parcelName} (3.5 ha)`).first().click();
    // The investor chip also overwrites the off-take price with the investor default (cycles.tsx:521),
    // which is what makes the 4.75 expected amount real rather than the form's 4.00 placeholder.
    await page.getByText(COMPANY, { exact: true }).first().click();
    await page.getByPlaceholder('Golden Yellow, KU-50, Lakan').fill(VARIETY);
    await page.getByPlaceholder('e.g. 3.0').fill('2.5');
    await page.getByText(/Start Cycle/i).last().click();
    await expect(page.locator('[data-testid^="cycle-edit-"]').first()).toBeVisible({ timeout: 30000 });
}

test.describe('Agribusiness cross-module chain: parcel -> cycle -> weigh-in -> investor ledger', () => {
    test('records a weigh-in and propagates net kg, cycle yield/status and the off-take ledger amount', async ({ page }) => {
        await loginAsAdmin(page);

        const parcelName = `E2E Chain Parcel ${stamp}`;
        await createParcel(page, parcelName);
        await createInvestor(page);
        await createCycle(page, parcelName);

        const cycle = await findRow(page, 'agri_crop_cycles', 'variety', VARIETY, [
            'parcel_id', 'investor_id', 'status', 'total_actual_yield_kg', 'offtake_price_per_kg',
        ]);

        expect(cycle, 'the cycle created through the UI must exist in WatermelonDB storage').not.toBeNull();
        const cycleId = cycle!.id;
        const yieldBefore = Number(cycle!.total_actual_yield_kg ?? 0);
        const parcelRow = await findRow(page, 'agri_parcels', 'name', parcelName, ['name']);
        expect(parcelRow, 'the parcel created through the UI must exist in storage').not.toBeNull();
        expect(String(cycle!.parcel_id), 'cycle must be linked to the parcel created above').toBe(String(parcelRow!.id));
        expect(Number(cycle!.offtake_price_per_kg), 'the investor chip should have set the off-take price').toBe(OFFTAKE_PRICE);
        expect(cycle!.investor_id, 'the cycle must carry the investor for off-take linkage').toBeTruthy();

        // --- weigh-in through the real scale terminal screen ---
        await safeNavigate(page, HARVEST_ROUTE, 'Digital Scale Entry');
        await page.getByText(`(${VARIETY})`).first().click();
        await page.getByPlaceholder('e.g. 14200').fill(GROSS.toString());
        await page.getByPlaceholder('e.g. 4100').fill(TARE.toString());
        await page.getByPlaceholder('ABC-1234').fill(`E2E-${stamp}`);
        const logsBefore = await rowCount(page, 'agri_harvest_logs');
        await page.getByText('Record Weigh-in Batch', { exact: true }).click();
        await expect(page.getByPlaceholder('e.g. 14200')).toHaveValue('', { timeout: 30000 });

        // --- 1. harvest log persisted, net recomputed by this spec ---
        expect(await rowCount(page, 'agri_harvest_logs'), 'one weigh-in row must be added').toBe(logsBefore + 1);
        const logRows = await page.evaluate(async (cid: string) => {
            const db = (window as any).__WATERMELON_DB__;
            const records = await db.collections.get('agri_harvest_logs').query().fetch();
            return records
                .filter((r: any) => String(r._raw.crop_cycle_id) === cid)
                .map((r: any) => ({ ...r._raw }));
        }, cycleId);
        expect(logRows, 'the new weigh-in must be attached to this cycle').toHaveLength(1);
        expect(Number(logRows[0].gross_weight_kg)).toBe(GROSS);
        expect(Number(logRows[0].tare_weight_kg)).toBe(TARE);
        expect(Number(logRows[0].net_weight_kg), `net must equal gross - tare = ${EXPECTED_NET}`).toBe(EXPECTED_NET);

        // --- 2. cycle yield accumulates by exactly net, status propagates ---
        const cycleAfter = await readRow(page, 'agri_crop_cycles', cycleId, ['total_actual_yield_kg', 'status']);
        expect(Number(cycleAfter!.total_actual_yield_kg), 'cycle yield must increase by exactly the recomputed net')
            .toBe(Number((yieldBefore + EXPECTED_NET).toFixed(2)));
        expect(cycleAfter!.status, 'a planted/growing cycle must flip to harvesting on first weigh-in').toBe('harvesting');

        // --- 3. investor off-take ledger amount = net x off-take price ---
        const ledger = await page.evaluate(async (cid: string) => {
            const db = (window as any).__WATERMELON_DB__;
            const records = await db.collections.get('agri_investor_ledgers').query().fetch();
            return records.filter((r: any) => String(r._raw.crop_cycle_id) === cid).map((r: any) => ({ ...r._raw }));
        }, cycleId);
        expect(ledger, 'an off-take ledger row must be auto-created for the linked investor').toHaveLength(1);
        expect(ledger[0].type).toBe('harvest_offtake');
        expect(Number(ledger[0].kilos_received), 'ledger kilos must equal the recomputed net').toBe(EXPECTED_NET);
        expect(Number(ledger[0].amount), `off-take amount must equal ${EXPECTED_NET} x ${OFFTAKE_PRICE} = ${EXPECTED_OFFTAKE}`)
            .toBe(EXPECTED_OFFTAKE);
    });

    test('rejects tare >= gross without writing a weigh-in or crashing', async ({ page }) => {
        await loginAsAdmin(page);
        await safeNavigate(page, HARVEST_ROUTE, 'Digital Scale Entry');

        const chip = page.getByText(`(${VARIETY})`).first();
        if (await chip.count() > 0) {
            await chip.click();
        } else {
            // Fall back to whatever cycle is selectable; the assertion is about refusal, not the cycle.
            await page.locator('.bg-gray-50.border-gray-200').first().click();
        }

        const logsBefore = await rowCount(page, 'agri_harvest_logs');
        await page.getByPlaceholder('e.g. 14200').fill('5000');
        await page.getByPlaceholder('e.g. 4100').fill('6000');
        await page.getByText('Record Weigh-in Batch', { exact: true }).click();

        // Allow the (async) handler a chance to write before measuring.
        await page.waitForTimeout(1500);

        expect(await rowCount(page, 'agri_harvest_logs'), 'invalid tare must not create a row').toBe(logsBefore);
        expect(await redBoxVisible(page), 'invalid tare must not crash the app').toBe(false);
        // The form must still be usable (values retained, nothing half-submitted).
        await expect(page.getByPlaceholder('e.g. 14200')).toHaveValue('5000');
    });
});
