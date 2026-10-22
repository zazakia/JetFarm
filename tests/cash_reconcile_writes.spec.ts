import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live write-path + cross-module coverage for the two reconciliation screens that
 * had no automated spec before this file:
 *   `app/(admin)/cash-on-hand/reconcile-petty-cash.tsx`  (petty cash box)
 *   `app/(admin)/cash-on-hand/reconcile.tsx`             (main cash box / vault)
 *
 * Both write a `cash_transactions` adjustment derived from a physical count and
 * both read their "book" figure from `CashService` - the petty screen from
 * `getPettyCashBalance()` (`src/services/CashService.ts:63-96`) and the vault
 * screen from `getCurrentBalance()` (`:137-152`), which additionally subtracts the
 * whole `expenses` table (`:118-133`). That makes this the last unproven
 * cross-module calculation in the Financials & Vault group: an agri farm expense
 * recorded on `expenses` is silently part of the balance the operator counts
 * against, while the petty box ignores it.
 *
 * Step 3 (persistence): every assertion re-reads WatermelonDB storage through
 * `window.__WATERMELON_DB__`; the rendered list is never trusted.
 *
 * Step 4 (independent math): the expected book balance, discrepancy, adjustment
 * amount and post-reconcile balance are recomputed in this file from the raw rows,
 * replicating the service rules (petty: `starting_balance + in - out`; vault:
 * `starting_balance + in - expenses - out` with the first-starting-balance date
 * cutoff). The rendered "Book Balance" figure is compared against that independent
 * number, so a disagreement in either direction fails.
 *
 * Defect evidence (report:
 * `tmp/systematic-test-matrix/agri-e2e-verification-2026-10-21.md`):
 * - D13 (tests 2/3/5 log it, test 7 pins it): neither screen posts a journal entry
 *   for the shortage or overage it writes, while the ordinary petty-cash movement
 *   screen does (`app/(admin)/cash-on-hand/new-petty-cash.tsx:60` ->
 *   `AutoPostingService.postCashTransaction`). A recount therefore rewrites the
 *   cash the app believes it holds with no double-entry counterpart, and
 *   `src/services/CoopFinancialReportService.ts:233` reports Cash on Hand as
 *   GL 1010 + 1011 - which never sees the adjustment.
 * - D15 (test 8): the coins field keeps every dot, then `parseFloat` silently
 *   truncates a malformed decimal ('1.2.3' -> 1.2), so a mistyped coin total
 *   becomes a wrong physical count with no warning
 *   (`reconcile-petty-cash.tsx:62-63`, `:73-76`).
 * - Test 9 is the goal's degraded case for this module: the local persistence
 *   layer is forced to fail. These two screens are among the seven that route
 *   failures through `src/utils/errorAlerts.ts`, so the operator does get a
 *   visible `window.alert` (unlike the D4 screens) and no partial row is left.
 *
 * No assertion was weakened, skipped, or deleted to make a defect pass. Tests 7
 * and 8 are characterization tests written to FAIL once D13 / D15 are fixed.
 */

const PETTY_ROUTE = '/cash-on-hand/reconcile-petty-cash';
const PETTY_ANCHOR = 'Reconcile Petty Cash';
const VAULT_ROUTE = '/cash-on-hand/reconcile';
const VAULT_ANCHOR = 'Reconcile Cash Box';
const PETTY_REMARKS = 'Add remarks or findings during recount...';
const VAULT_REMARKS = 'Add remarks or findings during vault recount...';

const stamp = Date.now().toString().slice(-6);
const SEED_NOTE = `E2E reconcile seed ${stamp}`;

const SHORTAGE = 137;        // typed-count shortfall -> must become an "out" row of 137
const OVERAGE = 254.5;       // surplus -> must become an "in" row of 254.50
const PETTY_SEED = 5000;     // fixture inflow so a shortage cannot drive the box negative
const VAULT_IN = 6000;       // fixture non-petty inflow
const VAULT_EXPENSE = 500;   // fixture `expenses` row - feeds the vault balance, not the petty box
const PETTY_ONLY_SEED = 900; // fixture petty row that the vault balance must ignore
const COINS_GARBAGE = '1.2.3';
const BILL_COUNT_GARBAGE = '12ab3';
const EXPECTED_BILL_COUNT = '123';
const COIN_FRAGMENT_GARBAGE = '-99.50abc';
const EXPECTED_COINS = '99.50';

// Control write used by the D13 test: an ordinary petty-cash movement recorded
// through its own screen, which DOES auto-post, so the zero journal delta
// observed for a reconciliation adjustment cannot be a vacuous "nothing can post
// in this session" pass.
const MOVEMENT_ROUTE = '/cash-on-hand/new-petty-cash';
const MOVEMENT_ANCHOR = 'New Petty Cash Entry';
const MOVEMENT_AMOUNT = 620;
const PARTICULARS_MOVE = `E2E reconcile-adj control ${stamp}`;
const DR_CODE = '5100'; // ACCT.OTHER_OPERATING_EXPENSES - debit side of a cash-out
const CR_CODE = '1010'; // ACCT.CASH_ON_HAND             - credit side of a cash-out

/** Primitive-safe full-table read straight out of WatermelonDB storage. */
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

/**
 * FIXTURE ONLY - not the write under test. The harness gives each test an empty
 * local database, and the count fields cannot express a negative amount, so a
 * shortage would be impossible to demonstrate. These rows land in the same tables
 * `CashService` reads, so every expectation below is still recomputed from raw
 * storage rather than assumed.
 */
async function seedCashRows(
    page: Page,
    rows: { amount: number; type: string; isPetty: boolean }[],
): Promise<void> {
    await page.evaluate(async (specs: any[]) => {
        const db = (window as any).__WATERMELON_DB__;
        const collection = db.collections.get('cash_transactions');
        await db.write(async () => {
            for (const spec of specs) {
                await collection.create((record: any) => {
                    record._raw.id = spec.id;
                    record.particulars = spec.particulars;
                    record.amount = spec.amount;
                    record.type = spec.type;
                    record.remarks = 'fixture';
                    record.transactionDate = Date.now();
                    record.isPettyCash = spec.isPetty;
                    record._raw.created_at = Date.now();
                    record._raw.updated_at = Date.now();
                });
            }
        });
    }, rows.map((r, index) => ({ ...r, particulars: SEED_NOTE, id: `e2e-rec-seed-${stamp}-${index}` })));
}

/** FIXTURE ONLY: one `expenses` row so the vault balance has its expense feed. */
async function seedExpense(page: Page, amount: number): Promise<void> {
    await page.evaluate(async (value: number) => {
        const db = (window as any).__WATERMELON_DB__;
        const collection = db.collections.get('expenses');
        await db.write(async () => {
            await collection.create((record: any) => {
                record._raw.id = `e2e-rec-exp-${Date.now()}`;
                record.category = 'E2E reconcile fixture';
                record.amount = value;
                record._raw.expense_date = Date.now();
                record._raw.created_at = Date.now();
                record._raw.updated_at = Date.now();
            });
        });
    }, amount);
}

const money = (v: any): number =>
    v === null || v === undefined ? 0 : Number.isFinite(Number(v)) ? Number(v) : 0;

/**
 * Independent re-implementation of `CashService.getPettyCashBalance()`
 * (`CashService.ts:79-91`): petty rows only, soft-deletes excluded,
 * `starting_balance + in - out`.
 */
function pettyBookBalance(rows: Record<string, any>[]): number {
    const petty = rows.filter(r => r.deleted_at === null || r.deleted_at === undefined)
        .filter(r => r.is_petty_cash === true);
    return (
        petty.filter(r => r.type === 'starting_balance').reduce((s, r) => s + money(r.amount), 0) +
        petty.filter(r => r.type === 'in').reduce((s, r) => s + money(r.amount), 0) -
        petty.filter(r => r.type === 'out').reduce((s, r) => s + money(r.amount), 0)
    );
}

/**
 * Independent re-implementation of `CashService.getCurrentBalance()` together
 * with `readCashInputs()` (`CashService.ts:101-152`): non-petty rows (null OR
 * false), the first `starting_balance` acting as a date cutoff, minus every live
 * expense created at or after that cutoff.
 */
function vaultBookBalance(txns: Record<string, any>[], expenses: Record<string, any>[]): number {
    const live = txns.filter(r => r.deleted_at === null || r.deleted_at === undefined);
    const nonPetty = live.filter(r => r.is_petty_cash === null || r.is_petty_cash === false || r.is_petty_cash === undefined);
    const firstStart = nonPetty.find(r => r.type === 'starting_balance');
    const rawCutoff = firstStart ? firstStart.transaction_date : 0;
    const cutoff = rawCutoff && !Number.isNaN(Number(rawCutoff)) ? Number(rawCutoff) : 0;

    const starting = nonPetty.filter(r => r.type === 'starting_balance').reduce((s, r) => s + money(r.amount), 0);
    const cashIn = nonPetty.filter(r => r.type === 'in' && Number(r.transaction_date) >= cutoff)
        .reduce((s, r) => s + money(r.amount), 0);
    const cashOut = nonPetty.filter(r => r.type === 'out' && Number(r.transaction_date) >= cutoff)
        .reduce((s, r) => s + money(r.amount), 0);
    const expensesTotal = expenses.filter(r => r.deleted_at === null || r.deleted_at === undefined)
        .filter(r => Number(r.created_at || 0) >= cutoff)
        .reduce((s, r) => s + money(r.amount), 0);

    return starting + cashIn - expensesTotal - cashOut;
}

/**
 * The screens render exactly two `text-2xl` figures - Book Balance then Physical
 * Count - so this both proves the figures were found and reads them.
 */
async function renderedFigures(page: Page): Promise<number[]> {
    const texts: string[] = await page.evaluate(() =>
        Array.from(document.querySelectorAll('div[class*="text-2xl"]'))
            .map(n => (n.textContent || '').replace(/ /g, ' ')),
    );
    return texts.map(t => {
        const hit = /(-)?PHP\s*([\d,]+\.\d{2})/.exec(t);
        if (!hit) throw new Error(`no peso figure parsed from ${JSON.stringify(t)}`);
        return Number(`${hit[1] || ''}${hit[2].replace(/,/g, '')}`);
    });
}

/** The six denomination fields share placeholder "0"; order matches DENOMINATIONS. */
const billInputs = (page: Page) => page.locator('input[placeholder="0"]');
const coinsInput = (page: Page) => page.locator('input[placeholder="0.00"]');
const remarksInput = (page: Page, placeholder: string) => page.locator(`[placeholder="${placeholder}"]`);

/** In the react-native-web export the Pressable handler lives on the container div. */
function pressable(page: Page, label: string | RegExp) {
    return page
        .locator('div[tabindex], div[class*="cursor-pointer"], div[class*="select-none"], div[class*="active:bg"]')
        .filter({ hasText: label })
        .last();
}

async function submitReconcile(page: Page) {
    await pressable(page, /confirm reconcile/i).click();
    await page.waitForTimeout(2500);
}

/** Enter the whole physical count through the coins field and prove the count grid is there. */
async function enterPhysicalCount(page: Page, total: number) {
    expect(await billInputs(page).count(), 'the six denomination fields must render').toBe(6);
    await coinsInput(page).fill(String(total));
}

/** The adjustment row this screen just wrote, read back out of storage. */
function onlyRow(rows: Record<string, any>[], particulars: string): Record<string, any> {
    const hits = rows.filter(r => r.particulars === particulars);
    expect(
        hits,
        `expected exactly one stored row "${particulars}", got ${JSON.stringify(rows.map(r => r.particulars))}`,
    ).toHaveLength(1);
    return hits[0];
}

/** Open a reconcile screen with a known seeded balance. */
async function openReconcile(
    page: Page,
    route: string,
    anchor: string,
    rows: { amount: number; type: string; isPetty: boolean }[],
    expense?: number,
) {
    await loginAsAdmin(page);
    await seedCashRows(page, rows);
    if (expense !== undefined) await seedExpense(page, expense);
    // Navigate after seeding so the screen's mount-time balance fetch sees the rows.
    await safeNavigate(page, route, anchor);
    await expect(page.getByText(anchor)).toBeVisible({ timeout: 30000 });
}

/**
 * FIXTURE ONLY: insert the two posting accounts `JournalEntryService.createEntry`
 * validates against, so the control write in the D13 test really can post.
 */
async function seedPostableAccounts(page: Page): Promise<number> {
    return page.evaluate(async (specs: string[]) => {
        const db = (window as any).__WATERMELON_DB__;
        const collection = db.collections.get('chart_of_accounts');
        const existing = await collection.query().fetch();
        const have = new Set(existing.map((r: any) => r._raw.code));
        let inserted = 0;
        await db.write(async () => {
            for (const spec of specs) {
                const [code, name, accountType, normalBalance] = spec.split('|');
                if (have.has(code)) continue;
                await collection.create((record: any) => {
                    record._raw.id = `e2e-reconcile-coa-${code}`;
                    record.code = code;
                    record.name = name;
                    record.accountType = accountType;
                    record.normalBalance = normalBalance;
                    record.isActive = true;
                    record.isHeader = false;
                    record.sortOrder = 9000;
                    // createdAt is @readonly on the model, so the timestamps go in
                    // through the raw row instead of the decorated setter.
                    record._raw.created_at = Date.now();
                    record._raw.updated_at = Date.now();
                });
                inserted += 1;
            }
        });
        return inserted;
    }, [
        `${DR_CODE}|Other Operating Expenses E2E|expense|debit`,
        `${CR_CODE}|Cash on Hand E2E|asset|debit`,
    ]);
}

/**
 * The harness serves a production export, so an uncaught throw renders no dev
 * overlay. Hook the error events before the app boots so "validated, did not
 * crash" is evidenced instead of inferred (requirement 3 + 5).
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

async function uncaughtEntries(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__E2E_UNCAUGHT__ || []);
}

test.describe('Cash reconciliation write path (petty box + vault box)', () => {
    test('the rendered petty book balance equals the balance recomputed from raw storage', async ({ page }) => {
        await openReconcile(page, PETTY_ROUTE, PETTY_ANCHOR, [
            { amount: PETTY_SEED, type: 'in', isPetty: true },
            { amount: 400, type: 'out', isPetty: true },
        ]);

        const txns = (await readAll(page, 'cash_transactions'))!;
        const expected = pettyBookBalance(txns);
        expect(expected, 'independent recompute of 5000 in - 400 out').toBe(PETTY_SEED - 400);

        const figures = await renderedFigures(page);
        expect(figures, 'Book Balance then Physical Count').toHaveLength(2);
        expect(figures[0], 'the rendered Book Balance must match the independent recompute').toBe(expected);
        expect(figures[1], 'an untouched count is zero').toBe(0);
    });

    test('a shortage writes an outflow adjustment of exactly the shortage and lowers the box', async ({ page }) => {
        await openReconcile(page, PETTY_ROUTE, PETTY_ANCHOR, [
            { amount: PETTY_SEED, type: 'in', isPetty: true },
        ]);

        const book = pettyBookBalance((await readAll(page, 'cash_transactions'))!);
        const physical = book - SHORTAGE;
        const cashBefore = await countRows(page, 'cash_transactions');
        const jeBefore = await countRows(page, 'journal_entries');

        await enterPhysicalCount(page, physical);
        const figures = await renderedFigures(page);
        expect(figures[1], 'the live physical figure must follow the count').toBeCloseTo(physical, 2);
        await expect(page.getByText('Cash Shortage')).toBeVisible();
        await expect(
            page.getByText(`Shortage of PHP ${SHORTAGE.toFixed(2)}. Adjusting entry (outflow) will be posted.`),
            'the on-screen shortage must equal the arithmetic difference',
        ).toBeVisible();

        await remarksInput(page, PETTY_REMARKS).fill(`E2E shortage ${stamp}`);
        await submitReconcile(page);

        const rows = (await readAll(page, 'cash_transactions'))!;
        expect(await countRows(page, 'cash_transactions'), 'one adjustment row written').toBe(cashBefore + 1);
        const adj = onlyRow(rows, 'Petty Cash Reconciliation Adj (Shortage)');
        expect(money(adj.amount), 'the stored amount is the shortage, not the count').toBe(SHORTAGE);
        expect(adj.type).toBe('out');
        expect(adj.is_petty_cash, 'it must stay inside the petty box').toBe(true);

        const count = JSON.parse(String(adj.remarks).split(' | Count: ')[1]);
        expect(count.physicalTotal, 'the persisted count snapshot matches the typed count').toBeCloseTo(physical, 2);
        expect(count.bookBalance).toBeCloseTo(book, 2);
        expect(count.discrepancy, 'a shortage is stored as a negative discrepancy').toBeCloseTo(-SHORTAGE, 2);
        expect(String(adj.remarks), 'the operator note must survive into storage').toContain(`E2E shortage ${stamp}`);

        expect(pettyBookBalance(rows), 'the box balance must drop by exactly the shortage').toBeCloseTo(book - SHORTAGE, 2);
        console.log(`[D13] petty shortage ${SHORTAGE}: cash_transactions +1, journal_entries delta = ${await countRows(page, 'journal_entries') - jeBefore}`);
    });

    test('an overage writes an inflow adjustment of exactly the overage and raises the box', async ({ page }) => {
        await openReconcile(page, PETTY_ROUTE, PETTY_ANCHOR, [
            { amount: PETTY_SEED, type: 'in', isPetty: true },
        ]);

        const book = pettyBookBalance((await readAll(page, 'cash_transactions'))!);
        const physical = book + OVERAGE;
        const jeBefore = await countRows(page, 'journal_entries');

        await enterPhysicalCount(page, physical);
        await expect(page.getByText('Cash Overage')).toBeVisible();
        await expect(
            page.getByText(`Overage of PHP ${OVERAGE.toFixed(2)}. Adjusting entry (inflow) will be posted.`),
        ).toBeVisible();
        await submitReconcile(page);

        const rows = (await readAll(page, 'cash_transactions'))!;
        const adj = onlyRow(rows, 'Petty Cash Reconciliation Adj (Overage)');
        expect(money(adj.amount), 'the stored amount is the overage').toBeCloseTo(OVERAGE, 2);
        expect(adj.type).toBe('in');
        expect(pettyBookBalance(rows), 'the box balance must rise by exactly the overage').toBeCloseTo(book + OVERAGE, 2);
        console.log(`[D13] petty overage ${OVERAGE}: journal_entries delta = ${await countRows(page, 'journal_entries') - jeBefore}`);
    });

    test('a balanced count writes a zero-amount checkpoint and leaves the balance alone', async ({ page }) => {
        await openReconcile(page, PETTY_ROUTE, PETTY_ANCHOR, [
            { amount: PETTY_SEED, type: 'in', isPetty: true },
            { amount: 120, type: 'out', isPetty: true },
        ]);

        const book = pettyBookBalance((await readAll(page, 'cash_transactions'))!);
        const cashBefore = await countRows(page, 'cash_transactions');

        await enterPhysicalCount(page, book);
        await expect(page.getByText('Balanced')).toBeVisible();
        await submitReconcile(page);

        const rows = (await readAll(page, 'cash_transactions'))!;
        expect(rows.length, 'one checkpoint row written').toBe(cashBefore + 1);
        const adj = onlyRow(rows, 'Petty Cash Reconciled - Balanced');
        expect(money(adj.amount), 'a balanced count must not move money').toBe(0);
        expect(adj.type, 'the checkpoint is stored as a zero inflow').toBe('in');
        expect(pettyBookBalance(rows), 'the balance is unchanged by a balanced count').toBeCloseTo(book, 2);
    });

    test('the vault box subtracts the expenses table from its book balance and ignores petty rows', async ({ page }) => {
        await openReconcile(
            page,
            VAULT_ROUTE,
            VAULT_ANCHOR,
            [
                { amount: VAULT_IN, type: 'in', isPetty: false },
                { amount: PETTY_ONLY_SEED, type: 'in', isPetty: true },
            ],
            VAULT_EXPENSE,
        );

        const txns = (await readAll(page, 'cash_transactions'))!;
        const expenses = (await readAll(page, 'expenses'))!;
        const expectedVault = vaultBookBalance(txns, expenses);
        expect(expectedVault, 'cross-module: 6000 inflow minus the 500 expense feed').toBe(VAULT_IN - VAULT_EXPENSE);
        expect(pettyBookBalance(txns), 'the petty box keeps its own separate balance').toBe(PETTY_ONLY_SEED);

        const figures = await renderedFigures(page);
        expect(figures[0], 'the rendered vault Book Balance must match the independent recompute').toBeCloseTo(expectedVault, 2);

        const physical = expectedVault - SHORTAGE;
        const cashBefore = await countRows(page, 'cash_transactions');
        const jeBefore = await countRows(page, 'journal_entries');

        await enterPhysicalCount(page, physical);
        await remarksInput(page, VAULT_REMARKS).fill(`E2E vault ${stamp}`);
        await submitReconcile(page);

        const after = (await readAll(page, 'cash_transactions'))!;
        expect(await countRows(page, 'cash_transactions'), 'one vault adjustment row').toBe(cashBefore + 1);
        const adj = onlyRow(after, 'Cash Box Reconciliation Adj (Shortage)');
        expect(money(adj.amount)).toBe(SHORTAGE);
        expect(adj.type).toBe('out');
        expect(Boolean(adj.is_petty_cash), 'the vault row must not be tagged petty cash').toBe(false);
        expect(
            vaultBookBalance(after, (await readAll(page, 'expenses'))!),
            'the vault balance must drop by exactly the shortage',
        ).toBeCloseTo(expectedVault - SHORTAGE, 2);
        expect(pettyBookBalance(after), 'and the petty box must be untouched').toBe(PETTY_ONLY_SEED);
        console.log(`[D13] vault shortage ${SHORTAGE}: journal_entries delta = ${await countRows(page, 'journal_entries') - jeBefore}`);
    });

    test('count fields sanitize invalid input and the stored adjustment follows the digits only', async ({ page }) => {
        await installErrorCollector(page);
        await openReconcile(page, PETTY_ROUTE, PETTY_ANCHOR, [
            { amount: PETTY_SEED, type: 'in', isPetty: true },
        ]);

        const book = pettyBookBalance((await readAll(page, 'cash_transactions'))!);
        const cashBefore = await countRows(page, 'cash_transactions');

        await billInputs(page).first().fill(BILL_COUNT_GARBAGE);
        await coinsInput(page).fill(COIN_FRAGMENT_GARBAGE);

        expect(await billInputs(page).first().inputValue(), 'letters are stripped from a bill count').toBe(EXPECTED_BILL_COUNT);
        expect(await coinsInput(page).inputValue(), 'a leading minus sign cannot be entered').toBe(EXPECTED_COINS);

        const expectedPhysical = Number(EXPECTED_BILL_COUNT) * 1000 + Number(EXPECTED_COINS);
        const figures = await renderedFigures(page);
        expect(
            figures[1],
            'the physical total must be built from the sanitized digits',
        ).toBeCloseTo(expectedPhysical, 2);
        await expect(page.getByText('Cash Overage')).toBeVisible();

        await submitReconcile(page);

        const rows = (await readAll(page, 'cash_transactions'))!;
        expect(rows.length, 'exactly one adjustment row written').toBe(cashBefore + 1);
        const adj = onlyRow(rows, 'Petty Cash Reconciliation Adj (Overage)');
        expect(
            money(adj.amount),
            'the adjustment must equal the sanitized arithmetic minus the book balance',
        ).toBeCloseTo(expectedPhysical - book, 2);

        // Validated-and-survived rather than crashed: the sanitized digits decide the
        // amount, nothing throws, and the app is still on a live screen afterwards.
        const uncaught = await uncaughtEntries(page);
        expect(uncaught, `no uncaught error or rejection may come from the count fields: ${JSON.stringify(uncaught)}`).toEqual([]);
        const stillMounted = await page.evaluate(() => Boolean((window as any).__WATERMELON_DB__));
        expect(stillMounted, 'the app must still be running after the invalid input').toBe(true);
        expect(
            await page.evaluate(() => (document.body.innerText || '').includes('Something went wrong')),
            'no error boundary may have replaced the screen',
        ).toBe(false);
    });

    test('CHARACTERIZES D13 (fails once fixed): a reconciliation shortage never reaches the general ledger', async ({ page }) => {
        await loginAsAdmin(page);
        await seedCashRows(page, [{ amount: PETTY_SEED, type: 'in', isPetty: true }]);

        // Control: prove the ledger CAN post in this exact session, through the
        // ordinary petty-cash movement screen, before asserting that the recount
        // does not. Without this the zero delta below would be vacuous.
        expect(await seedPostableAccounts(page), 'the two posting accounts must be available').toBeGreaterThan(0);
        await safeNavigate(page, MOVEMENT_ROUTE, MOVEMENT_ANCHOR);
        const jeBeforeControl = await countRows(page, 'journal_entries');
        await page.getByPlaceholder('e.g. Office cleaning materials, Courier fee').fill(PARTICULARS_MOVE);
        await page.getByPlaceholder('0.00').fill(String(MOVEMENT_AMOUNT));
        await page.getByText('Save Entry', { exact: true }).click();
        await expect(page.getByText(MOVEMENT_ANCHOR)).toHaveCount(0, { timeout: 30000 });

        const controlEntries = (await readAll(page, 'journal_entries'))!;
        expect(
            controlEntries.length,
            'the control disbursement must auto-post one entry',
        ).toBe(jeBeforeControl + 1);
        const allLines = (await readAll(page, 'journal_entry_lines'))!;
        const controlLines = allLines.filter(
            l => money(l.debit_amount) === MOVEMENT_AMOUNT || money(l.credit_amount) === MOVEMENT_AMOUNT,
        );
        expect(controlLines.length, 'the control entry has a debit and a credit line').toBe(2);
        expect(
            controlLines.reduce((s, l) => s + money(l.debit_amount), 0),
            'the control entry balances on the typed amount (debit side)',
        ).toBe(MOVEMENT_AMOUNT);
        expect(
            controlLines.reduce((s, l) => s + money(l.credit_amount), 0),
            'the control entry balances on the typed amount (credit side)',
        ).toBe(MOVEMENT_AMOUNT);

        // Now the recount, in the same session and against the balance the control
        // write just changed.
        await safeNavigate(page, PETTY_ROUTE, PETTY_ANCHOR);
        await expect(page.getByText(PETTY_ANCHOR)).toBeVisible({ timeout: 30000 });

        const book = pettyBookBalance((await readAll(page, 'cash_transactions'))!);
        expect(book, 'the box balance already absorbed the control disbursement').toBe(PETTY_SEED - MOVEMENT_AMOUNT);
        const figures = await renderedFigures(page);
        expect(figures[0], 'the screen must show that same book balance').toBeCloseTo(book, 2);

        const jeBefore = await countRows(page, 'journal_entries');
        const lineBefore = await countRows(page, 'journal_entry_lines');

        await enterPhysicalCount(page, book - SHORTAGE);
        await submitReconcile(page);

        const rows = (await readAll(page, 'cash_transactions'))!;
        expect(
            money(onlyRow(rows, 'Petty Cash Reconciliation Adj (Shortage)').amount),
            'the cash really did leave the box',
        ).toBe(SHORTAGE);

        const entries = (await readAll(page, 'journal_entries'))!;
        const lines = (await readAll(page, 'journal_entry_lines'))!;
        console.log(
            `[D13] control disbursement ${MOVEMENT_AMOUNT} posted ${jeBeforeControl} -> ${controlEntries.length} entries; ` +
            `recount shortage ${SHORTAGE}: journal_entries ${jeBefore} -> ${entries.length}, ` +
            `journal_entry_lines ${lineBefore} -> ${lines.length}`,
        );

        // Observed today: no counterpart at all, so fixing D13 must fail this test
        // until the assertions are inverted to expect a balanced shortage entry.
        expect(entries.length, 'D13: no journal entry is created for the adjustment').toBe(jeBefore);
        expect(lines.length, 'D13: no journal line touches any account').toBe(lineBefore);
        expect(
            lines.filter(l => money(l.debit_amount) === SHORTAGE || money(l.credit_amount) === SHORTAGE).length,
            'D13: nothing in the ledger even mentions the shortage amount',
        ).toBe(0);
    });

    test('CHARACTERIZES D15 (fails once fixed): the coins field accepts a malformed decimal and silently truncates it', async ({ page }) => {
        await openReconcile(page, PETTY_ROUTE, PETTY_ANCHOR, [
            { amount: PETTY_SEED, type: 'in', isPetty: true },
        ]);

        await coinsInput(page).fill(COINS_GARBAGE);

        expect(
            await coinsInput(page).inputValue(),
            'the sanitizer keeps every dot, so the malformed string survives in the field',
        ).toBe(COINS_GARBAGE);

        const figures = await renderedFigures(page);
        expect(figures[1], 'D15: parseFloat silently truncates "1.2.3" to 1.2').toBeCloseTo(1.2, 2);
        await expect(page.getByText(/Enter a valid/i)).toHaveCount(0);
        await expect(page.getByText(/invalid coin/i)).toHaveCount(0);
    });

    test('degraded storage write: the failure is surfaced to the operator and nothing is persisted', async ({ page }) => {
        const dialogs: string[] = [];
        page.on('dialog', async dialog => {
            dialogs.push(dialog.message());
            await dialog.dismiss().catch(() => {});
        });
        await openReconcile(page, PETTY_ROUTE, PETTY_ANCHOR, [
            { amount: PETTY_SEED, type: 'in', isPetty: true },
        ]);

        const book = pettyBookBalance((await readAll(page, 'cash_transactions'))!);
        const cashBefore = await countRows(page, 'cash_transactions');

        // Force the local persistence layer itself to fail - the same class of
        // failure a corrupted IndexedDB store produces on a real device.
        await page.evaluate(() => {
            const db = (window as any).__WATERMELON_DB__;
            (window as any).__E2E_REAL_WRITE__ = db.write.bind(db);
            db.write = () => Promise.reject(new Error('E2E forced storage failure'));
        });

        try {
            await enterPhysicalCount(page, book - SHORTAGE);
            await submitReconcile(page);

            expect(
                dialogs.filter(m => /Reconciliation/i.test(m)).length,
                `errorAlerts.ts must surface the failure on web; dialogs: ${JSON.stringify(dialogs)}`,
            ).toBeGreaterThan(0);
            expect(
                (await readAll(page, 'cash_transactions'))!.length,
                'a failed write must not leave a partial row',
            ).toBe(cashBefore);
            await expect(page.getByText('Cash Shortage'), 'the form must still be interactive').toBeVisible();
        } finally {
            await page.evaluate(() => {
                const db = (window as any).__WATERMELON_DB__;
                const real = (window as any).__E2E_REAL_WRITE__;
                if (real) db.write = real;
            });
        }
    });
});
