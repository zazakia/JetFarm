import { test, expect, type Page } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live write-path + cross-module coverage for the petty-cash entry screen
 * (`app/(admin)/cash-on-hand/new-petty-cash.tsx`), which had no automated spec at
 * all before this: the Financials & Vault group was previously render-only.
 *
 * It is the cleanest finance write path in the app - it needs no prerequisite
 * record, while bank transactions need an existing `bank_accounts` row and
 * transfers need a source plus a destination - so it is the only place where the
 * cash-record -> general-ledger propagation can be proven end-to-end in the
 * shipped react-native-web build (the Playwright harness serves the production
 * `dist/` export through `scripts/start-playwright-web.mjs`).
 *
 * Step 3 (persistence): assertions re-read WatermelonDB storage through
 * `window.__WATERMELON_DB__`, never the rendered list.
 *
 * Step 4 (independent math): the expected journal is recomputed here from the
 * amount typed into the form, not from the app's own totals. A cash-out must post
 * DR 5100 Other Operating Expenses / CR 1010 Cash on Hand for exactly that amount
 * (`AutoPostingService.postCashTransaction`, lines 218-238; codes from `ACCT` at
 * `:47` and `:68`), and `JournalEntryService.createEntry` refuses an unbalanced
 * entry (`:135-140`), so debit sum === credit sum === typed amount is the contract.
 *
 * Test 2 covers the goal's degraded case: the ledger post fails while the
 * operational write succeeds. `chart_of_accounts` is only populated by the manual
 * seed action (`app/(admin)/accounting/index.tsx:57`), so a fresh local build has
 * none, and `createEntry` validates every line against `getActivePostableAccounts()`
 * (`src/services/ChartOfAccountsService.ts:190-200`) and throws. The screen fires
 * the post without awaiting user-visible confirmation and only `console.warn`s, so
 * this reproduces defect D2 on a second, independent screen.
 *
 * Test 4 reproduces defect D1 on the form's own invalid-input path:
 * `@hookform/resolvers` 3.9.1 with zod 4.3.6 throws instead of returning
 * `{ errors }`, so neither the inline message (`:167`) nor the `onInvalid`
 * handler (`:199` -> `handleFormValidationError`) runs. In the production export
 * that means a silent no-op. Both characterization tests are written to FAIL once
 * their defect is fixed; no assertion has been weakened to make a defect pass.
 */

const ROUTE = '/cash-on-hand/new-petty-cash';
const ANCHOR = 'New Petty Cash Entry';
const AMOUNT = 850;
const DR_CODE = '5100'; // ACCT.OTHER_OPERATING_EXPENSES - debit side of a cash-out
const CR_CODE = '1010'; // ACCT.CASH_ON_HAND           - credit side of a cash-out

const stamp = Date.now().toString().slice(-6);
const PARTICULARS_OK = `E2E petty cash ${stamp} disbursement`;
const PARTICULARS_ZERO = `E2E petty cash ${stamp} zero amount`;
const PARTICULARS_NO_COA = `E2E petty cash ${stamp} unseeded coa`;

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
 * Insert the two posting accounts the double-entry validator requires, so the
 * happy path can be exercised without touching a seed script or the remote DB.
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
                    record._raw.id = `e2e-coa-${code}`;
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

async function fillEntry(page: Page, particulars: string, amount: string) {
    await page.getByPlaceholder('e.g. Office cleaning materials, Courier fee').fill(particulars);
    await page.getByPlaceholder('0.00').fill(amount);
    // The form defaults to Disbursement (out); assert it so the expected DR/CR
    // direction above is not a guess.
    await expect(page.getByText('Disbursement (Out)').first()).toBeVisible();
}

async function submit(page: Page) {
    await page.getByText('Save Entry', { exact: true }).click();
}

/**
 * The harness serves a production export, so an uncaught promise rejection from
 * the resolver does not render a dev overlay. Hook both rejection and error
 * events before the app boots so D1 can be evidenced rather than inferred.
 */
async function installErrorCollector(page: Page) {
    await page.addInitScript(() => {
        (window as any).__E2E_UNCAUGHT__ = [];
        (window as any).__E2E_WARNS__ = [];
        const nativeWarn = console.warn.bind(console);
        console.warn = (...args: any[]) => {
            (window as any).__E2E_WARNS__.push(
                args
                    .map(a => (a instanceof Error ? `${a.name}: ${a.message}` : String(a)))
                    .join(' '),
            );
            nativeWarn(...args);
        };
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

async function warnEntries(page: Page): Promise<string[]> {
    return page.evaluate(() => (window as any).__E2E_WARNS__ || []);
}

test.describe('Petty cash write path -> general ledger', () => {
    test('records a disbursement and auto-posts a balanced journal entry, verified from storage', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await safeNavigate(page, ROUTE, ANCHOR);

        expect(await seedPostableAccounts(page)).toBeGreaterThan(0);
        const cashBefore = await countRows(page, 'cash_transactions');
        const jeBefore = await countRows(page, 'journal_entries');
        expect(cashBefore).toBeGreaterThanOrEqual(0);
        expect(jeBefore).toBeGreaterThanOrEqual(0);

        await fillEntry(page, PARTICULARS_OK, String(AMOUNT));
        await submit(page);

        // Observed: `safeBack` unwinds the history stack, so the screen lands on the
        // previous page (the Operator Command Center) rather than the petty-cash
        // list. Leaving the form is the observable that the handler completed; the
        // persistence assertions below are what actually prove the write.
        await expect(page.getByText(ANCHOR)).toHaveCount(0, { timeout: 30000 });

        const created = (await readAll(page, 'cash_transactions'))!.filter(
            r => r.particulars === PARTICULARS_OK,
        );
        expect(created).toHaveLength(1);
        const tx = created[0];
        expect(tx.amount).toBe(AMOUNT);
        expect(tx.type).toBe('out');
        expect(tx.is_petty_cash).toBe(true);
        expect(tx.deleted_at ?? null).toBe(null);

        // Independently recomputed expectation: balanced on the typed amount,
        // DR 5100 / CR 1010, one entry linked back to the cash row.
        const entries = (await readAll(page, 'journal_entries'))!.filter(
            r => r.source_table === 'cash_transactions' && r.source_id === tx.id,
        );
        expect(entries, 'cash row persisted with no journal entry (see D2)').toHaveLength(1);
        const entry = entries[0];
        expect(entry.total_debit).toBe(AMOUNT);
        expect(entry.total_credit).toBe(AMOUNT);
        expect(entry.entry_type).toBe('auto');

        const lines = (await readAll(page, 'journal_entry_lines'))!.filter(
            r => r.journal_entry_id === entry.id,
        );
        expect(lines).toHaveLength(2);
        const debitSum = lines.reduce((s, l) => s + (l.debit_amount || 0), 0);
        const creditSum = lines.reduce((s, l) => s + (l.credit_amount || 0), 0);
        expect(debitSum).toBe(AMOUNT);
        expect(creditSum).toBe(AMOUNT);
        expect(lines.find(l => l.account_code === DR_CODE)?.debit_amount).toBe(AMOUNT);
        expect(lines.find(l => l.account_code === CR_CODE)?.credit_amount).toBe(AMOUNT);

        expect(await countRows(page, 'cash_transactions')).toBe(cashBefore + 1);
        expect(await countRows(page, 'journal_entries')).toBe(jeBefore + 1);

        // The happy path must not surface a resolver throw for valid input.
        const uncaught = await uncaughtEntries(page);
        expect(
            uncaught.filter(e => /Amount must be greater than zero|ZodError|Particulars/i.test(e)),
            JSON.stringify(uncaught),
        ).toEqual([]);
    });

    test('CHARACTERIZES D2 (fails once fixed): unseeded chart of accounts leaves the cash row persisted with no ledger entry, while the UI still reports success', async ({ page }) => {
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await safeNavigate(page, ROUTE, ANCHOR);

        // No seeding: a fresh local build ships an empty chart_of_accounts.
        const coaCount = await countRows(page, 'chart_of_accounts');
        test.skip(coaCount > 0, 'this environment already has a seeded chart of accounts');

        const cashBefore = await countRows(page, 'cash_transactions');
        const jeBefore = await countRows(page, 'journal_entries');

        await fillEntry(page, PARTICULARS_NO_COA, String(AMOUNT));
        await submit(page);

        // Observed: the degraded save looks exactly like a successful one - it leaves
        // the form and unwinds history (see safeBack above), its Alert.success is a
        // web no-op (D4), and nothing on screen distinguishes the two cases.
        await expect(page.getByText(ANCHOR)).toHaveCount(0, { timeout: 30000 });

        expect(
            (await readAll(page, 'cash_transactions'))!.filter(r => r.particulars === PARTICULARS_NO_COA),
            'the operational record persisted',
        ).toHaveLength(1);
        expect(await countRows(page, 'cash_transactions')).toBe(cashBefore + 1);
        expect(
            await countRows(page, 'journal_entries'),
            'the double-entry counterpart is missing while the save looked successful',
        ).toBe(jeBefore);

        // The failure is only visible in the console, never to the operator.
        // `new-petty-cash.tsx:69` catches the post error and console.warn()s it.
        const warns = await warnEntries(page);
        expect(
            warns.filter(l => /Auto-posting warning/.test(l)),
            `expected the swallowed posting failure in the console log; warns: ${JSON.stringify(warns)}`,
        ).toHaveLength(1);
        expect(
            warns.filter(l => /Unknown or inactive posting account/.test(l)).length,
            `the swallowed reason should name the missing posting account; warns: ${JSON.stringify(warns)}`,
        ).toBeGreaterThan(0);
    });

    test('refuses a zero amount: nothing is written and the form stays interactive', async ({ page }) => {
        await loginAsAdmin(page);
        await safeNavigate(page, ROUTE, ANCHOR);

        const cashBefore = await countRows(page, 'cash_transactions');
        const jeBefore = await countRows(page, 'journal_entries');

        await fillEntry(page, PARTICULARS_ZERO, '0');
        await submit(page);
        await page.waitForTimeout(2500);

        // The submit handler early-returns because the resolver never resolves, so
        // the write is correctly blocked regardless of how the error surfaces.
        expect(await countRows(page, 'cash_transactions')).toBe(cashBefore);
        expect(await countRows(page, 'journal_entries')).toBe(jeBefore);

        // Still on the form and usable: it validated-and-refused rather than crashing.
        await expect(page.getByText(ANCHOR)).toBeVisible();
        await expect(page.getByPlaceholder('0.00')).toHaveValue('0');
        expect(await countRows(page, 'cash_transactions')).toBe(cashBefore);
    });

    test('CHARACTERIZES D1 (fails once fixed): zero amount throws instead of producing the wired inline message or alert', async ({ page }) => {
        const dialogs: string[] = [];
        page.on('dialog', async dialog => {
            dialogs.push(dialog.message());
            await dialog.dismiss().catch(() => {});
        });
        await installErrorCollector(page);
        await loginAsAdmin(page);
        await safeNavigate(page, ROUTE, ANCHOR);

        await fillEntry(page, PARTICULARS_ZERO, '0');
        await submit(page);
        await page.waitForTimeout(2500);

        const uncaught = await uncaughtEntries(page);
        const zodThrow = uncaught.filter(e => /Amount must be greater than zero|ZodError|custom/i.test(e));

        // Observed today: the resolver throws, so formState.errors never fills.
        // Asserting the absence of the correct behaviour keeps this falsifiable -
        // once @hookform/resolvers is upgraded this must fail until the assertions
        // are inverted to expect the message.
        expect(
            await page.getByText('Amount must be greater than zero').count(),
            'inline validation message must be absent while D1 stands',
        ).toBe(0);
        expect(dialogs, 'errorAlerts/window.alert must not run while D1 stands').toEqual([]);
        expect(
            zodThrow.length,
            `expected an uncaught resolver throw; captured: ${JSON.stringify(uncaught)}`,
        ).toBeGreaterThan(0);
    });
});
