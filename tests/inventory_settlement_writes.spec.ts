import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live write-path coverage for the two remaining inventory / agribusiness ledger surfaces:
 *   - `app/(admin)/accounting/inventory-journal.tsx`   (Stock Adjustment modal -> stock_movements + GL)
 *   - `app/(admin)/agribusiness/settlements.tsx`       (compute -> approve -> disburse -> GL)
 *
 * Every row is read back from WatermelonDB storage (`window.__WATERMELON_DB__`) and every peso /
 * kilo / balance figure is recomputed inside this spec instead of trusting
 * `InventoryJournalService` or `LandSettlementEngine` (goal requirement 4).
 *
 * Cross-module flows proven here:
 *   adjustment modal -> `stock_movements` -> `journal_entries`/`journal_entry_lines` (1210/4070/5100/3010),
 *   stock register -> the rendered 'Total Inventory Value (WAC)' card,
 *   harvest logs -> settlement math -> `agri_weekly_settlements` -> GL (5160 / 2035 / 1010),
 *   settlement status propagation draft -> approved -> paid with `receipt_reference` + `disbursement_date`.
 *
 * Characterised defects (each labelled test FAILS once the app is fixed):
 * - D16  `InventoryJournalService.ts:136` stores `input.movementType.replace('_increase','')
 *        .replace('_decrease','')`, so a stock gain and a stock loss are both persisted as the
 *        bare string 'adjustment'. Only `quantity_in`/`quantity_out` still tell them apart, and
 *        `getInventorySummary` (`:301`) filters on `['purchase','beginning']`, so the register's
 *        own type column can no longer distinguish them.
 * - D19  `getInventorySummary` (`InventoryJournalService.ts:296-321`) only accumulates
 *        `totalCost` for 'purchase'/'beginning' rows but accumulates `qtyIn` for every row, so an
 *        adjustment gain dilutes WAC and the rendered inventory value understates the 1210 ledger
 *        balance by exactly the gain's cost.
 * - D20  `recordMovement` (`:118-159`) never compares `quantityOut` against `getCurrentStock`, so
 *        a stock-out for an unknown/empty SKU persists a negative `quantity_balance` and still
 *        credits 1210 — inventory the ledger never held.
 * - D12-class orphan: `recordMovement` commits the movement row inside its own `db.write` (`:131-151`)
 *        and only then awaits `_postJournalEntry` (`:153`). When `journal_entries` rejects the codes
 *        (`JournalEntryService.ts:148-151`), the stock row survives with no GL counterpart and
 *        `inventory-journal.tsx:82` reports the reason through `Alert.alert` — a no-op in
 *        react-native-web 0.21.2 (D4), so the operator sees neither the failure nor a closed modal.
 * - D21  `_postJournalEntry` returns early when `totalCost <= 0.005` (`:175`), so a zero-cost
 *        receipt puts units into the stock register that never reach the balance sheet.
 * - D22  `LandSettlementEngine.approveSettlement` (`:201-224`) posts the settlement expense on
 *        EVERY call. Approving posts DR 5160 / CR 2035, then disbursing the same settlement calls
 *        it again with `markAsPaid=true` and posts DR 5160 / CR 1010 — the expense is counted
 *        twice and the 2035 payable is never released.
 * - D23  the same block swallows the posting failure into `console.warn` (`:221-223`), so a
 *        settlement can flip to 'approved'/'paid' with nothing in the ledger while the screen shows
 *        'Settlement Updated Successfully'.
 * - M5   `stock_movements.journal_entry_id` exists in the schema (`schema.ts:366`) and on the model
 *        (`StockMovement.ts:23`) but `recordMovement` never assigns it, so a movement cannot be
 *        traced to its journal entry. Logged as evidence, not asserted as a defect test.
 */

const INV_ROUTE = '/accounting/inventory-journal';
const INV_ANCHOR = 'Perpetual Stock Movement & WAC Cost Ledger';
const MODAL_TITLE = 'Record Stock Adjustment';

const SETT_ROUTE = '/agribusiness/settlements';
const SETT_ANCHOR = 'Land Owner Settlement Engine';
const BANNER = 'Settlement Updated Successfully';

const stamp = String(Date.now()).slice(-6);

/** 40 units at 187.50 = 7,500.00 — recomputed below, never trusted from the app. */
const OPEN_SKU = `E2E-SKU-OPEN-${stamp}`;
const OPEN_QTY = 40;
const UNIT_COST = 187.5;
const OPEN_TOTAL = OPEN_QTY * UNIT_COST;

const GAIN_SKU = OPEN_SKU;
const GAIN_QTY = 60;
const GAIN_TOTAL = GAIN_QTY * UNIT_COST;

const OVERSELL_SKU = `E2E-SKU-OVERS-${stamp}`;
const OVERSELL_QTY = 25;
const OVERSELL_COST = 90;
const OVERSELL_TOTAL = OVERSELL_QTY * OVERSELL_COST;

const FREE_SKU = `E2E-SKU-FREE-${stamp}`;
const FREE_QTY = 10;

const ORPHAN_SKU = `E2E-SKU-ORPH-${stamp}`;
const ORPHAN_QTY = 7;
const ORPHAN_COST = 500;

const NOTE = `E2E physical count ${stamp}`;
const BAD_QTY = 'abc';

/** InventoryJournalService posting map for moduleId 'agri-store'. */
const INV_CODE = '1210';
const GAIN_CODE = '4070';
const LOSS_CODE = '5100';
const OPENING_CODE = '3010';

/** AutoPostingService ACCT map for the weekly land-owner settlement. */
const SETTLE_EXPENSE_CODE = '5160';
const SETTLE_PAYABLE_CODE = '2035';
const CASH_CODE = '1010';

const RATE_PER_KG = 1.5;
const GUARANTEED_MIN = 25000;
const HARVEST_KILOS = [1000, 2500.5, 400];

const CYCLE_CODE = `E2E-CYC-${stamp}`;
const OWNER_NAME = `E2E Land Owner ${stamp}`;
const PARCEL_NAME = `E2E Parcel ${stamp}`;

async function readAll(page: Page, table: string): Promise<Record<string, any>[]> {
    return page.evaluate(async (name: string) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return [];
        const records = await db.collections.get(name).query().fetch();
        return records.map((r: any) => {
            const raw = r._raw ?? {};
            const out: Record<string, any> = { id: r.id };
            for (const key of Object.keys(raw)) {
                out[key] = raw[key] instanceof Date ? (raw[key] as Date).getTime() : raw[key];
            }
            return out;
        });
    }, table);
}

async function countRows(page: Page, table: string): Promise<number> {
    return (await readAll(page, table)).length;
}

function money(value: any): number {
    return Number(value ?? 0);
}

function round2(value: number): number {
    return Number(value.toFixed(2));
}

async function seedPostableAccounts(page: Page, specs: string[]): Promise<number> {
    return page.evaluate(async (rows: string[]) => {
        const db = (window as any).__WATERMELON_DB__;
        const collection = db.collections.get('chart_of_accounts');
        const have = new Set((await collection.query().fetch()).map((r: any) => r._raw.code));
        let inserted = 0;
        await db.write(async () => {
            for (const spec of rows) {
                const [code, name, accountType, normalBalance] = spec.split('|');
                if (have.has(code)) continue;
                await collection.create((record: any) => {
                    record._raw.id = `e2e-inv-coa-${code}`;
                    record.code = code;
                    record.name = name;
                    record.accountType = accountType;
                    record.normalBalance = normalBalance;
                    record.isActive = true;
                    record.isHeader = false;
                    record.sortOrder = 9000;
                    // createdAt is @readonly, so the timestamps go in through the raw row.
                    record._raw.created_at = Date.now();
                    record._raw.updated_at = Date.now();
                });
                inserted += 1;
            }
        });
        return inserted;
    }, specs);
}

/** The full inventory posting map: 1210 plus every counterpart the modal can hit. */
function inventoryAccounts(): string[] {
    return [
        `${INV_CODE}|Merchandise Inventory E2E|asset|debit`,
        `${GAIN_CODE}|Miscellaneous Income E2E|income|credit`,
        `${LOSS_CODE}|Other Operating Expenses E2E|expense|debit`,
        `${OPENING_CODE}|Share Capital E2E|equity|credit`,
    ];
}

function settlementAccounts(): string[] {
    return [
        `${SETTLE_EXPENSE_CODE}|Land Owner Settlement E2E|expense|debit`,
        `${SETTLE_PAYABLE_CODE}|Land Owner Payable E2E|liability|credit`,
        `${CASH_CODE}|Cash on Hand E2E|asset|debit`,
    ];
}

/**
 * Seed a whole settlement chain (owner -> parcel -> cycle -> harvest logs) straight into storage so
 * the compute test exercises the engine's math rather than four other screens. FIXTURE ONLY.
 */
async function seedSettlementChain(page: Page): Promise<string> {
    return page.evaluate(async (fixture: any) => {
        const db = (window as any).__WATERMELON_DB__;
        const ownerId = `e2e-lo-${fixture.stamp}`;
        const parcelId = `e2e-pa-${fixture.stamp}`;
        const cycleId = `e2e-cy-${fixture.stamp}`;
        const now = Date.now();
        const day = 24 * 60 * 60 * 1000;

        await db.write(async () => {
            await db.collections.get('agri_land_owners').create((r: any) => {
                r._raw.id = ownerId;
                r.name = fixture.ownerName;
                r.defaultPerKiloRate = 1.0;
                r.defaultGuaranteedMinimum = 1000;
                r._raw.created_at = now;
                r._raw.updated_at = now;
            });
            await db.collections.get('agri_parcels').create((r: any) => {
                r._raw.id = parcelId;
                r.name = fixture.parcelName;
                r.landOwnerId = ownerId;
                r.areaHectares = 1.25;
                r.boundaryRevision = 1;
                r.layoutRevision = 1;
                r.status = 'harvesting';
                r._raw.created_at = now;
                r._raw.updated_at = now;
            });
            await db.collections.get('agri_crop_cycles').create((r: any) => {
                r._raw.id = cycleId;
                r.cycleCode = fixture.cycleCode;
                r.parcelId = parcelId;
                r.cropType = 'banana';
                r.variety = 'lakatan';
                r.plantingDate = new Date(now - 200 * day);
                r.areaPlantedHa = 1.25;
                r.status = 'harvesting';
                r.expectedYieldKg = 20000;
                r.totalActualYieldKg = 0;
                r.capitalAllocated = 0;
                r.landOwnerRatePerKg = fixture.rate;
                r.landOwnerGuaranteedMin = fixture.min;
                r.offtakePricePerKg = 12;
                r._raw.created_at = now;
                r._raw.updated_at = now;
            });
            for (let i = 0; i < fixture.kilos.length; i++) {
                const net = fixture.kilos[i];
                await db.collections.get('agri_harvest_logs').create((r: any) => {
                    r._raw.id = `e2e-hl-${fixture.stamp}-${i}`;
                    r.cropCycleId = cycleId;
                    r.parcelId = parcelId;
                    r.harvestDate = new Date(now - (i + 2) * day);
                    r.batchNumber = `B-${fixture.stamp}-${i}`;
                    r.grossWeightKg = net + 50;
                    r.tareWeightKg = 50;
                    r.netWeightKg = net;
                    r.qualityGrade = 'grade-a';
                    r._raw.created_at = now;
                    r._raw.updated_at = now;
                });
            }
        });
        return cycleId;
    }, {
        stamp,
        ownerName: OWNER_NAME,
        parcelName: PARCEL_NAME,
        cycleCode: CYCLE_CODE,
        rate: RATE_PER_KG,
        min: GUARANTEED_MIN,
        kilos: HARVEST_KILOS,
    });
}

/** Independent recompute of LandSettlementEngine.calculateSettlement (engine source lines 52-82). */
function expectedSettlement(cumulativeKilos: number, previousCumulativePayout: number) {
    const rawKiloEarnings = round2(cumulativeKilos * RATE_PER_KG);
    const targetCumulativePayout = round2(Math.max(rawKiloEarnings, GUARANTEED_MIN));
    const netPayoutDueThisWeek = round2(Math.max(0, targetCumulativePayout - previousCumulativePayout));
    return { rawKiloEarnings, targetCumulativePayout, netPayoutDueThisWeek };
}

/** RNW Pressable: the handler lives on the container div, so click the container, not the label. */
function pressable(page: Page, label: string | RegExp): Locator {
    return page
        .locator('div[tabindex], div[class*="cursor-pointer"], div[class*="select-none"], div[class*="active:bg"]')
        .filter({ hasText: label })
        .last();
}

/** The three adjustment chips are `px-3 py-2 rounded-xl mr-2 border` Pressables inside the modal. */
function chipInModal(page: Page, label: string): Locator {
    return page.locator('div[class*="rounded-xl"][class*="border"]').filter({ hasText: label }).last();
}

async function openAdjustModal(page: Page) {
    await safeNavigate(page, INV_ROUTE, INV_ANCHOR);
    await pressable(page, 'Stock Adjustment').click();
    await expect(page.getByText(MODAL_TITLE, { exact: true })).toBeVisible({ timeout: 30000 });
}

async function fillAdjustment(page: Page, opts: {
    sku: string; chip: string; qty: string | number; cost: string | number; notes?: string;
}) {
    await page.locator(`input[placeholder="e.g. FERT-UREA-50KG"]`).fill(opts.sku);
    const chip = chipInModal(page, opts.chip);
    await chip.click();
    await expect
        .poll(async () => (await chip.getAttribute('class')) || '', `the "${opts.chip}" chip must select`)
        .toContain('bg-teal-900');
    await page.locator('input[placeholder="0"]').fill(String(opts.qty));
    await page.locator('input[placeholder="0.00"]').fill(String(opts.cost));
    if (opts.notes !== undefined) {
        await page.locator('input[placeholder="e.g. Physical inventory count discrepancy"]').fill(opts.notes);
    }
}

async function postAdjustment(page: Page, expectClose = true) {
    await pressable(page, 'Post Stock Entry').click();
    await page.waitForTimeout(2500);
    if (expectClose) {
        await expect(page.getByText(MODAL_TITLE, { exact: true }))
            .toHaveCount(0, { timeout: 30000 });
    }
}

async function movementBySku(page: Page, sku: string) {
    const rows = (await readAll(page, 'stock_movements')).filter(r => r.product_id === sku);
    expect(rows.length, `exactly one ${sku} movement must persist`).toBe(1);
    return rows[0];
}

/** Journal entry auto-posted for a given source row. */
async function entryForSource(page: Page, sourceTable: string, sourceId: string) {
    const entries = await readAll(page, 'journal_entries');
    const lines = await readAll(page, 'journal_entry_lines');
    const entry = entries.find(e => e.source_table === sourceTable && e.source_id === sourceId);
    if (!entry) return null;
    return { entry, lines: lines.filter(l => l.journal_entry_id === entry.id) };
}

function sumBy(lines: Record<string, any>[], code: string, side: 'debit' | 'credit'): number {
    const key = side === 'debit' ? 'debit_amount' : 'credit_amount';
    return round2(lines.filter(l => l.account_code === code).reduce((s, l) => s + money(l[key]), 0));
}

/** The two value cards render inside `text-2xl` divs; the register header is `text-xl`. */
async function renderedInventoryCards(page: Page): Promise<{ value: number | null; skus: number | null }> {
    const texts: string[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('div[class*="text-2xl"]'))
            .map(n => (n.textContent || '').replace(/\u00a0/g, ' ')),
    );
    let value: number | null = null;
    let skus: number | null = null;
    for (const t of texts) {
        const peso = /(-)?PHP\s*([\d,]+\.\d{2})/.exec(t);
        if (peso) { value = Number(`${peso[1] || ''}${peso[2].replace(/,/g, '')}`); continue; }
        const count = /^(\d+)\s*products$/i.exec(t.trim());
        if (count) skus = Number(count[1]);
    }
    return { value, skus };
}

async function uncaughtEntries(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__E2E_UNCAUGHT__ || []);
}

/**
 * The harness serves a production export, so an uncaught throw renders no dev overlay.
 * Hook the error events before boot so "validated, did not crash" is evidenced (requirements 3 + 5).
 */
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

async function redBoxVisible(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const text = document.body?.innerText || '';
        return /Uncaught Error|Application Error|something went wrong/i.test(text);
    });
}

test.describe('Inventory journal adjustment writes (stock_movements -> GL)', () => {
    test('an opening balance persists the movement and posts DR 1210 / CR 3010 for the recomputed cost', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        expect(await seedPostableAccounts(page, inventoryAccounts()), 'the inventory posting map must be active')
            .toBeGreaterThan(0);

        await openAdjustModal(page);
        await fillAdjustment(page, { sku: OPEN_SKU, chip: 'Opening Balance', qty: OPEN_QTY, cost: UNIT_COST, notes: NOTE });
        await postAdjustment(page);

        const row = await movementBySku(page, OPEN_SKU);
        expect(row.module_id, 'the screen hard-codes the agri-store module').toBe('agri-store');
        expect(row.product_source).toBe('agri_store_products');
        expect(row.movement_type, 'opening keeps its own type (D16 only collapses adjustments)')
            .toBe('beginning');
        expect(money(row.quantity_in)).toBe(OPEN_QTY);
        expect(row.quantity_out, 'an opening balance must not record a stock-out').toBeNull();
        expect(money(row.quantity_balance), '0 + 40 - 0 recomputed').toBe(OPEN_QTY);
        expect(money(row.unit_cost)).toBe(UNIT_COST);
        expect(money(row.total_cost), 'independent recompute 40 x 187.50').toBe(OPEN_TOTAL);
        expect(row.notes).toBe(NOTE);
        expect(row.performed_by).toBe('Admin');

        const posted = await entryForSource(page, 'stock_movements', row.id);
        expect(posted, 'the movement must have a journal counterpart').not.toBeNull();
        expect(posted!.entry.entry_type, 'beginning is posted as an adjusting entry').toBe('adjusting');
        expect(posted!.lines, 'a balanced entry needs exactly a debit and a credit line').toHaveLength(2);
        expect(sumBy(posted!.lines, INV_CODE, 'debit'), 'DR Merchandise Inventory').toBe(OPEN_TOTAL);
        expect(sumBy(posted!.lines, OPENING_CODE, 'credit'), 'CR Share Capital').toBe(OPEN_TOTAL);
        expect(money(posted!.entry.total_debit), 'stored total_debit equals the recomputed cost').toBe(OPEN_TOTAL);
        expect(money(posted!.entry.total_credit), 'stored total_credit equals the recomputed cost').toBe(OPEN_TOTAL);

        expect(row.journal_entry_id ?? null, 'M5: the movement stores no link to its journal entry').toBeNull();
        expect(await uncaughtEntries(page), 'no uncaught error from the adjustment write').toEqual([]);
        expect(await redBoxVisible(page), 'the app must not crash').toBe(false);
    });

    test('the rendered register totals agree with the movements read back from storage', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await seedPostableAccounts(page, inventoryAccounts());

        await openAdjustModal(page);
        await fillAdjustment(page, { sku: OPEN_SKU, chip: 'Opening Balance', qty: OPEN_QTY, cost: UNIT_COST });
        await postAdjustment(page);

        const rows = await readAll(page, 'stock_movements');
        const qtyIn = rows.reduce((s, r) => s + money(r.quantity_in), 0);
        const cost = rows.filter(r => ['purchase', 'beginning'].includes(r.movement_type))
            .reduce((s, r) => s + money(r.total_cost), 0);
        const wac = qtyIn > 0 ? cost / qtyIn : 0;
        const expectedValue = round2(qtyIn * wac);

        const cards = await renderedInventoryCards(page);
        expect(cards.skus, 'one tracked SKU after one movement').toBe(1);
        expect(cards.value, 'the WAC card must equal the independent recompute').toBe(expectedValue);
        expect(expectedValue, 'sanity: 40 units at 187.50').toBe(OPEN_TOTAL);

        const register = await page.getByText(OPEN_SKU, { exact: true }).count();
        expect(register, 'the movement must render in the register, not only persist').toBeGreaterThan(0);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('CHARACTERIZES D16 + D19 (fail once fixed): a stock gain is stored as bare "adjustment" and its cost never reaches the WAC card', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await seedPostableAccounts(page, inventoryAccounts());

        await openAdjustModal(page);
        await fillAdjustment(page, { sku: OPEN_SKU, chip: 'Opening Balance', qty: OPEN_QTY, cost: UNIT_COST });
        await postAdjustment(page);

        await openAdjustModal(page);
        await fillAdjustment(page, { sku: GAIN_SKU, chip: '+ Stock In (Gain)', qty: GAIN_QTY, cost: UNIT_COST, notes: NOTE });
        await postAdjustment(page);

        const movements = await readAll(page, 'stock_movements');
        const gain = movements.filter(r => r.product_id === GAIN_SKU && money(r.quantity_in) === GAIN_QTY);
        expect(gain, 'the gain movement must persist').toHaveLength(1);
        const gainRow = gain[0];
        expect(money(gainRow.quantity_balance), '40 + 60 stock recomputed').toBe(OPEN_QTY + GAIN_QTY);
        expect(money(gainRow.total_cost), 'independent recompute 60 x 187.50').toBe(GAIN_TOTAL);

        // D16: the type column cannot tell a gain from a loss.
        expect(gainRow.movement_type, 'D16: a gain is stored as the bare string "adjustment"').toBe('adjustment');

        const opening = movements.filter(r => r.product_id === OPEN_SKU && r.movement_type === 'beginning');
        expect(opening, 'the opening row must still be identifiable').toHaveLength(1);
        expect(opening[0].quantity_balance, 'the opening balance row is untouched').toBe(OPEN_QTY);

        const gainEntry = await entryForSource(page, 'stock_movements', gainRow.id);
        expect(gainEntry, 'the gain must post a journal entry').not.toBeNull();
        expect(sumBy(gainEntry!.lines, INV_CODE, 'debit'), 'D19 evidence: DR 1210 for the gain').toBe(GAIN_TOTAL);
        expect(sumBy(gainEntry!.lines, GAIN_CODE, 'credit'), 'CR Miscellaneous Income').toBe(GAIN_TOTAL);

        // Independent GL balance for 1210 across BOTH entries.
        const lines = await readAll(page, 'journal_entry_lines');
        const glInventory = round2(lines.filter(l => l.account_code === INV_CODE)
            .reduce((s, l) => s + money(l.debit_amount) - money(l.credit_amount), 0));
        expect(glInventory, 'the ledger carries 7,500 + 11,250 of inventory').toBe(OPEN_TOTAL + GAIN_TOTAL);

        const cards = await renderedInventoryCards(page);
        // getInventorySummary accumulates qtyIn from EVERY movement but totalCost only from
        // ['purchase','beginning'], so WAC = 7500 / 100 and the card value collapses back to 7500.
        const totalQtyIn = OPEN_QTY + GAIN_QTY;
        const expectedCard = round2(totalQtyIn * (OPEN_TOTAL / totalQtyIn));
        expect(cards.value, 'D19: the card dilutes WAC because adjustment cost is ignored')
            .toBe(expectedCard);
        expect(glInventory - cards.value!, 'D19: the register understates inventory by the gain cost')
            .toBe(GAIN_TOTAL);
        console.log(
            `[D16/D19] movement_type="${gainRow.movement_type}" stored for a +${GAIN_QTY} gain; ` +
            `GL 1210 = ${glInventory}, rendered WAC card = ${cards.value}, divergence = ${glInventory - cards.value!}`,
        );
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('CHARACTERIZES D20 (fails once fixed): a stock-out with nothing on hand persists a negative balance and still credits inventory', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await seedPostableAccounts(page, inventoryAccounts());

        await openAdjustModal(page);
        await fillAdjustment(page, { sku: OVERSELL_SKU, chip: '- Stock Out (Loss)', qty: OVERSELL_QTY, cost: OVERSELL_COST, notes: NOTE });
        await postAdjustment(page);

        const row = await movementBySku(page, OVERSELL_SKU);
        expect(row.movement_type, 'D16: the loss is stored as the same bare "adjustment"').toBe('adjustment');
        expect(money(row.quantity_out)).toBe(OVERSELL_QTY);
        expect(row.quantity_in, 'a loss records no stock-in').toBeNull();
        expect(money(row.total_cost), 'independent recompute 25 x 90').toBe(OVERSELL_TOTAL);
        expect(row.quantity_balance, 'D20: 0 on hand minus 25 persists as -25').toBe(-OVERSELL_QTY);

        const posted = await entryForSource(page, 'stock_movements', row.id);
        expect(posted, 'the write-down still posts').not.toBeNull();
        expect(sumBy(posted!.lines, LOSS_CODE, 'debit'), 'DR Other Operating Expenses').toBe(OVERSELL_TOTAL);
        expect(sumBy(posted!.lines, INV_CODE, 'credit'), 'D20: CR 1210 against stock that never existed')
            .toBe(OVERSELL_TOTAL);
        console.log(`[D20] -${OVERSELL_QTY} balance persisted for an empty SKU and ${OVERSELL_TOTAL} credited out of 1210`);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('an invalid quantity writes nothing and does not crash (CHARACTERIZES D4: fails once the refusal is visible)', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await seedPostableAccounts(page, inventoryAccounts());

        await openAdjustModal(page);
        const before = await countRows(page, 'stock_movements');
        const jeBefore = await countRows(page, 'journal_entries');

        await fillAdjustment(page, { sku: FREE_SKU, chip: 'Opening Balance', qty: BAD_QTY, cost: UNIT_COST });
        await postAdjustment(page, false);

        expect(await countRows(page, 'stock_movements'), 'parseFloat("abc") is NaN so nothing may persist')
            .toBe(before);
        expect(await countRows(page, 'journal_entries'), 'and nothing may reach the ledger').toBe(jeBefore);

        // D4: the refusal message goes through Alert.alert, a no-op in react-native-web.
        const shown = await page.getByText('Please enter a valid quantity.').count();
        console.log(`[D4] inventory quantity validation message rendered on web: ${shown === 1 ? 'yes' : 'NO (Alert.alert is a no-op)'}`);
        expect(shown, 'D4: the operator is never told why the write was refused on web').toBe(0);
        await expect(page.getByText(MODAL_TITLE, { exact: true }), 'the modal must stay open for correction')
            .toBeVisible();
        expect(await uncaughtEntries(page), 'invalid input must not crash the app').toEqual([]);

        // Empty SKU is refused the same way.
        await fillAdjustment(page, { sku: '', chip: 'Opening Balance', qty: 5, cost: 10 });
        await postAdjustment(page, false);
        expect(await countRows(page, 'stock_movements'), 'a blank SKU must not create a movement')
            .toBe(before);
    });

    test('CHARACTERIZES D21 (fails once fixed): a zero-cost receipt puts units in the register with nothing in the ledger', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await seedPostableAccounts(page, inventoryAccounts());

        const jeBefore = await countRows(page, 'journal_entries');
        await openAdjustModal(page);
        await fillAdjustment(page, { sku: FREE_SKU, chip: 'Opening Balance', qty: FREE_QTY, cost: 0 });
        await postAdjustment(page);

        const row = await movementBySku(page, FREE_SKU);
        expect(money(row.quantity_in)).toBe(FREE_QTY);
        expect(money(row.quantity_balance)).toBe(FREE_QTY);
        expect(row.total_cost, 'totalCost 0 is stored as null by `|| null`').toBeNull();

        expect(await countRows(page, 'journal_entries'), 'D21: _postJournalEntry returns early below 0.005')
            .toBe(jeBefore);
        expect(await entryForSource(page, 'stock_movements', row.id), 'D21: no GL counterpart at all')
            .toBeNull();

        const cards = await renderedInventoryCards(page);
        expect(cards.skus, 'the free stock IS a tracked SKU').toBe(1);
        expect(cards.value, 'but its balance-sheet value is zero').toBe(0);
        console.log(`[D21] ${FREE_QTY} units persisted with ${0} ledger value and 0 journal entries`);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('degraded: an unposted account code leaves an orphan movement and the failure is invisible on web', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        // Deliberately seed NOTHING: JournalEntryService must reject every posting account.
        const before = await countRows(page, 'stock_movements');
        const jeBefore = await countRows(page, 'journal_entries');

        await openAdjustModal(page);
        await fillAdjustment(page, { sku: ORPHAN_SKU, chip: '+ Stock In (Gain)', qty: ORPHAN_QTY, cost: ORPHAN_COST, notes: NOTE });
        await postAdjustment(page, false);

        const rows = await readAll(page, 'stock_movements');
        const orphans = rows.filter(r => r.product_id === ORPHAN_SKU);
        expect(orphans, 'the movement row commits BEFORE the journal post, so it survives the failure')
            .toHaveLength(1);
        expect(rows.length, 'one new stock row').toBe(before + 1);
        expect(await countRows(page, 'journal_entries'), 'and the ledger got nothing').toBe(jeBefore);

        // The screen reports the throw only through Alert.alert (D4), so the modal stays open and
        // the operator has no signal that a half-committed write happened.
        await expect(page.getByText(MODAL_TITLE, { exact: true })).toBeVisible();
        expect(await redBoxVisible(page), 'the throw is caught, so no error boundary renders').toBe(false);
        expect(await uncaughtEntries(page), 'the rejection is swallowed rather than surfacing').toEqual([]);
        console.log(
            `[D12-class] orphan movement ${orphans[0].id} (${ORPHAN_QTY} x ${ORPHAN_COST}) persisted with ` +
            `${await countRows(page, 'journal_entries')} journal entries`,
        );
    });
});

test.describe('Land owner settlement writes (compute -> approve -> disburse -> GL)', () => {
    test('compute persists a draft settlement whose numbers equal the independent recompute', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        const cycleId = await seedSettlementChain(page);

        await safeNavigate(page, SETT_ROUTE, SETT_ANCHOR);
        const chip = page.locator('div[class*="rounded-xl"][class*="border"]').filter({ hasText: CYCLE_CODE }).last();
        await expect(chip, 'the seeded cycle must be selectable').toBeVisible({ timeout: 30000 });
        await chip.click();
        await expect
            .poll(async () => (await chip.getAttribute('class')) || '', 'the cycle chip must select')
            .toContain('bg-emerald-800');

        await page.locator('input[placeholder="1"]').fill('3');
        await pressable(page, /Calculate Week 3 Settlement/).click();
        await expect(page.getByText(BANNER), 'the screen must render its confirmation banner')
            .toBeVisible({ timeout: 30000 });

        const cumulative = HARVEST_KILOS.reduce((a, b) => a + b, 0);
        const expected = expectedSettlement(cumulative, 0);

        const rows = await readAll(page, 'agri_weekly_settlements');
        const mine = rows.filter(r => r.crop_cycle_id === cycleId);
        expect(mine, 'one draft settlement must persist').toHaveLength(1);
        const week3 = mine[0];
        expect(week3.week_number).toBe(3);
        expect(week3.payment_status).toBe('draft');
        expect(money(week3.cumulative_kilos), '1000 + 2500.5 + 400 recomputed').toBe(cumulative);
        expect(money(week3.rate_per_kilo)).toBe(RATE_PER_KG);
        expect(money(week3.raw_kilo_earnings), '3900.5 x 1.50').toBe(expected.rawKiloEarnings);
        expect(money(week3.guaranteed_minimum)).toBe(GUARANTEED_MIN);
        expect(money(week3.target_cumulative_payout), 'max(5850.75, 25000)').toBe(expected.targetCumulativePayout);
        expect(money(week3.previous_cumulative_payout)).toBe(0);
        expect(money(week3.net_payout_due_this_week)).toBe(expected.netPayoutDueThisWeek);
        expect(week3.deleted_at, 'a live row').toBeNull();

        // Draft rows still count as "previously paid" for the next week, so week 4 owes nothing.
        await page.locator('input[placeholder="1"]').fill('4');
        await pressable(page, /Calculate Week 4 Settlement/).click();
        await expect(page.getByText(BANNER)).toBeVisible({ timeout: 30000 });

        const after = (await readAll(page, 'agri_weekly_settlements')).filter(r => r.crop_cycle_id === cycleId);
        expect(after, 'week 4 must persist as well').toHaveLength(2);
        const week4 = after.find(r => r.week_number === 4)!;
        expect(money(week4.previous_cumulative_payout), 'the week-3 draft is treated as already paid')
            .toBe(expected.targetCumulativePayout);
        expect(money(week4.net_payout_due_this_week), '25000 target minus 25000 previous = 0').toBe(0);

        // The guarantee is rendered in the register, not only stored.
        await expect(page.getByText(/Week 4 Settlement/).first()).toBeVisible({ timeout: 30000 });
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('an invalid week number is refused with no settlement written and no crash', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await seedSettlementChain(page);
        await safeNavigate(page, SETT_ROUTE, SETT_ANCHOR);

        const before = await countRows(page, 'agri_weekly_settlements');
        await page.locator('input[placeholder="1"]').fill('abc');
        await pressable(page, /Calculate Week abc Settlement/).click();
        await page.waitForTimeout(2000);

        expect(await countRows(page, 'agri_weekly_settlements'), 'parseInt("abc") is NaN so nothing persists')
            .toBe(before);
        const shown = await page.getByText('Please enter a valid week number.').count();
        expect(shown, 'D4: the refusal is Alert.alert only, invisible on web').toBe(0);
        expect(await uncaughtEntries(page), 'invalid input must not crash the app').toEqual([]);
    });

    test('approve propagates draft -> approved and posts DR 5160 / CR 2035 for the recomputed payout', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        expect(await seedPostableAccounts(page, settlementAccounts()), 'settlement accounts must be active')
            .toBeGreaterThan(0);
        const cycleId = await seedSettlementChain(page);

        await safeNavigate(page, SETT_ROUTE, SETT_ANCHOR);
        await page.locator('input[placeholder="1"]').fill('3');
        await pressable(page, /Calculate Week 3 Settlement/).click();
        await expect(page.getByText(BANNER)).toBeVisible({ timeout: 30000 });

        const cumulative = HARVEST_KILOS.reduce((a, b) => a + b, 0);
        const expected = expectedSettlement(cumulative, 0);

        const week3 = (await readAll(page, 'agri_weekly_settlements')).find(r => r.crop_cycle_id === cycleId)!;
        await pressable(page, 'Approve').click();
        await expect
            .poll(async () => {
                const rows = await readAll(page, 'agri_weekly_settlements');
                return rows.find(r => r.id === week3.id)?.payment_status;
            }, 'status must propagate to approved').toBe('approved');

        const posted = await entryForSource(page, 'agri_weekly_settlements', week3.id);
        expect(posted, 'approval must auto-post a payable entry').not.toBeNull();
        expect(sumBy(posted!.lines, SETTLE_EXPENSE_CODE, 'debit'), 'DR settlement expense').toBe(expected.netPayoutDueThisWeek);
        expect(sumBy(posted!.lines, SETTLE_PAYABLE_CODE, 'credit'), 'CR land owner payable').toBe(expected.netPayoutDueThisWeek);
        expect(money(posted!.entry.total_debit), 'entry totals agree').toBe(expected.netPayoutDueThisWeek);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('disbursing an approved settlement debits payable and credits cash without doubling expense (fixes D22)', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await seedPostableAccounts(page, settlementAccounts());
        const cycleId = await seedSettlementChain(page);

        await safeNavigate(page, SETT_ROUTE, SETT_ANCHOR);
        await page.locator('input[placeholder="1"]').fill('3');
        await pressable(page, /Calculate Week 3 Settlement/).click();
        await expect(page.getByText(BANNER)).toBeVisible({ timeout: 30000 });

        const cumulative = HARVEST_KILOS.reduce((a, b) => a + b, 0);
        const expected = expectedSettlement(cumulative, 0);
        const net = expected.netPayoutDueThisWeek;

        const week3 = (await readAll(page, 'agri_weekly_settlements')).find(r => r.crop_cycle_id === cycleId)!;
        await pressable(page, 'Approve').click();
        await expect
            .poll(async () => (await readAll(page, 'agri_weekly_settlements')).find(r => r.id === week3.id)?.payment_status,
                'approve first').toBe('approved');

        const receipt = `E2E-CHK-${stamp}`;
        await pressable(page, /Disburse Pay/).click();
        await expect(page.getByText('Disburse Land Owner Payout', { exact: true })).toBeVisible({ timeout: 30000 });
        await page.locator('input[placeholder="e.g. CHK-123456"]').fill(receipt);
        await pressable(page, /Confirm Payout/).click();
        await expect
            .poll(async () => (await readAll(page, 'agri_weekly_settlements')).find(r => r.id === week3.id)?.payment_status,
                'disburse must reach paid').toBe('paid');

        const paid = (await readAll(page, 'agri_weekly_settlements')).find(r => r.id === week3.id)!;
        expect(paid.receipt_reference, 'the receipt number must persist').toBe(receipt);
        expect(paid.disbursement_date, 'the disbursement date must persist').not.toBeNull();

        const entries = (await readAll(page, 'journal_entries'))
            .filter(e => e.source_table === 'agri_weekly_settlements' && e.source_id === week3.id);
        expect(entries, 'approve + disburse produce two entries for one settlement').toHaveLength(2);

        const lines = await readAll(page, 'journal_entry_lines');
        const expenseDebit = round2(entries
            .flatMap(e => lines.filter(l => l.journal_entry_id === e.id))
            .filter(l => l.account_code === SETTLE_EXPENSE_CODE)
            .reduce((s, l) => s + money(l.debit_amount), 0));
        expect(expenseDebit, '5160 expense is debited once for net payout').toBe(net);
        expect(sumBy(lines.filter(l => entries.some(e => e.id === l.journal_entry_id)), SETTLE_PAYABLE_CODE, 'debit'),
            '2035 payable is cleared on disbursement').toBe(net);
        expect(await uncaughtEntries(page)).toEqual([]);
    });

    test('degraded: settlement status flips to approved even when the ledger rejects the posting (D23)', async ({ page }) => {
        await installErrorCollector(page);
        const warnings: string[] = [];
        page.on('console', msg => { if (msg.type() === 'warning' || msg.type() === 'error') warnings.push(msg.text()); });
        await loginAsAdmin(page);
        // No COA seeded at all: AutoPostingService must fail, and the engine only console.warns it.
        const cycleId = await seedSettlementChain(page);

        await safeNavigate(page, SETT_ROUTE, SETT_ANCHOR);
        await page.locator('input[placeholder="1"]').fill('3');
        await pressable(page, /Calculate Week 3 Settlement/).click();
        await expect(page.getByText(BANNER)).toBeVisible({ timeout: 30000 });

        const jeBefore = await countRows(page, 'journal_entries');
        const week3 = (await readAll(page, 'agri_weekly_settlements')).find(r => r.crop_cycle_id === cycleId)!;
        await pressable(page, 'Approve').click();
        await expect
            .poll(async () => (await readAll(page, 'agri_weekly_settlements')).find(r => r.id === week3.id)?.payment_status,
                'D23: the status change commits regardless of the ledger').toBe('approved');

        expect(await countRows(page, 'journal_entries'), 'D23: nothing reached the ledger').toBe(jeBefore);
        await expect(page.getByText(BANNER), 'D23: and the screen still claims success').toBeVisible();

        const swallow = warnings.filter(w => /Auto-post settlement warning/i.test(w));
        console.log(
            `[D23] approved with ${await countRows(page, 'journal_entries')} journal entries; console evidence: ` +
            (swallow.length ? swallow[0].slice(0, 90) : 'none surfaced (console stripped in the production export)'),
        );
        expect(await redBoxVisible(page), 'the failed posting must not crash the app').toBe(false);
    });

    test('delete is unreachable on web because its confirmation is a multi-button Alert', async ({ page }) => {
        await installErrorCollector(page);
        let dialogs = 0;
        page.on('dialog', async dialog => { dialogs += 1; await dialog.dismiss().catch(() => {}); });
        await loginAsAdmin(page);
        const cycleId = await seedSettlementChain(page);

        await safeNavigate(page, SETT_ROUTE, SETT_ANCHOR);
        await page.locator('input[placeholder="1"]').fill('3');
        await pressable(page, /Calculate Week 3 Settlement/).click();
        await expect(page.getByText(BANNER)).toBeVisible({ timeout: 30000 });

        const week3 = (await readAll(page, 'agri_weekly_settlements')).find(r => r.crop_cycle_id === cycleId)!;
        // Scope to the card's destructive chip so the sidebar's "Deleted Items" entry can never match.
        const deleteChip = page.locator('div[class*="active:bg-red-100"]').filter({ hasText: 'Delete' }).last();
        await expect(deleteChip, 'the Delete control must be rendered').toBeVisible({ timeout: 30000 });
        await deleteChip.click();
        await page.waitForTimeout(2000);

        const rows = (await readAll(page, 'agri_weekly_settlements')).filter(r => r.id === week3.id);
        expect(rows, 'D4: with no confirm button reachable, nothing is soft-deleted').toHaveLength(1);
        expect(rows[0].deleted_at, 'the row stays live').toBeNull();
        expect(dialogs, 'no browser dialog substitutes for Alert.alert').toBe(0);
        console.log('[D4] settlement Delete confirmation is unreachable on web; the row could not be removed');
        expect(await uncaughtEntries(page), 'a dead control must not crash the app').toEqual([]);
    });
});
