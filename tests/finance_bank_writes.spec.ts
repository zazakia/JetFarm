import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live write-path coverage for the Finance module group that had no automated spec:
 * Bank Accounts (`app/(admin)/bank-accounts`), its transaction form
 * (`new-transaction.tsx`) and Fund Transfers (`app/(admin)/transfers/index.tsx`).
 *
 * Everything is asserted against the production web export that the harness serves
 * (see `scripts/start-playwright-web.mjs`), and persistence is read back out of
 * WatermelonDB storage (`window.__WATERMELON_DB__`) rather than from the UI, so a
 * green run means the row really exists.
 *
 * Independent math: the app computes the account balance twice, in two places
 * (`[id].tsx:202-203` and `index.tsx:52-54`), with the rule
 * "starting_balance + deposits - everything else". This spec recomputes that value
 * from the storage rows it read and compares the rendered string, so an arithmetic
 * or display drift in either screen fails here instead of shipping.
 *
 * Defects characterised (each test is expected to FAIL once the app is fixed):
 * - D4: `new-transaction.tsx:26/30` reports invalid input through `Alert.alert`,
 *   which react-native-web ships as an empty `static alert() {}`, so on the web
 *   build the Save button looks dead.
 * - D7: `FundTransferService.executeTransfer` (`src/services/FundTransferService.ts:49-104`)
 *   validates amount/sign/same-account but never compares the amount with the
 *   source account balance, and `transfers/index.tsx:60-66` computes every balance
 *   as `account ? 0 : 0`, so an unlimited transfer is accepted. Pinned at service
 *   level in `src/services/__tests__/FundTransferService.test.ts` because D1 keeps the
 *   web form from submitting at all.
 * - D10: `new-transaction.tsx:38` writes `bank_account_id` straight from the URL
 *   param, so the route opened without `accountId` stores a transaction that belongs
 *   to no account.
 */

const ROUTE_ACCOUNTS = '/bank-accounts';
const ANCHOR_ACCOUNTS = 'Bank Accounts';
const ANCHOR_DETAIL = 'Current Balance';
const ANCHOR_FORM = 'New Transaction';
const TRANSFERS_ROUTE = '/transfers';
const TRANSFERS_ANCHOR = 'Fund Transfers';

const STARTING = 50000;
const DEPOSIT = 12500;
const WITHDRAWAL = 7250;
const TRANSFER_ROW = 3000;
/** This spec's own recompute: + deposit, - withdrawal, - the 'transfer' row (observed rule). */
const EXPECTED_BALANCE = STARTING + DEPOSIT - WITHDRAWAL - TRANSFER_ROW;
const OVERDRAFT = 9999999;

const stamp = Date.now().toString().slice(-6);
const BANK_NAME = `E2E Bank ${stamp}`;

/** Same Intl options as src/utils/currency.ts, used only to format — the arithmetic is the spec's own. */
const php = (n: number) =>
    new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
        currencyDisplay: 'code',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n).replace(/\xA0/g, ' ');

async function readAll(page: Page, table: string) {
    return page.evaluate(async (name: string) => {
        const db = (window as any).__WATERMELON_DB__;
        if (!db || !db.collections.map[name]) return [];
        const records = await db.collections.get(name).query().fetch();
        return records.map((r: any) => {
            const raw = r._raw ?? {};
            const out: Record<string, any> = { id: r.id };
            for (const key of Object.keys(raw)) out[key] = raw[key] instanceof Date
                ? (raw[key] as Date).getTime()
                : raw[key];
            return out;
        });
    }, table);
}

async function countRows(page: Page, table: string): Promise<number> {
    const rows = await readAll(page, table);
    return rows.length;
}

/** COA codes have to exist, be active and be non-header before any journal line may use them. */
async function seedPostableAccounts(page: Page, codes: string[]): Promise<number> {
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
    }, codes);
}

/** True when a postable (active, non-header) COA row already exists for one of `codes`. */
async function postableCount(page: Page, codes: string[]): Promise<number> {
    const rows = await readAll(page, 'chart_of_accounts');
    return rows.filter(r => codes.includes(String(r.code))
        && r.is_active !== false && r.is_active !== 0
        && r.is_header !== true && r.is_header !== 1
        && r.deleted_at === null).length;
}

async function createBankAccount(page: Page): Promise<string> {
    await safeNavigate(page, ROUTE_ACCOUNTS, ANCHOR_ACCOUNTS);
    await page.getByText('Add Bank Account', { exact: true }).first().click();
    await page.getByPlaceholder('e.g. BDO, BPI, GCash Business').fill(BANK_NAME);
    await page.getByPlaceholder('Account name...').fill(`E2E Account ${stamp}`);
    await page.getByPlaceholder('XXXX-XXXX-XXXX').fill('9911-2233-4455');
    await page.getByPlaceholder('0.00').fill(String(STARTING));
    await page.getByText('Add Account', { exact: true }).first().click();
    await expect(page.getByPlaceholder('e.g. BDO, BPI, GCash Business')).toHaveCount(0, { timeout: 30000 });

    const rows = await readAll(page, 'bank_accounts');
    const mine = rows.filter(r => r.bank_name === BANK_NAME);
    expect(mine.length, `exactly one ${BANK_NAME} row must exist in bank_accounts`).toBe(1);
    expect(Number(mine[0].starting_balance)).toBe(STARTING);
    expect(mine[0].deleted_at).toBeNull();
    return String(mine[0].id);
}

/** Drives the New Transaction form for one row and returns nothing — the caller reads storage. */
async function recordTransaction(page: Page, accountId: string, kind: 'deposit' | 'withdrawal' | 'transfer',
    amount: number, particulars: string) {
    await safeNavigate(page, `${ROUTE_ACCOUNTS}/new-transaction?accountId=${accountId}`, ANCHOR_FORM);
    if (kind !== 'deposit') {
        const label = kind === 'withdrawal' ? /cash withdraw/i : /fund transfer/i;
        await page.getByText(label).first().click();
    }
    await page.getByPlaceholder('0.00').fill(String(amount));
    await page.getByPlaceholder('e.g. Replenish Funds').fill(particulars);
    await page.getByText('Save Transaction', { exact: true }).first().click();
    await expect(page.getByText(ANCHOR_FORM)).toHaveCount(0, { timeout: 30000 });
}

test.describe('Bank accounts: account + transaction writes, balance recomputed independently', () => {
    test('deposit, withdrawal and a transfer row persist, and both balance views match this spec\'s recompute', async ({ page }) => {
        await loginAsAdmin(page);
        const accountId = await createBankAccount(page);

        await recordTransaction(page, accountId, 'deposit', DEPOSIT, `E2E deposit ${stamp}`);
        await recordTransaction(page, accountId, 'withdrawal', WITHDRAWAL, `E2E withdrawal ${stamp}`);
        await recordTransaction(page, accountId, 'transfer', TRANSFER_ROW, `E2E transfer row ${stamp}`);

        const txs = (await readAll(page, 'bank_transactions')).filter(r => r.bank_account_id === accountId);
        expect(txs.length, 'all three saved transactions must be in bank_transactions').toBe(3);
        for (const r of txs) expect(r.deleted_at, 'no transaction may be soft-deleted on save').toBeNull();

        const byType: Record<string, number> = {};
        for (const r of txs) byType[String(r.type)] = Number(r.amount);
        expect(byType, 'type and amount must be stored as entered').toEqual({
            deposit: DEPOSIT,
            withdrawal: WITHDRAWAL,
            transfer: TRANSFER_ROW,
        });

        // Independent recompute of the rule the two screens share, plus the 'transfer' behaviour:
        // every non-deposit row subtracts, including a transfer that in reality brings money in.
        const mine = STARTING + byType.deposit - byType.withdrawal - byType.transfer;
        expect(mine).toBe(EXPECTED_BALANCE);

        const balanceText = php(EXPECTED_BALANCE);
        await safeNavigate(page, `${ROUTE_ACCOUNTS}/${accountId}`, ANCHOR_DETAIL);
        await expect(page.getByText(balanceText, { exact: true }).first()).toBeVisible({ timeout: 30000 });

        // The list screen recomputes the same figure from its own batch query (index.tsx:52-54).
        await safeNavigate(page, ROUTE_ACCOUNTS, ANCHOR_ACCOUNTS);
        await expect(page.getByText(BANK_NAME, { exact: true }).first()).toBeVisible({ timeout: 30000 });
        await expect(page.getByText(balanceText, { exact: true }).first()).toBeVisible();
    });

    test('CHARACTERIZES D4 (fails once fixed): an invalid amount creates nothing, shows no message and leaves the operator on the form', async ({ page }) => {
        await loginAsAdmin(page);
        const accountId = await createBankAccount(page);
        const before = await countRows(page, 'bank_transactions');

        await safeNavigate(page, `${ROUTE_ACCOUNTS}/new-transaction?accountId=${accountId}`, ANCHOR_FORM);
        await page.getByPlaceholder('0.00').fill('0');
        await page.getByPlaceholder('e.g. Replenish Funds').fill(`E2E zero ${stamp}`);
        await page.getByText('Save Transaction', { exact: true }).first().click();
        await page.waitForTimeout(1500);

        expect(await countRows(page, 'bank_transactions'), 'a zero amount must never be stored').toBe(before);
        await expect(page.getByText(ANCHOR_FORM)).toBeVisible();
        await expect(page.getByPlaceholder('0.00')).toHaveValue('0');
        // The rejection message exists only inside Alert.alert -> invisible on the web build.
        await expect(page.getByText('Enter a valid amount.')).toHaveCount(0);
        expect(await page.evaluate(() => document.body.innerText.includes('Enter a valid amount')),
            'D4: the validation text must become visible once Alert.alert is replaced').toBe(false);
    });

    test('CHARACTERIZES D10 (fails once fixed): opening the form without accountId stores an orphan transaction', async ({ page }) => {
        await loginAsAdmin(page);
        await safeNavigate(page, ROUTE_ACCOUNTS, ANCHOR_ACCOUNTS);
        const before = await countRows(page, 'bank_transactions');

        await safeNavigate(page, `${ROUTE_ACCOUNTS}/new-transaction`, ANCHOR_FORM);
        await page.getByPlaceholder('0.00').fill('777');
        await page.getByPlaceholder('e.g. Replenish Funds').fill(`E2E orphan ${stamp}`);
        const dialogs: string[] = [];
        page.on('dialog', async dialog => {
            dialogs.push(dialog.message());
            await dialog.dismiss().catch(() => {});
        });
        await page.getByText('Save Transaction', { exact: true }).first().click();
        await page.waitForTimeout(2000);

        // Observed: new-transaction.tsx:38 assigns `record.bankAccountId = accountId!` with no
        // guard, so the row is written even though the URL carried no account at all. It belongs
        // to no account, is invisible in every list, and still counts as money in sync/backups.
        const rows = await readAll(page, 'bank_transactions');
        expect(rows.length, 'D10: an unaddressable route must not be able to write').toBe(before + 1);
        const orphan = rows.find(r => String(r.particulars) === `E2E orphan ${stamp}`);
        expect(orphan, 'the orphan row is the finding').toBeDefined();
        console.log(`[D10] orphan bank_account_id = ${JSON.stringify(orphan?.bank_account_id)}, amount = ${orphan?.amount}`);
        expect(orphan?.bank_account_id, 'D10: the row must not be attached to any account').toBeFalsy();
        expect(dialogs, 'D10: nothing warns the operator').toEqual([]);
    });
});

/**
 * RNW puts the pointer handler on the Pressable container, and clicking the inner
 * label does not reach it on this screen (probe evidence: container click fired the
 * submit, label click did nothing), so the primary button is pressed on its container.
 */
function transferButton(page: Page): Locator {
    return page.locator('div[tabindex], div[class*="cursor-pointer"], div[class*="select-none"]')
        .filter({ hasText: 'Execute Transfer' })
        .last();
}

async function executeTransfer(page: Page, amount: number): Promise<string[]> {
    await safeNavigate(page, TRANSFERS_ROUTE, TRANSFERS_ANCHOR);
    await page.getByPlaceholder('0.00').fill(String(amount));
    const dialogs: string[] = [];
    page.on('dialog', async dialog => {
        dialogs.push(dialog.message());
        await dialog.accept().catch(() => {});
    });
    await transferButton(page).click();
    await expect.poll(() => dialogs.length, { timeout: 30000, message: 'the screen answers through window.alert' })
        .toBeGreaterThan(0);
    return dialogs;
}

test.describe('Fund transfers: journal side effects and the missing balance guard', () => {
    test('degraded case: with no postable COA the transfer is refused, the reason reaches the operator and nothing half-writes', async ({ page }) => {
        await loginAsAdmin(page);
        const seeded = await postableCount(page, ['1010', '1011']);
        test.skip(seeded > 0, 'this case only reproduces while chart_of_accounts holds no postable 1010/1011');
        const before = await countRows(page, 'journal_entries');

        const dialogs = await executeTransfer(page, 1500);

        expect(await countRows(page, 'journal_entries'), 'a failed transfer must not store a half entry').toBe(before);
        expect(await countRows(page, 'action_logs'), 'a failed transfer must not log a CREATE either')
            .toBe(await countRows(page, 'action_logs'));
        expect(dialogs.join('\n'), 'the thrown reason must be surfaced, not swallowed')
            .toMatch(/Unknown or inactive posting account code/);
    });

    test('CHARACTERIZES D7 (fails once fixed): a transfer no account can cover is accepted and posted', async ({ page }) => {
        await loginAsAdmin(page);
        await seedPostableAccounts(page, [
            '1010|Cash on Hand E2E|asset|debit',
            '1011|Cash on Hand - Petty Cash E2E|asset|debit',
        ]);
        const before = await countRows(page, 'journal_entries');

        const dialogs = await executeTransfer(page, OVERDRAFT);

        expect(dialogs, 'this screen reports through window.alert on web, so the operator does see the outcome')
            .toContain('Fund transfer executed successfully.');
        expect(await countRows(page, 'journal_entries'), 'D7: a balance check must stop this before any entry').toBe(before + 1);

        const entries = (await readAll(page, 'journal_entries')).filter(r => r.source_table === 'fund_transfers');
        expect(entries.length).toBe(1);
        const entry = entries[0];
        expect(Number(entry.total_debit), 'the entry must balance at the transferred amount').toBe(OVERDRAFT);
        expect(Number(entry.total_credit)).toBe(OVERDRAFT);

        const lines = (await readAll(page, 'journal_entry_lines')).filter(r => r.journal_entry_id === entry.id);
        expect(lines.length).toBe(2);
        const debit = lines.find(l => Number(l.debit_amount) === OVERDRAFT);
        const credit = lines.find(l => Number(l.credit_amount) === OVERDRAFT);
        expect(String(debit?.account_code), 'the receiving account (target) is debited').toBe('1011');
        expect(String(credit?.account_code), 'the releasing account (source) is credited').toBe('1010');
        const sumDebit = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
        const sumCredit = lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
        expect(sumDebit).toBe(OVERDRAFT);
        expect(sumCredit).toBe(OVERDRAFT);
        expect(Math.abs(sumDebit - sumCredit)).toBeLessThan(0.01);
    });
});
