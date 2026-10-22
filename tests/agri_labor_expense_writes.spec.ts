import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live write-path coverage for the two agribusiness modules still unexercised in a
 * browser: Farm Input Expenses (`app/(admin)/agribusiness/expenses.tsx`) and Farm
 * Labor (`app/(admin)/agribusiness/labor.tsx`), including the expense -> General
 * Ledger auto-posting and the worker -> labor-log relation.
 *
 * Persistence and the ledger side effects are re-read from WatermelonDB storage
 * (`window.__WATERMELON_DB__`); the wage arithmetic is recomputed by this spec, not
 * taken from the app.
 *
 * Characterised defects (each assertion pins the behaviour as observed, so it FAILS once
 * the app is fixed):
 * - D4  `expenses.tsx:197/202/290` and `labor.tsx:182` report validation and delete
 *   confirmation through `Alert.alert`, a no-op in react-native-web 0.21.2.
 * - D9  `expenses.tsx:212-234` (the edit branch of `handleSaveExpense`) updates the expense
 *   row but never re-posts or reverses the journal entry - only the create branch calls
 *   `AutoPostingService.postAgriFarmExpense` (`expenses.tsx:250`), so the GL keeps the pre-edit amount.
 * - M3  the edit/delete affordances (`expenses.tsx:1049` and `:1055`) are icon-only Pressables with
 *   no testID, no accessibilityRole and no label, so they have no accessible name and are
 *   addressable only through their NativeWind hover class token.
 */

const EXPENSES_ROUTE = '/agribusiness/expenses';
const EXPENSES_ANCHOR = 'Farm Input Expenses';
const LABOR_ROUTE = '/agribusiness/labor';
const LABOR_ANCHOR = 'Farm Labor & Field Workers';

const stamp = Date.now().toString().slice(-6);
const DESC = `E2E Fertilizer ${stamp}`;
const DESC_EDITED = `E2E Fertilizer ${stamp} (edited)`;
const AMOUNT = 18400;
const AMOUNT_EDITED = 21500;
/** AutoPostingService.mapAgriExpenseCategoryToAccount('fertilizer') -> 5162; paidBy 'jet' credits 1010. */
const DR_CODE = '5162';
const CR_CODE = '1010';

const WORKER = `E2E Worker ${stamp}`;
const DAILY_RATE = 450;
const UNITS = 3;
const EXPECTED_PAY = UNITS * DAILY_RATE;   // 1,350 - recomputed here, not by the app
const TASK = `E2E Hilling ${stamp}`;

async function readAll(page: Page, table: string) {
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

async function seedPostableAccounts(page: Page): Promise<void> {
    await page.evaluate(async (specs: string[]) => {
        const db = (window as any).__WATERMELON_DB__;
        const collection = db.collections.get('chart_of_accounts');
        const have = new Set((await collection.query().fetch()).map((r: any) => r._raw.code));
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
            }
        });
    }, [
        `${DR_CODE}|Agri Fertilizer Expense E2E|expense|debit`,
        `${CR_CODE}|Cash on Hand E2E|asset|debit`,
    ]);
}

async function redBoxVisible(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const text = document.body?.innerText || '';
        return /Uncaught Error|Application Error|something went wrong/i.test(text);
    });
}

/**
 * The expense card, and its edit/delete affordances, discovered through the live DOM
 * (see the §3e probe logs). react-native-web 0.21.2 renders the icon-only Pressables as
 * plain <div>s carrying the NativeWind hover tokens literally (`hover:bg-gray-100` = edit,
 * `hover:bg-red-50` = delete) with no <svg>, no <i>, no testID and no accessible name (M3),
 * so a role/label locator resolves to nothing and the class token is the only stable handle.
 */
async function expenseCard(page: Page, description: string): Promise<Locator> {
    await safeNavigate(page, EXPENSES_ROUTE, EXPENSES_ANCHOR);
    const card = page.locator('div')
        .filter({ has: page.locator('[class*="hover:bg-red-50"]') })
        .filter({ hasText: description })
        .last();
    await expect(card, `expense card for "${description}" must render`).toBeVisible({ timeout: 30000 });
    return card;
}

function editAffordance(card: Locator): Locator {
    return card.locator('[class*="hover:bg-gray-100"]').first();
}

function deleteAffordance(card: Locator): Locator {
    return card.locator('[class*="hover:bg-red-50"]').first();
}

/** M3 evidence, recorded rather than assumed: how many labelled controls the card exposes. */
async function reportCardAffordances(card: Locator): Promise<void> {
    console.log(`[expense-card] edit=${await card.locator('[class*="hover:bg-gray-100"]').count()} `
        + `delete=${await card.locator('[class*="hover:bg-red-50"]').count()} `
        + `svg=${await card.locator('svg').count()} i=${await card.locator('i').count()} `
        + `accessibleButtons=${await card.getByRole('button').count()}`);
}

async function openExpenseModal(page: Page) {
    await safeNavigate(page, EXPENSES_ROUTE, EXPENSES_ANCHOR);
    await page.getByText('+ Log Farm Expense', { exact: true }).first().click();
    await expect(page.getByPlaceholder('e.g. 10 bags Complete 14-14-14 Fertilizer')).toBeVisible();
}

async function fillExpense(page: Page, description: string, amount: number | string) {
    await page.getByPlaceholder('e.g. 10 bags Complete 14-14-14 Fertilizer').fill(String(description));
    await page.getByPlaceholder('0.00').fill(String(amount));
}

test.describe('Farm Input Expenses: create, auto-post, edit, delete', () => {
    test('records an expense, persists it, and auto-posts a balanced journal entry that points back at the expense', async ({ page }) => {
        await loginAsAdmin(page);
        await seedPostableAccounts(page);
        const beforeExpenses = await countRows(page, 'agri_farm_expenses');
        const beforeEntries = await countRows(page, 'journal_entries');

        await openExpenseModal(page);
        await fillExpense(page, DESC, AMOUNT);
        await page.getByText('Save Expense', { exact: true }).first().click();
        await expect(page.getByPlaceholder('e.g. 10 bags Complete 14-14-14 Fertilizer')).toHaveCount(0, { timeout: 30000 });

        expect(await redBoxVisible(page), 'saving must not crash the app').toBe(false);
        const rows = (await readAll(page, 'agri_farm_expenses')).filter(r => r.description === DESC);
        expect(rows.length, 'the expense row must exist in storage').toBe(1);
        const expense = rows[0];
        expect(Number(expense.amount), 'amount stored verbatim, not re-derived').toBe(AMOUNT);
        expect(expense.deleted_at, 'a saved expense must not be soft-deleted').toBeNull();
        expect(String(expense.category)).toBe('fertilizer');
        expect(String(expense.paid_by), "default payment source is the operator's cash on hand").toBe('jet');

        // Cross-module: expense -> general ledger.
        expect(await countRows(page, 'journal_entries'), 'exactly one journal entry per expense').toBe(beforeEntries + 1);
        const entries = (await readAll(page, 'journal_entries')).filter(r => r.source_id === expense.id);
        expect(entries.length, 'the entry must be linked to the expense by source_id').toBe(1);
        const entry = entries[0];
        expect(String(entry.source_table)).toBe('agri_farm_expenses');
        expect(String(entry.entry_type)).toBe('auto');

        const lines = (await readAll(page, 'journal_entry_lines')).filter(r => r.journal_entry_id === entry.id);
        expect(lines.length).toBe(2);
        const sumDebit = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
        const sumCredit = lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
        expect(sumDebit, 'this spec recomputes the debit side').toBe(AMOUNT);
        expect(sumCredit, 'this spec recomputes the credit side').toBe(AMOUNT);
        expect(Number(entry.total_debit)).toBe(sumDebit);
        expect(Number(entry.total_credit)).toBe(sumCredit);
        const debit = lines.find(l => Number(l.debit_amount) === AMOUNT);
        const credit = lines.find(l => Number(l.credit_amount) === AMOUNT);
        expect(String(debit?.account_code), 'fertilizer category maps to 5162').toBe(DR_CODE);
        expect(String(credit?.account_code), 'operator-paid expense credits cash on hand 1010').toBe(CR_CODE);
        // With no crop cycle attached, provenance is the expense id itself (contrast with D6).
        expect(lines.map(l => String(l.module_source_id)).sort(),
            'unlinked expense keeps its own id on the GL line').toEqual([expense.id, expense.id].sort());

        // Independent of the app's own totals: the entry must balance to the centavo.
        expect(Math.abs(sumDebit - sumCredit)).toBeLessThan(0.01);
        expect(await countRows(page, 'agri_farm_expenses')).toBe(beforeExpenses + 1);
    });

    test('CHARACTERIZES D9 (fails once fixed): editing the expense leaves the ledger at the old amount', async ({ page }) => {
        await loginAsAdmin(page);
        await seedPostableAccounts(page);
        await openExpenseModal(page);
        await fillExpense(page, DESC, AMOUNT);
        await page.getByText('Save Expense', { exact: true }).first().click();
        await expect(page.getByPlaceholder('e.g. 10 bags Complete 14-14-14 Fertilizer')).toHaveCount(0, { timeout: 30000 });

        const card = await expenseCard(page, DESC);
        await reportCardAffordances(card);
        // The affordances exist and are reachable only through their NativeWind hover class
        // (M3). Anything less specific than this cannot address them on the web build.
        await expect(editAffordance(card), 'the edit affordance must be present on the card').toBeVisible();
        await editAffordance(card).click();
        await expect(page.getByText('Edit Farm Expense', { exact: true })).toBeVisible({ timeout: 30000 });
        await fillExpense(page, DESC_EDITED, AMOUNT_EDITED);
        await page.getByText('Update Expense', { exact: true }).first().click();
        await expect(page.getByText('Edit Farm Expense', { exact: true })).toHaveCount(0, { timeout: 30000 });

        const edited = (await readAll(page, 'agri_farm_expenses')).filter(r => r.id && r.description === DESC_EDITED);
        expect(edited.length, 'the update must persist to storage').toBe(1);
        expect(Number(edited[0].amount)).toBe(AMOUNT_EDITED);

        // D9, pinned as observed: the GL is never told about the edit. One entry, still at the
        // pre-edit amount, while the expense row says something else. This assertion flips to a
        // failure the moment the app gains a reversal/re-post on update - that is the intent.
        const entries = (await readAll(page, 'journal_entries')).filter(r => r.source_id === edited[0].id);
        expect(entries.length, 'D9: an edit adds neither a reversal nor a second entry').toBe(1);
        expect(Number(entries[0].total_debit),
            `D9: the ledger keeps the pre-edit amount (${AMOUNT}) while the row says ${AMOUNT_EDITED}`).toBe(AMOUNT);
        const lines = (await readAll(page, 'journal_entry_lines')).filter(r => r.journal_entry_id === entries[0].id);
        expect(lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0),
            'D9: the posted debit side disagrees with the stored expense amount').toBe(AMOUNT);
    });

    test('CHARACTERIZES D4 (fails once fixed): a blank description is rejected in silence and delete is unreachable', async ({ page }) => {
        await loginAsAdmin(page);
        await seedPostableAccounts(page);
        await openExpenseModal(page);
        const before = await countRows(page, 'agri_farm_expenses');

        await fillExpense(page, '   ', AMOUNT);
        await page.getByText('Save Expense', { exact: true }).first().click();
        await page.waitForTimeout(1500);

        expect(await countRows(page, 'agri_farm_expenses'), 'blank description must never be stored').toBe(before);
        await expect(page.getByPlaceholder('e.g. 10 bags Complete 14-14-14 Fertilizer')).toBeVisible();
        expect(await page.evaluate(() => document.body.innerText.includes('Please enter a description')),
            'D4: the Alert.alert validation text is invisible on the web build').toBe(false);

        // Same root cause for the destructive path: the confirm dialog never renders, so Delete cannot run.
        await fillExpense(page, DESC, AMOUNT);
        await page.getByText('Save Expense', { exact: true }).first().click();
        await expect(page.getByPlaceholder('e.g. 10 bags Complete 14-14-14 Fertilizer')).toHaveCount(0, { timeout: 30000 });
        const stored = (await readAll(page, 'agri_farm_expenses')).filter(r => r.description === DESC);
        expect(stored.length).toBe(1);

        const card = await expenseCard(page, DESC);
        await expect(deleteAffordance(card), 'the delete affordance must be present on the card').toBeVisible();
        await deleteAffordance(card).click();
        await page.waitForTimeout(1500);
        expect(await page.evaluate(() => document.body.innerText.includes('Confirm Delete')),
            'D4: the delete confirmation never appears on the web build').toBe(false);
        expect((await readAll(page, 'agri_farm_expenses')).filter(r => r.description === DESC).length,
            'D4: with no confirmation, the row can be neither deleted nor intentionally kept through the UI').toBe(1);
    });
});

test.describe('Farm Labor: worker -> task log with independent wage arithmetic', () => {
    test('registers a worker, logs a task, and the stored pay equals units x rate recomputed here', async ({ page }) => {
        await loginAsAdmin(page);
        const beforeWorkers = await countRows(page, 'agri_farm_workers');
        const beforeLogs = await countRows(page, 'agri_labor_logs');

        await safeNavigate(page, LABOR_ROUTE, LABOR_ANCHOR);
        await page.getByText('Add Worker', { exact: true }).first().click();
        await page.getByPlaceholder('e.g. Juan dela Cruz').fill(WORKER);
        await page.getByPlaceholder('0917-XXX-XXXX').fill('0917-555-0'+stamp.slice(0, 3));
        await page.getByPlaceholder('Harvester, Tractor Operator, Weeder').fill('Weeder');
        await page.getByPlaceholder('450').fill(String(DAILY_RATE));
        await page.getByText('Save Worker', { exact: true }).first().click();
        await expect(page.getByPlaceholder('e.g. Juan dela Cruz')).toHaveCount(0, { timeout: 30000 });

        const workers = (await readAll(page, 'agri_farm_workers')).filter(r => r.name === WORKER);
        expect(workers.length, 'worker row must exist in storage').toBe(1);
        expect(Number(workers[0].daily_rate)).toBe(DAILY_RATE);
        expect(await countRows(page, 'agri_farm_workers')).toBe(beforeWorkers + 1);

        await page.getByText('Log Work Task', { exact: true }).first().click();
        await expect(page.getByPlaceholder('e.g. Harvesting & Root Pulling')).toBeVisible({ timeout: 30000 });
        // The modal pre-selects the first worker and copies their daily rate (labor.tsx:161-164).
        await expect(page.getByText(WORKER, { exact: true }).first()).toBeVisible();
        await page.getByPlaceholder('e.g. Harvesting & Root Pulling').fill(TASK);
        await page.getByPlaceholder('1').fill(String(UNITS));
        await page.getByPlaceholder('450').last().fill(String(DAILY_RATE));
        await expect(page.getByText('PHP 1,350.00')).toBeVisible();
        await page.getByText('Record Task', { exact: true }).first().click();
        await expect(page.getByPlaceholder('e.g. Harvesting & Root Pulling')).toHaveCount(0, { timeout: 30000 });

        const logs = (await readAll(page, 'agri_labor_logs')).filter(r => r.task === TASK);
        expect(logs.length, 'labor log must exist in storage').toBe(1);
        const log = logs[0];
        expect(Number(log.units_completed)).toBe(UNITS);
        expect(Number(log.rate_per_unit)).toBe(DAILY_RATE);
        expect(Number(log.total_pay), 'stored pay must equal this spec\'s own 3 x 450').toBe(EXPECTED_PAY);
        expect(String(log.worker_id), 'the log must belong to the worker that was registered').toBe(workers[0].id);
        expect(String(log.payment_status)).toBe('pending');
        expect(log.deleted_at).toBeNull();
        expect(await countRows(page, 'agri_labor_logs')).toBe(beforeLogs + 1);
        expect(await redBoxVisible(page), 'logging a task must not crash the app').toBe(false);
    });

    test('CHARACTERIZES D4 (fails once fixed): a task with no worker selected is refused with no feedback at all', async ({ page }) => {
        await loginAsAdmin(page);
        const before = await countRows(page, 'agri_labor_logs');
        const workers = await countRows(page, 'agri_farm_workers');
        test.skip(workers > 0, 'this case needs a labour screen with no worker to pre-select');

        await safeNavigate(page, LABOR_ROUTE, LABOR_ANCHOR);
        await page.getByText('Log Work Task', { exact: true }).first().click();
        await expect(page.getByPlaceholder('e.g. Harvesting & Root Pulling')).toBeVisible({ timeout: 30000 });
        await page.getByPlaceholder('e.g. Harvesting & Root Pulling').fill(`E2E Orphan Task ${stamp}`);
        await page.getByText('Record Task', { exact: true }).first().click();
        await page.waitForTimeout(1500);

        expect(await countRows(page, 'agri_labor_logs'), 'a task without a worker must not be stored').toBe(before);
        await expect(page.getByPlaceholder('e.g. Harvesting & Root Pulling')).toBeVisible();
        expect(await page.evaluate(() => document.body.innerText.includes('Please select a worker')),
            'D4: the only feedback is an invisible Alert.alert').toBe(false);
    });
});
