import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live write-path + cross-module coverage for the four write-bearing screens that
 * the coverage cross-check (`tmp/systematic-test-matrix/coverage-crosscheck.js`)
 * reported as referenced by no Playwright spec before this file:
 *   `app/(admin)/settings/data-maintenance.tsx`      - lookups, branches, warehouses,
 *                                                     suppliers, statutory rate brackets
 *   `app/(admin)/settings/ui-branding.tsx`           - brand.* settings
 *   `app/(admin)/settings/statutory-allocations.tsx` - fund.*_allocation percentages
 *   `app/(admin)/reports/period-settings.tsx`        - financial_period_settings
 *
 * Step 3 (persistence): nothing here trusts the rendered list. Every write is
 * re-read from WatermelonDB storage through `window.__WATERMELON_DB__`, including
 * the lookup catalogue, which is NOT its own table - `LookupDataService.persistItems`
 * serialises the whole array into one `app_settings` row keyed `lookup.<category>`
 * (`src/services/LookupDataService.ts:280-311`), so this spec parses that JSON back
 * out and compares field by field.
 *
 * Step 4 (independent math, cross-module): the allocation screen divides the typed
 * percentage by 100 before storing it (`statutory-allocations.tsx:96`), and the
 * Statutory Reserves report multiplies the stored ratio back by the net income
 * (`src/services/CooperativeFundService.ts:27-55`). This spec recomputes both hops
 * itself, then reads the money back off the report screen, so the settings ->
 * financial-statement chain is proven end to end rather than assumed.
 *
 * Defect evidence (report:
 * `tmp/systematic-test-matrix/agri-e2e-verification-2026-10-21.md`):
 * - D4 (HIGH, restated here for screens that had no probe before): validation and
 *   required-field failures go through `Alert.alert`, which is a no-op on web, so a
 *   refusal is indistinguishable from a hang for the operator. Tests 2, 7, 9 and 12
 *   each assert `dialogs === 0` AND that no row was written AND no uncaught error.
 * - D24 (MEDIUM): `handleSaveSupplier` runs the payment-terms field through
 *   `parseInt(...) || 30` (`data-maintenance.tsx:325`), so a garbage term silently
 *   becomes 30 days and the AP due-date math downstream inherits it.
 * - D25 (MEDIUM, data loss): a malformed `lookup.<category>` payload is caught,
 *   `console.warn`ed, and replaced by the built-in defaults
 *   (`LookupDataService.ts:172-186`); the next save then persists defaults plus the
 *   new item, silently destroying every custom option that was in the corrupted
 *   array. The degraded D25 test proves the pre-existing custom option really existed.
 * - D26 (MEDIUM): the two numeric settings screens accept trailing garbage through
 *   `parseFloat` ('12abc' -> 12, `statutory-allocations.tsx:83-85`) or coerce it to
 *   zero ('abc' -> 0, `period-settings.tsx:100-103`), and neither has any validation
 *   at all, so a mistyped comparative figure is filed as 0 with no message.
 * - Positive control worth recording: the lookup and statutory-rate delete paths use
 *   `window.confirm` on web (`data-maintenance.tsx:211-218`, `:402-410`), so unlike
 *   the D4 screens their confirmation is capturable and D is reachable. The
 *   custom-option delete and statutory-bracket archive tests exercise real deletes.
 *
 * No assertion was weakened, skipped, or deleted to make a defect pass. The blank-
 * option, warehouse-without-branch, supplier-without-name and blank-branding-name
 * tests are D4 characterizations; the trailing-garbage allocations and period tests are
 * D26; the corrupt-lookup test is D25; the supplier-terms test is D24 - each written to
 * FAIL once the corresponding defect is fixed.
 */

const MAINT_ROUTE = '/settings/data-maintenance';
const MAINT_ANCHOR = 'Data Maintenance';
const BRAND_ROUTE = '/settings/ui-branding';
const BRAND_ANCHOR = 'UI Module Settings';
const ALLOC_ROUTE = '/settings/statutory-allocations';
const ALLOC_ANCHOR = 'Statutory Reserve Allocations';
const PERIOD_ROUTE = '/reports/period-settings';
const PERIOD_ANCHOR = 'Period Config';
const RESERVES_ROUTE = '/reports/statutory-reserves';
const RESERVES_ANCHOR = 'Statutory Reserves';

const stamp = Date.now().toString().slice(-6);

// --- lookup fixtures -------------------------------------------------------
const LOOKUP_KEY = 'lookup.uom';
const LOOKUP_NAME = `E2E Tarp Roll ${stamp}`;
const LOOKUP_EDITED_NAME = `E2E Tarp Roll ${stamp} Baled`;
// LookupDataService derives this from the name when no code is typed
// (LookupDataService.ts:234) - recomputed here, not copied from the app.
const DERIVED_CODE = LOOKUP_NAME.toLowerCase().replace(/\s+/g, '_');
const DEFAULT_UOM_COUNT = 12; // DEFAULT_LOOKUP_ITEMS.uom length, counted by hand

// --- master data fixtures --------------------------------------------------
const BRANCH_NAME = `E2E Branch ${stamp}`;
const BRANCH_CODE = `E2E-BR-${stamp}`;
const WAREHOUSE_NAME = `E2E Depot ${stamp}`;
const SUPPLIER_NAME = `E2E Supplier ${stamp}`;
const SUPPLIER_GARBAGE_TERMS = 'not-a-number';
const DEFAULT_TERMS_DAYS = 30; // MasterDataService.ts:251 default
const RATE_MIN = 1000;
const RATE_MAX = 4999.5;
const RATE_EE = 45;
const RATE_ER = 45;
const RATE_DESC = `E2E bracket ${stamp}`;

// --- branding / allocation / period fixtures -------------------------------
const BRAND_SHORT = `E2E Agri ${stamp}`;
const BRAND_FULL = `E2E Agri Cooperative ${stamp}`;
const ALLOCATIONS = [12, 9, 4, 5] as const;
const ALLOC_KEYS = [
    'fund.reserve_fund_allocation',
    'fund.education_fund_allocation',
    'fund.community_development_fund_allocation',
    'fund.optional_fund_allocation',
];
const NET_INCOME = 150000;
const GARBAGE_PCT = '12abc';      // parseFloat -> 12, passes the 0..100 guard
const OUT_OF_RANGE_PCT = '150';   // caught by the guard, and the guard does alert
const PERIOD_FISCAL_YEAR = 2031;  // unused by any other spec, so a fresh row
const PERIOD_GARBAGE = 'abc';     // parseFloat -> NaN -> `|| 0` -> silently zero
const PERIOD_VALID_AUTHORIZED = 333000;
const CORRUPT_CUSTOM_OPTION = `E2E Ghost Option ${stamp}`;

// =========================================================================
// storage helpers (step 3)
// =========================================================================

async function readAll(page: Page, table: string): Promise<Record<string, any>[] | null> {
    return page.evaluate(async (name: string) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return null;
        const records = await db.collections.get(name).query().fetch();
        return records.map((r: any) => {
            const raw = r._raw || {};
            const out: Record<string, any> = { id: r.id };
            for (const key of Object.keys(raw)) {
                const value = raw[key];
                out[key] = value instanceof Date ? value.getTime() : value;
            }
            return out;
        });
    }, table);
}

async function countRows(page: Page, table: string): Promise<number> {
    return page.evaluate(async (name: string) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return -1;
        return await db.collections.get(name).query().fetchCount();
    }, table);
}

/** One `app_settings` row read straight out of storage. */
async function appSetting(page: Page, key: string): Promise<Record<string, any> | null> {
    const rows = (await readAll(page, 'app_settings')) ?? [];
    const live = rows.filter(r => r.key === key && (r.deleted_at === null || r.deleted_at === undefined));
    return live.length > 0 ? live[0] : null;
}

/**
 * The lookup catalogue as it is actually stored: one JSON string on app_settings.
 * On a fresh harness database the key may not exist yet - `getLookupItems` then
 * serves the built-in defaults from code (`LookupDataService.ts:186`), so the
 * baseline this spec measures against is the default count, not a phantom zero.
 */
async function readLookups(page: Page): Promise<any[]> {
    const row = await appSetting(page, LOOKUP_KEY);
    expect(row, `no ${LOOKUP_KEY} row exists in app_settings`).not.toBeNull();
    const parsed = JSON.parse(row!.value);
    expect(Array.isArray(parsed), `${LOOKUP_KEY} value is not a JSON array`).toBe(true);
    return parsed;
}

/** Number of options the screen is working from, before any write in this test. */
async function lookupBaseline(page: Page): Promise<number> {
    const row = await appSetting(page, LOOKUP_KEY);
    if (!row || !row.value) return DEFAULT_UOM_COUNT;
    const parsed = JSON.parse(row.value);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed.length : DEFAULT_UOM_COUNT;
}

/**
 * FIXTURE ONLY - not the write under test. Seed a raw `app_settings` row so the
 * degraded case in test 13 can start from a corrupted payload that the app itself
 * would never produce.
 */
async function seedAppSetting(page: Page, key: string, value: string): Promise<void> {
    await page.evaluate(async (spec: { key: string; value: string }) => {
        const db = (window as any).__WATERMELON_DB__;
        const collection = db.collections.get('app_settings');
        const existing = await collection.query().fetch();
        const hit = existing.find((r: any) => r._raw.key === spec.key);
        await db.write(async () => {
            if (hit) {
                await hit.update((record: any) => {
                    record.value = spec.value;
                });
                return;
            }
            await collection.create((record: any) => {
                record._raw.id = `e2e-settings-${spec.key.replace(/[^a-z]/gi, '')}-${Date.now()}`;
                record.key = spec.key;
                record.value = spec.value;
                record.valueType = 'json';
                record.scope = 'global';
                record.isActive = true;
                record._raw.created_at = Date.now();
                record._raw.updated_at = Date.now();
                record._raw.deleted_at = null;
            });
        });
    }, { key, value });
}

// =========================================================================
// UI helpers
// =========================================================================

/**
 * In the react-native-web export the Pressable handler lives on the container div,
 * and `@expo/vector-icons` adds subtree text, so anchored exact-match regexes do not
 * work; label-substring + `.last()` is the pattern validated across this suite.
 */
function pressable(page: Page, label: string | RegExp) {
    return page
        .locator('div[tabindex], div[class*="cursor-pointer"], div[class*="select-none"], div[class*="active:bg"]')
        .filter({ hasText: label })
        .last();
}

const inputByPlaceholder = (page: Page, placeholder: string) =>
    page.locator(`input[placeholder="${placeholder}"]`);

/**
 * Capture every native dialog. `Alert.alert` is a no-op on web, so a D4 refusal
 * shows up as an EMPTY list - that is the assertion, not an absence of evidence.
 */
async function captureDialogs(page: Page): Promise<{ type: string; message: string }[]> {
    const seen: { type: string; message: string }[] = [];
    page.on('dialog', async dialog => {
        seen.push({ type: dialog.type(), message: dialog.message() });
        // Accept confirms so the destructive handler runs, exactly like a human OK.
        await dialog.accept();
    });
    return seen;
}

async function installErrorCollector(page: Page) {
    await page.addInitScript(() => {
        (window as any).__E2E_UNCAUGHT__ = [];
        window.addEventListener('unhandledrejection', event => {
            const reason: any = (event as any).reason;
            const message = typeof reason === 'string' ? reason : (reason?.message ?? JSON.stringify(reason));
            (window as any).__E2E_UNCAUGHT__.push(`rejection: ${message}`);
        });
        window.addEventListener('error', event => {
            (window as any).__E2E_UNCAUGHT__.push(`error: ${event.message}`);
        });
    });
}

async function uncaughtEntries(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__E2E_UNCAUGHT__ || []);
}

async function redBoxVisible(page: Page): Promise<boolean> {
    return page
        .getByText(/Uncaught Error|Application error|redbox/i)
        .first()
        .isVisible({ timeout: 1500 })
        .catch(() => false);
}

async function openMaintenance(page: Page, dialogs: { type: string; message: string }[]) {
    await loginAsAdmin(page);
    await safeNavigate(page, MAINT_ROUTE, MAINT_ANCHOR);
    // Arrival proof must be screen-unique: the 'Data Maintenance' title string also
    // lives in the sidebar and breadcrumb (strict-mode violation / vacuous match), so
    // the lookups-tab search field is used instead - it exists nowhere else.
    await expect(
        inputByPlaceholder(page, 'Search by name, code, or description...'),
    ).toBeVisible({ timeout: 30000 });
    expect(dialogs, 'the screen must open without a native dialog').toHaveLength(0);
}

/** Switch the main tab; tabs live in a horizontal ScrollView. */
async function selectTab(page: Page, label: string) {
    await pressable(page, label).click();
    await page.waitForTimeout(700);
}

/** Filter the lookup list down to one row so its affordances are unambiguous. */
async function filterLookups(page: Page, term: string) {
    await inputByPlaceholder(page, 'Search by name, code, or description...').fill(term);
    await page.waitForTimeout(600);
}

async function saveModal(page: Page, label: RegExp) {
    await pressable(page, label).click();
    await page.waitForTimeout(1800);
}

/** Parse only the peso figures a screen renders, NBSP-normalised (formatPHP output). */
async function pesoFigures(page: Page, selector: string): Promise<number[]> {
    const values: number[] = await page.evaluate((css: string) => {
        const out: number[] = [];
        for (const node of Array.from(document.querySelectorAll(css))) {
            const text = (node.textContent || '').replace(/ /g, ' ').trim();
            if (!/PHP/.test(text)) continue;
            const hit = /(-)?PHP\s*([\d,]+\.\d{2})/.exec(text);
            if (hit) out.push(Number(`${hit[1] || ''}${hit[2].replace(/,/g, '')}`));
        }
        return out;
    }, selector);
    return values;
}

const round2 = (v: number) => Math.round(v * 100) / 100;

// =========================================================================

test.describe('Master data + settings write paths (data maintenance, branding, allocations, period config)', () => {
    test.beforeEach(async ({ page }) => {
        await installErrorCollector(page);
    });

    test('a new lookup option persists inside the lookup.uom JSON blob, with the code derived independently', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);

        const baseline = await lookupBaseline(page);
        expect(
            baseline,
            'an empty database falls back to the 12 built-in UOM defaults',
        ).toBe(DEFAULT_UOM_COUNT);

        await pressable(page, 'Add Option').click();
        await expect(page.getByText('Add New Option')).toBeVisible();
        await inputByPlaceholder(page, 'e.g. Metric Ton (MT)').fill(LOOKUP_NAME);
        // Code intentionally left blank so the derived slug can be verified.
        await saveModal(page, /Save Option/);

        expect(await page.getByText('Add New Option').count(), 'the modal must close on success').toBe(0);

        const after = await readLookups(page);
        expect(after.length, 'exactly one option added').toBe(baseline + 1);
        expect(
            after.filter(i => (i.isSystemDefault ?? i.is_system_default) === true).length,
            'the baseline the new option was appended to is system defaults only',
        ).toBe(DEFAULT_UOM_COUNT);
        const mine = after.filter(
            i => (i.name ?? i._data?.name) === LOOKUP_NAME,
        );
        expect(mine, `the typed option is missing from the stored JSON: ${JSON.stringify(after.map(i => i.name))}`).toHaveLength(1);
        expect(mine[0].code, 'LookupDataService derives the code from the name').toBe(DERIVED_CODE);
        expect(mine[0].isActive ?? mine[0].is_active, 'a new option is active').toBe(true);
        expect(mine[0].isSystemDefault ?? mine[0].is_system_default, 'a custom option is not a system default').toBe(false);

        // Reading is proven by the search filter matching the stored row, not by the
        // toast - the row must come back out of storage by name.
        await filterLookups(page, String(stamp));
        await expect(page.getByText(LOOKUP_NAME)).toBeVisible();

        expect(await uncaughtEntries(page), 'no uncaught errors on the create path').toEqual([]);
        expect(await redBoxVisible(page)).toBe(false);
        expect(dialogs, 'a successful lookup save raises no native dialog').toHaveLength(0);
    });

    test('CHARACTERIZES D4 (fails once fixed): a blank option name is refused in total silence', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);

        const before = await lookupBaseline(page);
        await pressable(page, 'Add Option').click();
        await expect(page.getByText('Add New Option')).toBeVisible();
        // Name left empty -> handleSaveLookup returns after Alert.alert (data-maintenance.tsx:174-177).
        await saveModal(page, /Save Option/);

        const after = await lookupBaseline(page);
        expect(after, 'no option may be written for an empty name').toBe(before);
        expect(
            await page.getByText('Add New Option').isVisible(),
            'the modal stays open because the operator is never told why the save did nothing',
        ).toBe(true);
        expect(dialogs, 'D4: Alert.alert is a no-op on web, so a refusal produces no dialog at all').toHaveLength(0);
        expect(await uncaughtEntries(page), 'but it must not crash either').toEqual([]);
        expect(await redBoxVisible(page)).toBe(false);
    });

    test('editing an option updates the same stored entry instead of appending one', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);

        // Create through the UI first, then edit that row - no fixture writes.
        await pressable(page, 'Add Option').click();
        await inputByPlaceholder(page, 'e.g. Metric Ton (MT)').fill(LOOKUP_NAME);
        await saveModal(page, /Save Option/);
        const created = await readLookups(page);
        const original = created.find(i => i.name === LOOKUP_NAME)!;
        expect(original, 'the create step must have persisted the option').toBeTruthy();

        await filterLookups(page, String(stamp));
        // Only my row survives the filter, so its edit affordance is the single gray button.
        const editButton = page.locator('div[class*="active:bg-gray-100"]').last();
        await expect(editButton, 'the filtered row must expose an edit affordance').toBeVisible();
        await editButton.click();
        await expect(page.getByText('Edit Option')).toBeVisible();
        await inputByPlaceholder(page, 'e.g. Metric Ton (MT)').fill(LOOKUP_EDITED_NAME);
        await saveModal(page, /Save Option/);

        const after = await readLookups(page);
        expect(after.length, 'an edit must not add a second row').toBe(created.length);
        const updated = after.find(i => i.id === original.id)!;
        expect(updated, 'the same id must still exist').toBeTruthy();
        expect(updated.name, 'the renamed value must be what storage holds').toBe(LOOKUP_EDITED_NAME);
        expect(after.some(i => i.name === LOOKUP_NAME), 'the old name must be gone').toBe(false);
        expect(await uncaughtEntries(page)).toEqual([]);
        expect(dialogs).toHaveLength(0);
    });

    test('the row switch deactivates the option in the stored JSON', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);

        await pressable(page, 'Add Option').click();
        await inputByPlaceholder(page, 'e.g. Metric Ton (MT)').fill(LOOKUP_NAME);
        await saveModal(page, /Save Option/);

        await filterLookups(page, String(stamp));
        const switches = page.getByRole('switch');
        expect(await switches.count(), 'the filtered row must render exactly one switch').toBe(1);
        expect(await switches.first().isChecked(), 'a new option starts active').toBe(true);
        await switches.first().click();
        await page.waitForTimeout(1500);

        const stored = (await readLookups(page)).find(i => i.name === LOOKUP_NAME)!;
        expect(stored, 'the option must still exist after a toggle').toBeTruthy();
        expect(stored.isActive ?? stored.is_active, 'the switch must flip the stored flag, not just the UI').toBe(false);
        expect(await switches.first().isChecked(), 'and the rendered switch must agree').toBe(false);
        expect(await uncaughtEntries(page)).toEqual([]);
        expect(dialogs).toHaveLength(0);
    });

    test('a custom option is really deleted - this screen uses window.confirm, so web can reach D', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);

        await pressable(page, 'Add Option').click();
        await inputByPlaceholder(page, 'e.g. Metric Ton (MT)').fill(LOOKUP_NAME);
        await saveModal(page, /Save Option/);
        const before = await readLookups(page);
        expect(before.some(i => i.name === LOOKUP_NAME)).toBe(true);

        await filterLookups(page, String(stamp));
        const deleteButton = page.locator('div[class*="active:bg-red-100"]').last();
        await expect(deleteButton, 'a custom (non-default) row exposes a delete affordance').toBeVisible();
        await deleteButton.click();
        await page.waitForTimeout(1200);

        expect(dialogs, 'the confirmation must actually render on web (unlike the D4 screens)').toHaveLength(1);
        expect(dialogs[0].type, 'window.confirm, not an invisible Alert.alert').toBe('confirm');
        expect(dialogs[0].message).toContain(LOOKUP_NAME);

        const after = await readLookups(page);
        expect(after.length, 'exactly one option removed').toBe(before.length - 1);
        expect(after.some(i => i.name === LOOKUP_NAME), 'the deleted option must be gone from storage').toBe(false);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('a branch persists verbatim, its switch deactivates the stored row, and a warehouse lands on that branch id', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);
        await selectTab(page, 'Branches & Locations');

        const before = await countRows(page, 'branches');
        await pressable(page, 'New Branch').click();
        await expect(page.getByText('Add New Branch')).toBeVisible();
        await inputByPlaceholder(page, 'e.g. Crispy King - Tubigon').fill(BRANCH_NAME);
        await inputByPlaceholder(page, 'e.g. CK-TUB-01').fill(BRANCH_CODE);
        await saveModal(page, /Save Branch/);

        const rows = (await readAll(page, 'branches'))!;
        expect(rows.length, 'one branch written').toBe(before + 1);
        const mine = rows.filter(r => r.name === BRANCH_NAME);
        expect(mine, `typed branch not found in storage: ${JSON.stringify(rows.map(r => r.name))}`).toHaveLength(1);
        expect(mine[0].code, 'the code must be stored exactly as typed').toBe(BRANCH_CODE);
        expect(mine[0].is_active, 'createBranch defaults a new branch to active').toBe(true);
        expect(mine[0].is_hq ?? false, 'HQ not requested, so it must not be set').toBe(false);
        expect(mine[0].deleted_at ?? null, 'a fresh branch is not soft-deleted').toBeNull();

        // CROSS-MODULE within the screen: the warehouse form lists live branches
        // (data-maintenance.tsx:1156-1175) and stores the chosen id as branch_id.
        // Warehouses live behind their own subtab on the Locations tab.
        await pressable(page, /Warehouses & Storage/).click();
        await page.waitForTimeout(700);
        await pressable(page, 'New Warehouse').click();
        await expect(page.getByText('Add Warehouse Location')).toBeVisible();
        const branchChip = page
            .locator('div[class*="rounded-lg"][class*="border"]')
            .filter({ hasText: BRANCH_NAME })
            .last();
        await expect(branchChip, 'the branch just created must be selectable for a warehouse').toBeVisible();
        await branchChip.click();
        await page.waitForTimeout(400);
        await inputByPlaceholder(page, 'e.g. Main Kitchen Freezer').fill(WAREHOUSE_NAME);
        await saveModal(page, /Save Location/);

        const warehouses = (await readAll(page, 'warehouses'))!;
        const depot = warehouses.filter(r => r.name === WAREHOUSE_NAME);
        expect(depot, 'the warehouse must be stored').toHaveLength(1);
        expect(depot[0].branch_id, 'and it must point at the stored branch id, not its name').toBe(mine[0].id);

        // Update through the switch, back on the branches subtab, scoped to this row.
        await pressable(page, /Operational Branches/).click();
        await page.waitForTimeout(700);
        const branchRow = page
            .locator('div[class*="flex-row"][class*="justify-between"]')
            .filter({ hasText: BRANCH_NAME })
            .last();
        const branchSwitch = branchRow.getByRole('switch');
        await expect(branchSwitch, 'the branch row renders exactly one switch').toHaveCount(1);
        const checkedBefore = await branchSwitch.isChecked();
        await branchSwitch.click();
        await page.waitForTimeout(1500);
        const toggled = (await readAll(page, 'branches'))!.find(r => r.id === mine[0].id)!;
        expect(toggled.is_active, 'the stored is_active must flip').toBe(!checkedBefore);
        expect(await uncaughtEntries(page)).toEqual([]);
        expect(dialogs).toHaveLength(0);
    });

    test('CHARACTERIZES D4 (fails once fixed): a warehouse without a branch is refused silently and writes nothing', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);
        await selectTab(page, 'Branches & Locations');

        const before = await countRows(page, 'warehouses');
        await pressable(page, /Warehouses & Storage/).click();
        await page.waitForTimeout(700);
        await pressable(page, 'New Warehouse').click();
        await expect(page.getByText('Add Warehouse Location')).toBeVisible();
        // No branch chip is clicked and no name typed: handleSaveWarehouse returns
        // after Alert.alert (data-maintenance.tsx:281-284).
        await saveModal(page, /Save Location/);

        expect(await countRows(page, 'warehouses'), 'no warehouse row may be written').toBe(before);
        expect(
            await page.getByText('Add Warehouse Location').isVisible(),
            'the modal stays open with no explanation',
        ).toBe(true);
        expect(dialogs, 'D4: the required-fields refusal is invisible on web').toHaveLength(0);
        expect(await uncaughtEntries(page)).toEqual([]);
        expect(await redBoxVisible(page)).toBe(false);
    });

    test('a supplier persists, but a garbage payment term silently becomes 30 days (D24)', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);
        await selectTab(page, 'Suppliers');

        const before = await countRows(page, 'suppliers');
        await pressable(page, 'New Supplier').click();
        await expect(page.getByText('Register Supplier')).toBeVisible();
        await inputByPlaceholder(page, 'e.g. Magnolia Chicken Wholesale').fill(SUPPLIER_NAME);
        await inputByPlaceholder(page, '000-000-000-000').fill('123-456-789-000');
        await inputByPlaceholder(page, 'e.g. 30').fill(SUPPLIER_GARBAGE_TERMS);
        await saveModal(page, /Save Supplier/);

        const rows = (await readAll(page, 'suppliers'))!;
        expect(rows.length, 'one supplier written').toBe(before + 1);
        const mine = rows.filter(r => r.name === SUPPLIER_NAME);
        expect(mine, 'the supplier must exist in storage').toHaveLength(1);
        expect(mine[0].tin, 'the TIN is stored unformatted, exactly as typed').toBe('123-456-789-000');
        expect(mine[0].is_active).toBe(true);
        expect(mine[0].deleted_at ?? null).toBeNull();
        expect(
            mine[0].payment_terms_days,
            `D24: parseInt('${SUPPLIER_GARBAGE_TERMS}') || 30 quietly files 30 days instead of refusing the input`,
        ).toBe(DEFAULT_TERMS_DAYS);
        expect(await uncaughtEntries(page)).toEqual([]);
        expect(dialogs, 'and the operator is never told the term was replaced').toHaveLength(0);
    });

    test('CHARACTERIZES D4 (fails once fixed): a supplier with no name is refused with no feedback', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);
        await selectTab(page, 'Suppliers');

        const before = await countRows(page, 'suppliers');
        await pressable(page, 'New Supplier').click();
        await inputByPlaceholder(page, 'orders@supplier.ph').fill('orders@example.ph');
        await saveModal(page, /Save Supplier/);

        expect(await countRows(page, 'suppliers'), 'no row for an unnamed supplier').toBe(before);
        expect(await page.getByText('Register Supplier').isVisible(), 'modal still open').toBe(true);
        expect(dialogs, 'D4: no dialog, no inline message').toHaveLength(0);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('a statutory bracket stores the exact typed numbers and can be archived through a real confirm dialog', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);
        await selectTab(page, 'Statutory Rates');

        const before = await countRows(page, 'statutory_rates');
        await pressable(page, 'New Bracket').click();
        await expect(page.getByText('Add Statutory Rate Bracket')).toBeVisible();

        // The three "0.00" fields are Min, EE share, ER share, in DOM order.
        const numeric = inputByPlaceholder(page, '0.00');
        expect(await numeric.count(), 'min + EE + ER fields must all render').toBe(3);
        await numeric.nth(0).fill(String(RATE_MIN));
        await inputByPlaceholder(page, 'Leave empty if none').fill(String(RATE_MAX));
        await numeric.nth(1).fill(String(RATE_EE));
        await numeric.nth(2).fill(String(RATE_ER));
        await inputByPlaceholder(page, 'e.g. 2026 Updated Bracket').fill(RATE_DESC);
        await saveModal(page, /Save Bracket/);

        const rows = (await readAll(page, 'statutory_rates'))!;
        expect(rows.length, 'one bracket written').toBe(before + 1);
        const mine = rows.filter(r => r.description === RATE_DESC);
        expect(mine, 'the bracket must exist with the typed description').toHaveLength(1);
        expect(mine[0].bracket_min).toBe(RATE_MIN);
        expect(mine[0].bracket_max).toBe(RATE_MAX);
        expect(mine[0].employee_share).toBe(RATE_EE);
        expect(mine[0].employer_share).toBe(RATE_ER);
        expect(mine[0].rate_type, 'rate type is lower-cased by the service').toBe('sss');
        // Independent arithmetic, not the app's: a combined contribution is EE + ER.
        expect(
            round2(Number(mine[0].employee_share) + Number(mine[0].employer_share)),
            'stored EE + ER must equal the typed combined share',
        ).toBe(round2(RATE_EE + RATE_ER));
        expect(mine[0].deleted_at ?? null, 'a fresh bracket is live').toBeNull();

        // Archive it through the web-reachable window.confirm path.
        // The statutory-rate archive button is `bg-red-50` (no active:bg-red-100).
        const deleteButton = page.locator('div[class*="bg-red-50"]').last();
        await expect(deleteButton, 'the list must expose the archive affordance').toBeVisible();
        await deleteButton.click();
        await page.waitForTimeout(1200);
        expect(dialogs, 'the archive confirmation renders on web').toHaveLength(1);
        expect(dialogs[0].message).toContain('archive this rate bracket');

        const archived = (await readAll(page, 'statutory_rates'))!.find(r => r.id === mine[0].id)!;
        expect(archived.deleted_at, 'archive is a soft delete: the row stays with a timestamp').toBeTruthy();
        expect(Number(archived.deleted_at), 'and it must be a real instant').toBeGreaterThan(0);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('CHARACTERIZES D4 (fails once fixed): a non-numeric salary bracket is refused silently', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await openMaintenance(page, dialogs);
        await selectTab(page, 'Statutory Rates');

        const before = await countRows(page, 'statutory_rates');
        await pressable(page, 'New Bracket').click();
        await expect(page.getByText('Add Statutory Rate Bracket')).toBeVisible();
        const numeric = inputByPlaceholder(page, '0.00');
        await numeric.nth(0).fill('abc');
        await numeric.nth(1).fill(String(RATE_EE));
        await numeric.nth(2).fill(String(RATE_ER));
        await saveModal(page, /Save Bracket/);

        expect(await countRows(page, 'statutory_rates'), 'the isNaN guard must stop the write').toBe(before);
        expect(await page.getByText('Add Statutory Rate Bracket').isVisible(), 'modal still open').toBe(true);
        expect(dialogs, 'D4: the "valid numerical amounts" message is an Alert.alert, invisible on web').toHaveLength(0);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('degraded (D25): a corrupt lookup payload falls back to defaults and the next save silently discards the custom options', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await loginAsAdmin(page);

        // Pre-condition proved from storage, not assumed: a payload holding one
        // custom option, made unparseable by a trailing comma.
        const corrupt = `{"items":[{"id":"custom-uom-ghost","name":"${CORRUPT_CUSTOM_OPTION}",` +
            `"code":"ghost","isActive":true,"isSystemDefault":false},]}`;
        await seedAppSetting(page, LOOKUP_KEY, corrupt);
        const seededRow = await appSetting(page, LOOKUP_KEY);
        expect(seededRow, 'the fixture row must be stored').not.toBeNull();
        expect(() => JSON.parse(seededRow!.value), 'the seeded payload must genuinely be unparseable').toThrow();

        await safeNavigate(page, MAINT_ROUTE, MAINT_ANCHOR);
        // Screen-unique arrival proof (the title string duplicates in chrome).
        await expect(
            inputByPlaceholder(page, 'Search by name, code, or description...'),
        ).toBeVisible({ timeout: 30000 });

        // The screen must not crash: it renders the built-in defaults instead.
        await expect(page.getByText('Kilogram (kg)').first(), 'the default catalogue must still render').toBeVisible();
        expect(
            await page.getByText(CORRUPT_CUSTOM_OPTION).count(),
            'the custom option hidden inside the corrupt payload is not recoverable in the UI',
        ).toBe(0);

        await pressable(page, 'Add Option').click();
        await inputByPlaceholder(page, 'e.g. Metric Ton (MT)').fill(LOOKUP_NAME);
        await saveModal(page, /Save Option/);

        const after = await readLookups(page);
        expect(
            after.some(i => i.name === CORRUPT_CUSTOM_OPTION),
            'D25: the custom option that was in the corrupt array is gone - the recovery path rebuilt from defaults',
        ).toBe(false);
        expect(
            after.filter(i => i.isSystemDefault === true).length,
            'every surviving pre-existing entry is a system default',
        ).toBe(DEFAULT_UOM_COUNT);
        expect(after.length, 'defaults + only the one new option').toBe(DEFAULT_UOM_COUNT + 1);
        expect(after.some(i => i.name === LOOKUP_NAME), 'and the new write did land').toBe(true);

        expect(await uncaughtEntries(page), 'the parse failure is caught, never thrown to the UI').toEqual([]);
        expect(dialogs, 'and the data loss happens without any warning').toHaveLength(0);
        expect(await redBoxVisible(page)).toBe(false);
    });

    test('branding saves both names to app_settings with an audit row, and stores no logo payload', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await loginAsAdmin(page);
        await safeNavigate(page, BRAND_ROUTE, BRAND_ANCHOR);
        // 'UI Module Settings' duplicates in the sidebar/breadcrumb; the branding
        // company-name field exists only on this screen.
        await expect(inputByPlaceholder(page, 'e.g. POS Cursor').first()).toBeVisible({ timeout: 30000 });

        const nameInputs = inputByPlaceholder(page, 'e.g. POS Cursor');
        expect(await nameInputs.count(), 'short + full company name fields must both render').toBe(2);
        await nameInputs.nth(0).fill(BRAND_SHORT);
        await nameInputs.nth(1).fill(BRAND_FULL);
        const settingsBefore = await countRows(page, 'app_settings');
        await pressable(page, /Save Branding Settings/).click();
        await page.waitForTimeout(2500);

        const shortRow = await appSetting(page, 'brand.company_name');
        expect(shortRow, 'brand.company_name must be stored').not.toBeNull();
        expect(shortRow!.value, 'the short name must be stored trimmed, exactly as typed').toBe(BRAND_SHORT);
        const fullRow = await appSetting(page, 'brand.company_name_full');
        expect(fullRow!.value).toBe(BRAND_FULL);

        const logoRow = await appSetting(page, 'brand.logo_base64');
        expect(
            logoRow ? logoRow.value : '',
            'the logo is a local-only key, so app_settings must never carry the base64 payload',
        ).toBe('');

        expect(await countRows(page, 'app_settings'), 'saving must not spawn duplicate settings rows').toBe(settingsBefore);
        const logs = ((await readAll(page, 'action_logs')) ?? []).filter(l => l.entity_type === 'app_settings');
        expect(logs.length, 'SettingsService writes an action_logs row per changed setting').toBeGreaterThanOrEqual(2);
        const parsed = logs.map(l => {
            try { return JSON.parse(l.new_data ?? '{}'); } catch { return {}; }
        });
        expect(
            parsed.some(n => n && n.value === BRAND_SHORT),
            'the audit trail must record the value that was actually written',
        ).toBe(true);

        // Invalid case: clearing the short name must not overwrite the stored value.
        // handleSave's success path calls safeBack after 1s (ui-branding.tsx:151-153),
        // so the 2500ms wait above means the form is already gone; re-open it first.
        await safeNavigate(page, BRAND_ROUTE, BRAND_ANCHOR);
        await expect(inputByPlaceholder(page, 'e.g. POS Cursor').first()).toBeVisible({ timeout: 30000 });
        await nameInputs.nth(0).fill('   ');
        await pressable(page, /Save Branding Settings/).click();
        await page.waitForTimeout(2000);
        expect(
            (await appSetting(page, 'brand.company_name'))!.value,
            'a blank short name must be refused, leaving the stored value intact',
        ).toBe(BRAND_SHORT);
        expect(dialogs, 'D4: the "Company Name cannot be empty" Alert never reaches web').toHaveLength(0);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('allocation percentages store ratio = typed/100, and a trailing-garbage entry is coerced without complaint (D26)', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await loginAsAdmin(page);
        await safeNavigate(page, ALLOC_ROUTE, ALLOC_ANCHOR);
        await expect(page.getByText('Total Appropriated').first()).toBeVisible({ timeout: 30000 });

        const pctInputs = inputByPlaceholder(page, 'e.g. 10');
        expect(await pctInputs.count(), 'the four statutory fund percentage fields must render').toBe(4);
        for (let i = 0; i < ALLOCATIONS.length; i += 1) {
            await pctInputs.nth(i).fill(String(ALLOCATIONS[i]));
        }

        // Independent recompute of the screen\'s own "Total Appropriated" figure.
        const expectedTotal = round2(ALLOCATIONS.reduce((sum, v) => sum + v, 0));
        const totalText = await page.locator('div[class*="rounded-2xl"][class*="border"]').filter({ hasText: /Total Appropriated/i }).last().innerText();
        const parsedTotal = Number((/([\d.]+)\s*%/.exec(totalText) || [])[1]);
        expect(parsedTotal, `the rendered total must equal the recomputed ${expectedTotal}`)
            .toBe(expectedTotal);

        await pressable(page, /Save Parameters/).click();
        await page.waitForTimeout(1800);

        // This screen routes its messages through window.alert (statutory-allocations.tsx:55-57),
        // so the confirmation IS capturable, and a successful save then navigates back via
        // safeBack (:99), so every later assertion that needs the form must re-open it.
        expect(dialogs.map(d => d.message).join(' | '), 'saving must announce itself').toContain('Settings Saved');
        for (let i = 0; i < ALLOC_KEYS.length; i += 1) {
            const row = await appSetting(page, ALLOC_KEYS[i]);
            expect(row, `${ALLOC_KEYS[i]} must be stored`).not.toBeNull();
            expect(
                Number(row!.value),
                `${ALLOC_KEYS[i]}: ${ALLOCATIONS[i]}% must persist as the ratio ${ALLOCATIONS[i] / 100}`,
            ).toBeCloseTo(ALLOCATIONS[i] / 100, 10);
        }

        // Out-of-range is genuinely caught here (the guard exists and alerts)...
        await safeNavigate(page, ALLOC_ROUTE, ALLOC_ANCHOR);
        await expect(page.getByText('Total Appropriated').first()).toBeVisible({ timeout: 30000 });
        await pctInputs.nth(0).fill(OUT_OF_RANGE_PCT);
        await pressable(page, /Save Parameters/).click();
        await page.waitForTimeout(1200);
        expect(
            Number((await appSetting(page, ALLOC_KEYS[0]))!.value),
            'a 150% allocation must be refused, leaving the stored ratio alone',
        ).toBeCloseTo(ALLOCATIONS[0] / 100, 10);
        expect(
            dialogs.map(d => d.message).join(' | '),
            'and the refusal must be visible',
        ).toContain('Invalid Allocation');

        // ...but trailing garbage is not: parseFloat('12abc') === 12 slips through the
        // same guard. The rejected save above left '150' in field 0 (handleSave returns
        // at :90 before clearing, so a re-save would be refused for the 150, not tested
        // for the garbage), so re-open the screen to reload the stored 12/9/4/5 before
        // isolating field 1.
        await safeNavigate(page, ALLOC_ROUTE, ALLOC_ANCHOR);
        await expect(page.getByText('Total Appropriated').first()).toBeVisible({ timeout: 30000 });
        await pctInputs.nth(1).fill(GARBAGE_PCT);
        await pressable(page, /Save Parameters/).click();
        await page.waitForTimeout(1800);
        expect(
            Number((await appSetting(page, ALLOC_KEYS[1]))!.value),
            "D26: '12abc' is stored as 0.12 with no warning that the input was not a number",
        ).toBeCloseTo(0.12, 10);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('CROSS-MODULE: saved allocations propagate to the Statutory Reserves report, whose figures match an independent recompute', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await loginAsAdmin(page);

        // Hop 1: write the percentages through the settings screen.
        await safeNavigate(page, ALLOC_ROUTE, ALLOC_ANCHOR);
        await expect(page.getByText('Total Appropriated').first()).toBeVisible({ timeout: 30000 });
        const pctInputs = inputByPlaceholder(page, 'e.g. 10');
        expect(await pctInputs.count()).toBe(4);
        for (let i = 0; i < ALLOCATIONS.length; i += 1) {
            await pctInputs.nth(i).fill(String(ALLOCATIONS[i]));
        }
        await pressable(page, /Save Parameters/).click();
        await page.waitForTimeout(1800);

        // Storage really holds the ratios the report is about to read back.
        for (let i = 0; i < ALLOC_KEYS.length; i += 1) {
            expect(Number((await appSetting(page, ALLOC_KEYS[i]))!.value))
                .toBeCloseTo(ALLOCATIONS[i] / 100, 10);
        }

        // Hop 2: the report screen, opened in the same session.
        await safeNavigate(page, RESERVES_ROUTE, RESERVES_ANCHOR);
        // 'Statutory Reserves' triple-matches; the 'Surplus Distribution' heading is unique.
        await expect(page.getByText('Surplus Distribution').first()).toBeVisible({ timeout: 30000 });

        // The four fund cards - and their percentage chips - render only inside the
        // `computed && result` branch (statutory-reserves.tsx:146), so the report has to
        // be computed before the propagated allocations are visible on screen.
        await inputByPlaceholder(page, 'e.g. 150,000').fill(String(NET_INCOME));
        await pressable(page, /Calculate Distribution/).click();
        await page.waitForTimeout(2000);

        for (const pct of ALLOCATIONS) {
            await expect(
                page.getByText(`${pct}%`).first(),
                `the ${pct}% chip proves the report re-read the setting instead of using its own default`,
            ).toBeVisible({ timeout: 30000 });
        }

        // Independent math: CooperativeFundService.ts:33-49 rounds each fund to 2dp,
        // sums the four, and retains the rest.
        const funds = ALLOCATIONS.map(pct => round2(NET_INCOME * (pct / 100)));
        const totalFunds = round2(funds.reduce((s, v) => s + v, 0));
        const retained = round2(NET_INCOME - totalFunds);

        const rendered = await pesoFigures(page, 'div[class*="text-xl"], div[class*="text-3xl"], div[class*="text-xs"]');
        expect(rendered.length, 'the report must render peso figures').toBeGreaterThan(4);
        for (const expected of funds) {
            expect(
                rendered.filter(v => v === expected).length,
                `a fund figure of ${expected} must appear as computed here (found ${JSON.stringify(rendered)})`,
            ).toBeGreaterThan(0);
        }
        expect(rendered).toContain(NET_INCOME);
        expect(rendered, 'the retained surplus must equal net income minus my own sum').toContain(retained);
        expect(totalFunds, 'and the four funds must sum to the recomputed appropriation').toBe(
            round2(funds.reduce((s, v) => s + v, 0)),
        );
        expect(await uncaughtEntries(page)).toEqual([]);
        // Hop 1's allocation save legitimately fires one web alert
        // (`alert('Settings Saved: ...')`, statutory-allocations.tsx:56), so `dialogs` is
        // not empty by design here. What the cross-module test must pin is that the
        // reserves report contributes no failure: handleCompute only alerts on invalid
        // input (statutory-reserves.tsx:49-52), so a valid net income must not raise an
        // error/'Invalid' dialog - that is the assertion that guards the report hop.
        expect(
            dialogs.filter(d => /Invalid|Error|Failed/i.test(d.message)),
            'the report must compute without raising an error or invalid-input dialog',
        ).toHaveLength(0);
    });

    test('period config writes financial_period_settings, but garbage numeric input is silently filed as zero (D26)', async ({ page }) => {
        const dialogs = await captureDialogs(page);
        await loginAsAdmin(page);
        // Opening the screen and stepping forward to the target FY is needed twice,
        // because handleSave calls router.back() on success (period-settings.tsx:112),
        // so the form is gone after the first save. The plus stepper is the second
        // `active:bg-slate-200` button (:180), so `.last()` moves forward; the guard-loop
        // avoids assuming the screen's reset year (it remounts at 2025).
        const openAtTargetFy = async () => {
            await safeNavigate(page, PERIOD_ROUTE, PERIOD_ANCHOR);
            // 'Period Config' can duplicate in chrome; 'Save Config' lives only here.
            await expect(page.getByText('Save Config').first()).toBeVisible({ timeout: 30000 });
            for (let guard = 0; guard < 15; guard += 1) {
                const reached = await page
                    .getByText(`FY ${PERIOD_FISCAL_YEAR}`)
                    .first()
                    .isVisible()
                    .catch(() => false);
                if (reached) break;
                await page.locator('div[class*="active:bg-slate-200"]').last().click();
                await page.waitForTimeout(400);
            }
            await expect(page.getByText(`FY ${PERIOD_FISCAL_YEAR}`).first()).toBeVisible({ timeout: 10000 });
        };

        await openAtTargetFy();

        const capital = inputByPlaceholder(page, '0.00');
        expect(await capital.count(), 'the four FY capital fields must render').toBe(4);
        await capital.nth(0).fill(String(PERIOD_VALID_AUTHORIZED));
        await capital.nth(1).fill('400000');
        await pressable(page, /Save Config/).click();
        await page.waitForTimeout(2000);

        const rows = (await readAll(page, 'financial_period_settings'))!;
        const mine = rows.filter(r => Number(r.fiscal_year) === PERIOD_FISCAL_YEAR);
        expect(mine, 'the FY row must be stored').toHaveLength(1);
        expect(Number(mine[0].authorized_share_capital), 'a valid number is stored exactly').toBe(PERIOD_VALID_AUTHORIZED);
        expect(Number(mine[0].subscribed_capital)).toBe(400000);
        const prior = JSON.parse(mine[0].prior_year_data);
        expect(typeof prior, 'prior-year comparatives are stored as the documented JSON blob').toBe('object');

        // Now the invalid case. The save above called router.back(), so re-open and
        // re-step to the same FY before touching the form again; the field reloads the
        // stored 333000. This form has no validation at all, and
        // `parseFloat('abc') || 0` turns the field into a real zero.
        await openAtTargetFy();
        await inputByPlaceholder(page, '0.00').nth(0).fill(PERIOD_GARBAGE);
        await pressable(page, /Save Config/).click();
        await page.waitForTimeout(2000);
        const after = (await readAll(page, 'financial_period_settings'))!
            .find(r => Number(r.fiscal_year) === PERIOD_FISCAL_YEAR)!;
        expect(Number(after.authorized_share_capital), 'D26: the garbage entry was stored as 0').toBe(0);
        expect(Number(after.subscribed_capital), 'the untouched valid field must survive the save').toBe(400000);
        expect(await countRows(page, 'financial_period_settings'), 'an update must not create a second FY row')
            .toBe(rows.length);
        expect(dialogs, 'and nothing warns the operator that a signed statement input became zero').toHaveLength(0);
        expect(await uncaughtEntries(page)).toEqual([]);
    });
});
