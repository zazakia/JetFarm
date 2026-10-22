import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live write-path coverage for the Accounting & General Ledger module group, which had no
 * automated browser spec: Chart of Accounts (`app/(admin)/accounting/chart-of-accounts.tsx`)
 * and the manual Journal Entry form (`app/(admin)/accounting/journal-entries.tsx`).
 *
 * Everything is asserted from WatermelonDB storage (`window.__WATERMELON_DB__`) after the UI
 * action, and the money totals are re-summed by this spec rather than trusted from the screen.
 *
 * These two screens validate with plain `if (...)` guards plus `Alert.alert`, NOT with
 * zodResolver, so unlike the six regime-A forms (D1) an invalid submission here is refused
 * without throwing. What is still missing is the message: `Alert.alert` is a no-op in
 * react-native-web 0.21.2 (D4), so a refusal looks identical to a dead button.
 *
 * Characterised defects (assertions pin behaviour as observed; they FAIL once the app is fixed):
 * - D4  `chart-of-accounts.tsx:51/67/82/87` and `journal-entries.tsx:75/121/138/150/162`
 *   report every outcome - validation, success, duplicate code, delete and reversal
 *   confirmation - only through `Alert.alert`.
 * - D11 (new) `chart-of-accounts.tsx:82` swallows the duplicate-code rejection raised at
 *   `src/services/ChartOfAccountsService.ts:269-272`: the modal stays open with the same
 *   values and the operator is told nothing.
 * - Reversal (`journal-entries.tsx:276-282`) is unreachable on web for the same D4 reason,
 *   so a mis-posted manual entry cannot be corrected at all through the UI.
 */

const COA_ROUTE = '/accounting/chart-of-accounts';
const COA_ANCHOR = 'Assets (1000s)';
const JE_ROUTE = '/accounting/journal-entries';
const JE_ANCHOR = 'Posted Journal Entries';

const stamp = String(Date.now()).slice(-6);
const DR_CODE = '6911';
const CR_CODE = '1099';
const DR_NAME = `E2E Debit Account ${stamp}`;
const CR_NAME = `E2E Credit Account ${stamp}`;
const MEMO = `E2E manual accrual ${stamp}`;
const AMOUNT = 3300;

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

async function bodyText(page: Page): Promise<string> {
    return page.evaluate(() => document.body?.innerText || '');
}

async function redBoxVisible(page: Page): Promise<boolean> {
    return /Uncaught Error|Application Error|something went wrong/i.test(await bodyText(page));
}

/**
 * react-native-web puts the handler on the Pressable container; this is the same lesson that
 * the transfers screen taught (§3f), applied defensively to every button on these screens.
 * Every button on both screens carries an `active:bg-*` class, which is what identifies the
 * container (the label inside is a plain text node with no testID or role - M3).
 */
function pressable(page: Page, label: string | RegExp): Locator {
    return page.locator('div[tabindex], div[class*="cursor-pointer"], div[class*="select-none"], div[class*="active:bg"]')
        .filter({ hasText: label })
        .last();
}

async function openCoaModal(page: Page): Promise<void> {
    await safeNavigate(page, COA_ROUTE, COA_ANCHOR);
    // testID survives the production export (mapping specs already rely on data-testid).
    const addBtn = page.getByTestId('add-account-btn');
    await expect(addBtn, 'the Chart of Accounts toolbar exposes testID="add-account-btn"').toBeVisible({ timeout: 30000 });
    await addBtn.click();
    await expect(page.getByText('Add New Account', { exact: true })).toBeVisible();
}

async function fillAccount(page: Page, code: string, name: string, type: RegExp, balance: RegExp): Promise<void> {
    await page.getByPlaceholder('e.g. 1011 (Philippine Standard)').fill(code);
    await page.getByPlaceholder('e.g. Cash in Box').fill(name);
    await pressable(page, type).click();
    await pressable(page, balance).click();
}

/** Create one account through the real UI and wait until the modal closes (success path). */
async function createAccount(page: Page, code: string, name: string, type: RegExp, balance: RegExp): Promise<void> {
    await openCoaModal(page);
    await fillAccount(page, code, name, type, balance);
    await pressable(page, 'Create Account').click();
    await expect(page.getByText('Add New Account', { exact: true })).toHaveCount(0, { timeout: 30000 });
}

async function postManualEntry(page: Page, memo: string): Promise<void> {
    await safeNavigate(page, JE_ROUTE, JE_ANCHOR);
    await pressable(page, 'New Manual Entry').click();
    await expect(page.getByText('New Manual Journal Entry', { exact: true })).toBeVisible({ timeout: 30000 });
    await page.getByPlaceholder('e.g. Adjusting entry for depreciation').fill(memo);

    // One account chip per line, in line order (the modal opens with exactly two lines).
    await page.locator('div[class*="rounded-full"]').filter({ hasText: `${DR_CODE} - ` }).first().click();
    await page.locator('div[class*="rounded-full"]').filter({ hasText: `${CR_CODE} - ` }).nth(1).click();

    const amounts = page.getByPlaceholder('0.00');
    await expect(amounts, 'two lines x (debit, credit)').toHaveCount(4);
    await amounts.nth(0).fill(String(AMOUNT));   // line 1 debit
    await amounts.nth(3).fill(String(AMOUNT));   // line 2 credit
    await expect(page.getByText(/^Balanced$/i), 'the screen must report the entry as balanced')
        .toBeVisible();
    await pressable(page, 'Post Entry').click();
    await expect(page.getByText('New Manual Journal Entry', { exact: true })).toHaveCount(0, { timeout: 30000 });
}

test.describe('Chart of Accounts: create through the UI, verified from storage', () => {
    test('creates an account row and an audit-trail entry for it', async ({ page }) => {
        await loginAsAdmin(page);
        const beforeAccounts = await countRows(page, 'chart_of_accounts');
        const beforeLogs = await countRows(page, 'action_logs');

        await createAccount(page, DR_CODE, DR_NAME, /^expense$/i, /^debit$/i);

        expect(await redBoxVisible(page), 'creating an account must not crash the app').toBe(false);
        const rows = (await readAll(page, 'chart_of_accounts')).filter(r => String(r.code) === DR_CODE);
        expect(rows.length, 'exactly one row for the typed code').toBe(1);
        const acct = rows[0];
        expect(String(acct.name)).toBe(DR_NAME);
        expect(String(acct.account_type)).toBe('expense');
        expect(String(acct.normal_balance)).toBe('debit');
        expect(Boolean(acct.is_header), 'default is a postable account, not a header').toBe(false);
        expect(Boolean(acct.is_active)).toBe(true);
        expect(acct.parent_code ?? null, 'no parent typed').toBeNull();
        expect(acct.deleted_at, 'a created account is not soft-deleted').toBeNull();
        expect(await countRows(page, 'chart_of_accounts')).toBe(beforeAccounts + 1);

        // Cross-module: ChartOfAccountsService.create logs to the audit trail
        // (src/services/ChartOfAccountsService.ts:290-295), so the write is traceable.
        const logs = (await readAll(page, 'action_logs')).filter(l =>
            String(l.entity_type) === 'chart_of_accounts' && String(l.entity_id) === acct.id && String(l.action) === 'CREATE');
        expect(logs.length, 'the create must appear in action_logs').toBe(1);
        expect(await countRows(page, 'action_logs')).toBe(beforeLogs + 1);
        const snapshot = JSON.parse(String(logs[0].new_data));
        expect(String(snapshot.code), 'the audit snapshot must carry the same code').toBe(DR_CODE);
    });

    test('CHARACTERIZES D11 + D4 (fails once fixed): a duplicate code is refused in silence', async ({ page }) => {
        await loginAsAdmin(page);
        await createAccount(page, DR_CODE, DR_NAME, /^expense$/i, /^debit$/i);
        const afterFirst = await countRows(page, 'chart_of_accounts');

        // Second submission with the same code: ChartOfAccountsService.create throws
        // `Account code "6911" already exists.` and the screen routes it into Alert.alert.
        await openCoaModal(page);
        await fillAccount(page, DR_CODE, `${DR_NAME} duplicate`, /^income$/i, /^credit$/i);
        const dialogs: string[] = [];
        page.on('dialog', async d => { dialogs.push(d.message()); await d.accept().catch(() => {}); });
        await pressable(page, 'Create Account').click();
        await page.waitForTimeout(2000);

        expect(await countRows(page, 'chart_of_accounts'), 'the duplicate must not be stored').toBe(afterFirst);
        const rows = (await readAll(page, 'chart_of_accounts')).filter(r => String(r.code) === DR_CODE);
        expect(rows.length, 'still exactly one account under that code').toBe(1);
        expect(String(rows[0].name), 'the rejected edit must not have overwritten the original').toBe(DR_NAME);
        expect(await redBoxVisible(page), 'the thrown service error must be caught, not crash the app').toBe(false);

        const text = await bodyText(page);
        expect(dialogs.length, 'D4: Alert.alert is a web no-op, so nothing reaches the operator').toBe(0);
        expect(text.includes('already exists'), 'D11: the duplicate reason never renders').toBe(false);
        await expect(page.getByText('Add New Account', { exact: true }),
            'the modal stays open with the rejected values').toBeVisible();
    });

    test('CHARACTERIZES D4 (fails once fixed): a missing name is refused in silence', async ({ page }) => {
        await loginAsAdmin(page);
        const before = await countRows(page, 'chart_of_accounts');
        const dialogs: string[] = [];
        page.on('dialog', async d => { dialogs.push(d.message()); await d.accept().catch(() => {}); });

        await openCoaModal(page);
        await page.getByPlaceholder('e.g. 1011 (Philippine Standard)').fill(CR_CODE);
        await pressable(page, 'Create Account').click();
        await page.waitForTimeout(2000);

        expect(await countRows(page, 'chart_of_accounts'), 'code without name must not be stored').toBe(before);
        expect(await redBoxVisible(page), 'refusal must not crash the app').toBe(false);
        expect(dialogs.length, 'D4: the "fill in both" message is an invisible Alert.alert').toBe(0);
        expect((await bodyText(page)).includes('Please fill in both'),
            'D4: no validation text reaches the screen').toBe(false);
    });

    test('delete is unreachable: the confirmation never renders', async ({ page }) => {
        await loginAsAdmin(page);
        await createAccount(page, DR_CODE, DR_NAME, /^expense$/i, /^debit$/i);

        await safeNavigate(page, COA_ROUTE, COA_ANCHOR);
        const delBtn = page.getByTestId(`delete-${DR_CODE}`);
        await expect(delBtn, 'the row offers a testID delete control').toBeVisible({ timeout: 30000 });
        const dialogs: string[] = [];
        page.on('dialog', async d => { dialogs.push(d.message()); await d.accept().catch(() => {}); });
        await delBtn.click();
        await page.waitForTimeout(2000);

        expect(dialogs.length, 'D4: no native dialog either').toBe(0);
        expect((await bodyText(page)).includes('Confirm Delete'),
            'D4: the delete confirmation never appears, so no account can be deleted on web').toBe(false);
        const rows = (await readAll(page, 'chart_of_accounts')).filter(r => String(r.code) === DR_CODE);
        expect(rows.length, 'the row can be neither deleted nor intentionally kept through the UI').toBe(1);
        expect(rows[0].deleted_at, 'and it is not soft-deleted').toBeNull();
    });
});

test.describe('Manual journal entries: post, balance guard, reversal', () => {
    test('posts a balanced manual entry whose totals this spec recomputes', async ({ page }) => {
        await loginAsAdmin(page);
        await createAccount(page, DR_CODE, DR_NAME, /^expense$/i, /^debit$/i);
        await createAccount(page, CR_CODE, CR_NAME, /^liability$/i, /^credit$/i);
        const beforeEntries = await countRows(page, 'journal_entries');

        await postManualEntry(page, MEMO);

        expect(await redBoxVisible(page), 'posting must not crash the app').toBe(false);
        const entries = (await readAll(page, 'journal_entries')).filter(r => String(r.description) === MEMO);
        expect(entries.length, 'exactly one manual entry').toBe(1);
        const entry = entries[0];
        expect(String(entry.entry_type)).toBe('manual');
        expect(Boolean(entry.is_posted), 'a posted entry must be flagged posted').toBe(true);
        expect(entry.deleted_at).toBeNull();
        expect(String(entry.posted_by)).toBe('System');

        const lines = (await readAll(page, 'journal_entry_lines')).filter(l => l.journal_entry_id === entry.id);
        expect(lines.length, 'two lines, as submitted').toBe(2);
        const sumDebit = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
        const sumCredit = lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
        expect(sumDebit, 'spec-side debit sum').toBe(AMOUNT);
        expect(sumCredit, 'spec-side credit sum').toBe(AMOUNT);
        expect(Math.abs(sumDebit - sumCredit), 'balanced to the centavo').toBeLessThan(0.01);
        expect(Number(entry.total_debit), 'the stored debit total must match the lines').toBe(sumDebit);
        expect(Number(entry.total_credit), 'the stored credit total must match the lines').toBe(sumCredit);
        expect(String(lines.find(l => Number(l.debit_amount) > 0)?.account_code)).toBe(DR_CODE);
        expect(String(lines.find(l => Number(l.credit_amount) > 0)?.account_code)).toBe(CR_CODE);
        expect(await countRows(page, 'journal_entries')).toBe(beforeEntries + 1);

        // The list screen must show the same entry it just wrote (R path, rendered).
        await safeNavigate(page, JE_ROUTE, JE_ANCHOR);
        await expect(page.getByText(MEMO, { exact: true }).first()).toBeVisible({ timeout: 30000 });
    });

    test('refuses an unbalanced entry: the badge warns and the button is disabled', async ({ page }) => {
        await loginAsAdmin(page);
        await createAccount(page, DR_CODE, DR_NAME, /^expense$/i, /^debit$/i);
        await createAccount(page, CR_CODE, CR_NAME, /^liability$/i, /^credit$/i);
        const before = await countRows(page, 'journal_entries');

        await safeNavigate(page, JE_ROUTE, JE_ANCHOR);
        await pressable(page, 'New Manual Entry').click();
        await page.getByPlaceholder('e.g. Adjusting entry for depreciation').fill(`E2E unbalanced ${stamp}`);
        await page.locator('div[class*="rounded-full"]').filter({ hasText: `${DR_CODE} - ` }).first().click();
        await page.getByPlaceholder('0.00').nth(0).fill(String(AMOUNT));

        // Screen-derived guard, independent of Alert: the summary says Out of Balance
        // (journal-entries.tsx:168) and Post Entry is disabled (:427).
        await expect(page.getByText(/out of balance/i), 'the balance badge must warn')
            .toBeVisible();
        const post = pressable(page, 'Post Entry');
        console.log('[je-guard] post entry attrs: ' + JSON.stringify(await post.evaluate((el: any) => ({
            ariaDisabled: el.getAttribute('aria-disabled'),
            disabled: (el as HTMLButtonElement).disabled ?? null,
            className: el.getAttribute('class'),
        }))));
        await post.click({ force: true }).catch(async () => {
            // RNW may put the disabled flag on the wrapper rather than the matched node.
            await page.getByText('Post Entry', { exact: true }).click({ force: true });
        });
        await page.waitForTimeout(1500);
        expect(await countRows(page, 'journal_entries'), 'an unbalanced entry must not be written').toBe(before);
        expect(await redBoxVisible(page), 'the guard must not crash').toBe(false);
        await expect(page.getByText('New Manual Journal Entry', { exact: true }),
            'the operator stays on the form').toBeVisible();
    });

    test('CHARACTERIZES D4 (fails once fixed): an empty memo is refused with no visible reason', async ({ page }) => {
        await loginAsAdmin(page);
        await createAccount(page, DR_CODE, DR_NAME, /^expense$/i, /^debit$/i);
        await createAccount(page, CR_CODE, CR_NAME, /^liability$/i, /^credit$/i);
        const before = await countRows(page, 'journal_entries');
        const dialogs: string[] = [];
        page.on('dialog', async d => { dialogs.push(d.message()); await d.accept().catch(() => {}); });

        await safeNavigate(page, JE_ROUTE, JE_ANCHOR);
        await pressable(page, 'New Manual Entry').click();
        await page.locator('div[class*="rounded-full"]').filter({ hasText: `${DR_CODE} - ` }).first().click();
        await page.locator('div[class*="rounded-full"]').filter({ hasText: `${CR_CODE} - ` }).nth(1).click();
        await page.getByPlaceholder('0.00').nth(0).fill(String(AMOUNT));
        await page.getByPlaceholder('0.00').nth(3).fill(String(AMOUNT));
        // Balanced, so the button is enabled - the only remaining guard is the memo check
        // at journal-entries.tsx:120-123, which reports through Alert.alert.
        await pressable(page, 'Post Entry').click();
        await page.waitForTimeout(2000);

        expect(await countRows(page, 'journal_entries'), 'no memo means no entry').toBe(before);
        expect(dialogs.length, 'D4: Alert.alert produces no dialog on the web build').toBe(0);
        expect((await bodyText(page)).includes('Please enter a description'),
            'D4: the reason is invisible; the button just appears not to work').toBe(false);
        await expect(page.getByText('New Manual Journal Entry', { exact: true }),
            'the operator stays on the form with no explanation').toBeVisible();
    });

    test('CHARACTERIZES D4 (fails once fixed): a mis-posted entry cannot be reversed on web', async ({ page }) => {
        await loginAsAdmin(page);
        await createAccount(page, DR_CODE, DR_NAME, /^expense$/i, /^debit$/i);
        await createAccount(page, CR_CODE, CR_NAME, /^liability$/i, /^credit$/i);
        await postManualEntry(page, MEMO);

        const before = await countRows(page, 'journal_entries');
        await safeNavigate(page, JE_ROUTE, JE_ANCHOR);
        await page.locator('div[class*="rounded-3xl"]').filter({ hasText: MEMO }).last().click();
        const reverse = pressable(page, 'Reverse Entry');
        await expect(reverse, 'the detail sheet offers a reversal action').toBeVisible({ timeout: 30000 });

        const dialogs: string[] = [];
        page.on('dialog', async d => { dialogs.push(d.message()); await d.accept().catch(() => {}); });
        await reverse.click();
        await page.waitForTimeout(2500);

        expect(dialogs.length, 'D4: the "Confirm Reversal" Alert never renders').toBe(0);
        expect((await bodyText(page)).includes('Confirm Reversal'),
            'D4: the confirmation text is not on screen either').toBe(false);
        expect(await countRows(page, 'journal_entries'),
            'D4: with no confirmation the reversal can never be posted, so errors are permanent').toBe(before);
        expect((await readAll(page, 'journal_entries')).filter(e => String(e.entry_type) === 'reversing').length,
            'and no reversing entry exists').toBe(0);
    });
});
