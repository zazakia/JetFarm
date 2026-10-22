import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAsAdmin, safeNavigate } from './playwright-auth';

/**
 * Live write-path coverage for the Books of Accounts group — the AP subledger and its
 * general-ledger counterpart:
 *   - `app/(admin)/accounting/suppliers.tsx`      (vendor masterlist, create)
 *   - `app/(admin)/accounting/ap-journal.tsx`     (AP voucher create + payment disbursement)
 *
 * Everything is read back from WatermelonDB storage (`window.__WATERMELON_DB__`), and every
 * money figure is recomputed by this spec (voucher amount, running balance, instalment sum,
 * journal totals) instead of trusting `AccountsPayableService`.
 *
 * Cross-module flows proven here (goal requirement 4):
 *   supplier -> voucher (`supplier_id` must point at the registered row),
 *   voucher -> journal entries (DR expense / CR 2030 on create, DR 2030 / CR 1010 on payment),
 *   payment -> status propagation (`open` -> `partial` -> `paid`) and -> aging/list rendering.
 *
 * Characterised defects (each of these tests FAILS once the app is fixed):
 * - D4   `suppliers.tsx:42-45` and `ap-journal.tsx:61-75/107-116` report validation and errors
 *        through `Alert.alert`, a no-op in react-native-web 0.21.2, so a refused write is
 *        indistinguishable from a successful one. The overpayment guard at
 *        `AccountsPayableService.ts:170-172` works — the operator is simply never told.
 * - D12  `AccountsPayableService.createVoucher` writes the voucher row (`:95-112`) and *then*
 *        posts the journal entry (`:115`). The two are not in one transaction, so when the
 *        ledger rejects the posting (unseeded/inactive COA code) the payable stays behind with
 *        no GL counterpart and the screen swallows the reason into an invisible Alert.
 * - M4   `createSupplier` (`AccountsPayableService.ts:257-280`) writes no `action_logs` row,
 *        unlike `createVoucher` (`:137-143`) — the vendor master file has no audit trail.
 *        Reported as evidence (logged, not asserted) because "should the masterlist be audited"
 *        is a product decision, not an observed failure.
 */

const SUPPLIERS_ROUTE = '/accounting/suppliers';
const SUPPLIERS_ANCHOR = 'Approved Vendor Masterlist';
const AP_ROUTE = '/accounting/ap-journal';
const AP_ANCHOR = 'Credit Purchases';

const stamp = String(Date.now()).slice(-6);
const year = new Date().getFullYear();

const SUPPLIER = `E2E Vendor ${stamp}`;
const CONTACT = `E2E Contact ${stamp}`;
const TIN = `412-555-${stamp}-000`;
const TERMS_DAYS = 45;

const VOUCHER_DESC = `E2E credit purchase of fertilizer ${stamp}`;
const VOUCHER_AMOUNT = 52000;
const PAY_1 = 20000;
const PAY_2 = 32000;                       // = VOUCHER_AMOUNT - PAY_1, recomputed below
const EXPECTED_BALANCE_AFTER_1 = VOUCHER_AMOUNT - PAY_1;

/** AccountsPayableService ACCT map: DR expense 5100 / CR 2030, payment DR 2030 / CR 1010. */
const DR_CODE = '5100';
const AP_CODE = '2030';
const CASH_CODE = '1010';

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
                    record._raw.id = `e2e-ap-coa-${code}`;
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
            }
        });
    }, [
        `${DR_CODE}|Other Operating Expenses E2E|expense|debit`,
        `${AP_CODE}|Accounts Payable E2E|liability|credit`,
        `${CASH_CODE}|Cash on Hand E2E|asset|debit`,
    ]);
}

/** Seed a vendor straight into storage so a voucher test does not depend on the masterlist UI. */
async function seedSupplier(page: Page, name: string): Promise<string> {
    return page.evaluate(async (vendorName: string) => {
        const db = (window as any).__WATERMELON_DB__;
        const collection = db.collections.get('suppliers');
        const id = `e2e-sup-${Date.now()}`;
        await db.write(async () => {
            await collection.create((record: any) => {
                record._raw.id = id;
                record.name = vendorName;
                record.contactPerson = 'Seeded Contact';
                record.paymentTermsDays = 30;
                record.isActive = true;
                record._raw.created_at = Date.now();
                record._raw.updated_at = Date.now();
            });
        });
        return id;
    }, name);
}

async function redBoxVisible(page: Page): Promise<boolean> {
    return page.evaluate(() => {
        const text = document.body?.innerText || '';
        return /Uncaught Error|Application Error|something went wrong/i.test(text);
    });
}

/** RNW Pressable: the handler lives on the container div, so click the container, not the label. */
function pressable(page: Page, label: string | RegExp): Locator {
    return page
        .locator('div[tabindex], div[class*="cursor-pointer"], div[class*="select-none"], div[class*="active:bg"]')
        .filter({ hasText: label })
        .last();
}

async function openSupplierModal(page: Page) {
    await safeNavigate(page, SUPPLIERS_ROUTE, SUPPLIERS_ANCHOR);
    await pressable(page, 'Add Supplier').click();
    await expect(page.getByText('Register New Supplier', { exact: true })).toBeVisible({ timeout: 30000 });
}

async function fillSupplier(page: Page, name: string) {
    await page.getByPlaceholder('e.g. San Miguel Feeds Corp.').fill(name);
}

async function openVoucherModal(page: Page) {
    await safeNavigate(page, AP_ROUTE, AP_ANCHOR);
    await pressable(page, 'New Voucher').click();
    await expect(page.getByText('New Accounts Payable Voucher', { exact: true })).toBeVisible({ timeout: 30000 });
}

/** The supplier chips are `px-3 py-2 rounded-xl mr-2 border` Pressables holding the vendor name. */
async function selectSupplierChip(page: Page, name: string) {
    const chip = page
        .locator('div[class*="rounded-xl"][class*="border"]')
        .filter({ hasText: name })
        .last();
    await expect(chip, `the vendor "${name}" must appear as a selectable chip`).toBeVisible({ timeout: 30000 });
    await chip.click();
    // Selection is rendered as the blue active class; prove the click landed before submitting.
    await expect
        .poll(async () => (await chip.getAttribute('class')) || '', 'the chip must flip to the selected style')
        .toContain('bg-blue-900');
}

async function createVoucherViaUI(page: Page, description: string, amount: number | string, expectClose = true) {
    await openVoucherModal(page);
    await selectSupplierChip(page, SUPPLIER);
    await page.getByPlaceholder('e.g. Purchase of 50 bags fertilizer on 30-day term').fill(description);
    await page.getByPlaceholder('0.00').first().fill(String(amount));
    await pressable(page, 'Post AP Voucher').click();
    if (expectClose) {
        await expect(page.getByText('New Accounts Payable Voucher', { exact: true }))
            .toHaveCount(0, { timeout: 30000 });
    }
}

async function voucherByDescription(page: Page, description: string) {
    return (await readAll(page, 'accounts_payable_vouchers')).filter(r => r.description === description);
}

async function linesFor(page: Page, entryId: string) {
    return (await readAll(page, 'journal_entry_lines')).filter(r => r.journal_entry_id === entryId);
}

/**
 * The screen renders `getAgingSummary().grandTotal` as `formatPHP(...)` in the amber payables
 * card. Read it back as a number so the rendered liability can be compared against this spec's
 * own arithmetic (label text is CSS-uppercased, so match case-insensitively).
 */
async function renderedPayableTotal(page: Page): Promise<number> {
    const card = page.locator('div[class*="bg-amber-950"]').first();
    await expect(card, 'the Total Accounts Payable card must render').toBeVisible({ timeout: 30000 });
    const text = await card.evaluate((el: any) => el.textContent || '');
    const hit = /PHP\s*([\d,]+\.\d{2})/.exec(text.replace(/\u00a0/g, ' '));
    expect(hit, `the card must show a peso amount, got: ${JSON.stringify(text.slice(0, 120))}`).toBeTruthy();
    return Number(hit![1].replace(/,/g, ''));
}

async function openPaymentModalFor(page: Page, description: string) {    await safeNavigate(page, AP_ROUTE, AP_ANCHOR);
    const row = page.locator('div[class*="rounded"]').filter({ hasText: description }).last();
    await expect(row, `the voucher "${description}" must be listed`).toBeVisible({ timeout: 30000 });
    await row.locator('div[class*="active:bg"]')
        .filter({ hasText: 'Record Payment' })
        .first()
        .click();
    await expect(page.getByText('Pay Supplier Voucher', { exact: true })).toBeVisible({ timeout: 30000 });
}

async function disburse(page: Page, amount: number | string) {
    const field = page.getByPlaceholder('0.00');
    await expect(field, 'the payment modal owns the only amount field while it is open').toHaveCount(1);
    await field.fill(String(amount));
    await pressable(page, 'Disburse & Clear').click();
    await expect(page.getByText('Pay Supplier Voucher', { exact: true })).toHaveCount(0, { timeout: 30000 });
}

test.describe('Suppliers masterlist: create through the UI, verified from storage', () => {
    test('registers a vendor and the row persists exactly as typed', async ({ page }) => {
        await loginAsAdmin(page);
        await openSupplierModal(page);
        const before = await countRows(page, 'suppliers');
        const logsBefore = await countRows(page, 'action_logs');

        await fillSupplier(page, SUPPLIER);
        await page.getByPlaceholder('e.g. Maria Santos').fill(CONTACT);
        await page.getByPlaceholder('0917-000-0000').fill('0917-555-' + stamp.slice(0, 4));
        await page.getByPlaceholder('000-000-000-000').fill(TIN);
        await page.getByPlaceholder('30').fill(String(TERMS_DAYS));
        await pressable(page, 'Save Supplier').click();
        await expect(page.getByText('Register New Supplier', { exact: true })).toHaveCount(0, { timeout: 30000 });

        expect(await redBoxVisible(page), 'registering a vendor must not crash the app').toBe(false);
        const rows = (await readAll(page, 'suppliers')).filter(r => r.name === SUPPLIER);
        expect(rows.length, 'the vendor row must exist in storage').toBe(1);
        const s = rows[0];
        expect(String(s.contact_person)).toBe(CONTACT);
        expect(String(s.tin), 'TIN stored verbatim, not reformatted').toBe(TIN);
        expect(Number(s.payment_terms_days), 'typed terms override the 30-day default').toBe(TERMS_DAYS);
        expect(Boolean(s.is_active), 'a new vendor is active so it reaches the voucher picker').toBe(true);
        expect(s.deleted_at).toBeNull();
        expect(await countRows(page, 'suppliers')).toBe(before + 1);

        // M4 evidence, recorded rather than asserted: the voucher path writes an audit row,
        // the vendor path does not.
        const logsAfter = await countRows(page, 'action_logs');
        console.log(`[M4] createSupplier action_logs delta = ${logsAfter - logsBefore} (voucher path writes 1; see AccountsPayableService.ts:137-143 vs :257-280)`);

        // The masterlist screen renders what storage holds.
        await expect(page.getByText(SUPPLIER).first(), 'the new vendor must render in the list').toBeVisible({ timeout: 30000 });
    });

    test('CHARACTERIZES D4 (fails once fixed): a vendor with no name is refused in silence', async ({ page }) => {
        await loginAsAdmin(page);
        await openSupplierModal(page);
        const before = await countRows(page, 'suppliers');
        const dialogs: string[] = [];
        page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss().catch(() => {}); });

        await fillSupplier(page, '   ');
        await pressable(page, 'Save Supplier').click();
        await page.waitForTimeout(1500);

        expect(await countRows(page, 'suppliers'), 'a nameless vendor must never be stored').toBe(before);
        await expect(page.getByText('Register New Supplier', { exact: true }), 'the form stays open').toBeVisible();
        expect(dialogs.length, 'D4: nothing reaches the operator (suppliers.tsx:42-45 uses Alert.alert)').toBe(0);
        expect(await page.evaluate(() => document.body.innerText.includes('Please enter a supplier name')),
            'D4: the validation string is never rendered').toBe(false);
    });
});

test.describe('AP vouchers: create, post to the GL, disburse, and the status propagation', () => {
    test('posts a voucher that persists, gets a unique number, and auto-posts a balanced DR 5100 / CR 2030 entry', async ({ page }) => {
        await loginAsAdmin(page);
        await seedPostableAccounts(page);
        await seedSupplier(page, SUPPLIER);
        const jeBefore = await countRows(page, 'journal_entries');

        const DESC_A = `E2E voucher A ${stamp}`;
        const DESC_B = `E2E voucher B ${stamp}`;
        await createVoucherViaUI(page, DESC_A, VOUCHER_AMOUNT);
        await createVoucherViaUI(page, DESC_B, 7500);

        expect(await redBoxVisible(page), 'posting an AP voucher must not crash the app').toBe(false);
        const a = await voucherByDescription(page, DESC_A);
        expect(a.length, 'voucher A must exist in storage').toBe(1);
        const v = a[0];
        expect(Number(v.amount)).toBe(VOUCHER_AMOUNT);
        expect(Number(v.amount_paid), 'a fresh voucher is unpaid').toBe(0);
        expect(Number(v.balance), 'balance starts at the full amount').toBe(VOUCHER_AMOUNT);
        expect(String(v.status)).toBe('open');
        expect(String(v.expense_account_code), 'the screen default debits 5100').toBe(DR_CODE);
        expect(v.deleted_at).toBeNull();
        expect(String(v.voucher_number), 'voucher numbering follows APV-<year>-<seq>').toMatch(new RegExp(`^APV-${year}-\\d{5}$`));

        const b = await voucherByDescription(page, DESC_B);
        expect(b.length).toBe(1);
        expect(String(b[0].voucher_number), 'D-note: sequence must be unique across vouchers')
            .not.toBe(String(v.voucher_number));

        // Cross-module: subledger -> general ledger, one entry per voucher, linked by source_id.
        expect(await countRows(page, 'journal_entries'), 'exactly one entry per voucher').toBe(jeBefore + 2);
        const entries = (await readAll(page, 'journal_entries')).filter(r => r.source_id === v.id);
        expect(entries.length).toBe(1);
        const entry = entries[0];
        expect(String(entry.source_table)).toBe('accounts_payable_vouchers');
        expect(String(entry.entry_type)).toBe('auto');

        const lines = await linesFor(page, entry.id);
        expect(lines.length).toBe(2);
        const sumDebit = lines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
        const sumCredit = lines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
        expect(sumDebit, 'this spec recomputes the debit side').toBe(VOUCHER_AMOUNT);
        expect(sumCredit, 'this spec recomputes the credit side').toBe(VOUCHER_AMOUNT);
        expect(Number(entry.total_debit)).toBe(sumDebit);
        expect(Number(entry.total_credit)).toBe(sumCredit);
        const debit = lines.find(l => Number(l.debit_amount) === VOUCHER_AMOUNT);
        const credit = lines.find(l => Number(l.credit_amount) === VOUCHER_AMOUNT);
        expect(String(debit?.account_code), 'the expense side debits 5100').toBe(DR_CODE);
        expect(String(credit?.account_code), 'the liability side credits 2030 Accounts Payable').toBe(AP_CODE);
        expect(Math.abs(sumDebit - sumCredit)).toBeLessThan(0.01);

        // Rendering follows storage: the voucher list shows the generated number.
        await safeNavigate(page, AP_ROUTE, AP_ANCHOR);
        await expect(page.getByText(String(v.voucher_number)).first()).toBeVisible({ timeout: 30000 });
    });

    test('disburses in two instalments: balance, status and the GL all match this spec\'s arithmetic', async ({ page }) => {
        await loginAsAdmin(page);
        await seedPostableAccounts(page);
        await seedSupplier(page, SUPPLIER);
        await safeNavigate(page, AP_ROUTE, AP_ANCHOR);
        const baselinePayable = await renderedPayableTotal(page);
        await createVoucherViaUI(page, VOUCHER_DESC, VOUCHER_AMOUNT);
        await expect
            .poll(async () => await renderedPayableTotal(page), 'the payable card must rise by the voucher amount')
            .toBe(baselinePayable + VOUCHER_AMOUNT);

        const created = await voucherByDescription(page, VOUCHER_DESC);
        expect(created.length).toBe(1);
        const voucherId = created[0].id;
        expect(Number(created[0].balance)).toBe(VOUCHER_AMOUNT);

        // Partial payment: 52,000 - 20,000 = 32,000, status must become 'partial'.
        await openPaymentModalFor(page, VOUCHER_DESC);
        await disburse(page, PAY_1);

        let rows = await voucherByDescription(page, VOUCHER_DESC);
        let v = rows[0];
        expect(Number(v.amount_paid), 'amount_paid accumulates').toBe(PAY_1);
        expect(Number(v.balance), 'spec-side 52,000 - 20,000').toBe(EXPECTED_BALANCE_AFTER_1);
        expect(String(v.status), 'status propagates to partial').toBe('partial');
        await expect
            .poll(async () => await renderedPayableTotal(page), 'the payable card must drop by this payment')
            .toBe(baselinePayable + EXPECTED_BALANCE_AFTER_1);

        // The payment is its own GL movement: DR 2030 / CR 1010 = 20,000.
        let entries = (await readAll(page, 'journal_entries')).filter(r => r.source_id === voucherId);
        expect(entries.length, 'one entry per money movement').toBe(2);
        const payEntry = entries.find(e => Number(e.total_debit) === PAY_1)!;
        expect(payEntry, 'the 20,000 payment entry must exist in the ledger').toBeTruthy();
        const payLines = await linesFor(page, payEntry.id);
        const payDebit = payLines.reduce((s, l) => s + Number(l.debit_amount || 0), 0);
        const payCredit = payLines.reduce((s, l) => s + Number(l.credit_amount || 0), 0);
        expect(payDebit, 'the liability is reduced by exactly this payment').toBe(PAY_1);
        expect(payCredit, 'cash on hand is credited by exactly this payment').toBe(PAY_1);
        expect(String(payLines.find(l => Number(l.debit_amount) === PAY_1)?.account_code)).toBe(AP_CODE);
        expect(String(payLines.find(l => Number(l.credit_amount) === PAY_1)?.account_code)).toBe(CASH_CODE);
        expect(String(payEntry.description), 'the entry records the resulting status')
            .toContain('partial');

        // Final instalment clears it: 32,000 - 32,000 = 0, status 'paid'.
        await openPaymentModalFor(page, VOUCHER_DESC);
        await disburse(page, EXPECTED_BALANCE_AFTER_1);

        v = (await voucherByDescription(page, VOUCHER_DESC))[0];
        expect(Number(v.balance), 'a cleared voucher has zero balance').toBe(0);
        expect(Number(v.amount_paid), '20,000 + 32,000 = the original amount').toBe(VOUCHER_AMOUNT);
        expect(Number(v.amount_paid), 'instalments summed by this spec').toBe(PAY_1 + PAY_2);
        expect(String(v.status), 'status propagates to paid').toBe('paid');

        // Every voucher money movement is now in the ledger and each balances.
        entries = (await readAll(page, 'journal_entries')).filter(r => r.source_id === voucherId);
        expect(entries.length).toBe(3);
        const totalPosted = entries
            .map(e => Number(e.total_debit))
            .reduce((s, x) => s + x, 0);
        expect(totalPosted, 'DR side across voucher + 2 payments = 52,000 + 20,000 + 32,000')
            .toBe(VOUCHER_AMOUNT + PAY_1 + EXPECTED_BALANCE_AFTER_1);
        for (const e of entries) {
            expect(Math.abs(Number(e.total_debit) - Number(e.total_credit)), 'each entry balances to the centavo').toBeLessThan(0.01);
        }

        // Status propagation reaches the rendered payables total: a cleared voucher is no
        // longer a liability, so the amber card returns to the baseline measured above.
        await expect
            .poll(async () => await renderedPayableTotal(page), 'a paid voucher must leave the payables total')
            .toBe(baselinePayable);

        // The list defaults to the `all` filter, so the settled row stays visible - badged paid,
        // and it must no longer offer another disbursement.
        await safeNavigate(page, AP_ROUTE, AP_ANCHOR);
        const row = page.locator('div[class*="rounded"]').filter({ hasText: VOUCHER_DESC }).last();
        await expect(row, 'the cleared voucher must still be listed under the "all" filter').toBeVisible({ timeout: 30000 });
        const badge = row.locator('[class*="bg-emerald-100"]').first();
        await expect(badge, 'the row must carry the paid status badge').toBeVisible();
        expect(String(await badge.textContent()).trim().toLowerCase(), 'badge text reflects the stored status').toBe('paid');
        await expect(row.getByText('Record Payment'), 'a paid voucher must not be payable again').toHaveCount(0);
    });

    test('CHARACTERIZES D4 (fails once fixed): an overpayment is refused by the guard but the operator is told nothing', async ({ page }) => {
        await loginAsAdmin(page);
        await seedPostableAccounts(page);
        await seedSupplier(page, SUPPLIER);
        const DESC = `E2E overpay target ${stamp}`;
        const AMT = 40000;
        await createVoucherViaUI(page, DESC, AMT);
        const before = await countRows(page, 'journal_entries');

        await openPaymentModalFor(page, DESC);
        const dialogs: string[] = [];
        page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss().catch(() => {}); });

        // The data says 40,000 is owed; ask for 99,999.
        await page.getByPlaceholder('0.00').fill('99999');
        await pressable(page, 'Disburse & Clear').click();
        await page.waitForTimeout(2000);

        const v = (await voucherByDescription(page, DESC))[0];
        expect(Number(v.amount_paid), 'the guard must not let the paid amount exceed the voucher').toBe(0);
        expect(Number(v.balance), 'balance must be untouched').toBe(AMT);
        expect(String(v.status)).toBe('open');
        expect(await countRows(page, 'journal_entries'), 'a refused payment posts nothing').toBe(before);
        expect(dialogs.length, 'D4: AccountsPayableService.ts:170-172 throws and ap-journal.tsx:126 hides it').toBe(0);
        expect(await page.evaluate(() => document.body.innerText.includes('exceeds voucher balance')),
            'D4: the reason is never rendered').toBe(false);
        expect(await redBoxVisible(page), 'the guard must not crash the app').toBe(false);

        // Same silence for a non-numeric/zero payment amount (ap-journal.tsx:110-115).
        await page.getByPlaceholder('0.00').fill('0');
        await pressable(page, 'Disburse & Clear').click();
        await page.waitForTimeout(1500);
        expect(await countRows(page, 'journal_entries'), 'a zero payment posts nothing').toBe(before);
        expect(await page.evaluate(() => document.body.innerText.includes('Please enter a valid payment amount')),
            'D4: invalid-amount feedback is invisible').toBe(false);
    });

    test('CHARACTERIZES D12 (fails once fixed): a failed GL post leaves the AP voucher orphaned', async ({ page }) => {
        await loginAsAdmin(page);
        // Deliberately NO COA seeding: 5100 / 2030 do not exist, so JournalEntryService
        // rejects the posting (`JournalEntryService.ts:145-151`) after the row is written.
        expect((await readAll(page, 'chart_of_accounts')).filter(r => String(r.code) === DR_CODE).length,
            'the degraded case needs 5100 to be absent').toBe(0);
        await seedSupplier(page, SUPPLIER);
        const jeBefore = await countRows(page, 'journal_entries');
        const DESC = `E2E unposted payable ${stamp}`;

        const dialogs: string[] = [];
        page.on('dialog', async d => { dialogs.push(d.message()); await d.dismiss().catch(() => {}); });
        await createVoucherViaUI(page, DESC, 18000, false);
        // The create handler awaits the ledger post and throws; the row was already written.
        await page.waitForTimeout(2500);
        await expect(page.getByText('New Accounts Payable Voucher', { exact: true }),
            'D12: the modal stays open because the failure is reported only through Alert.alert').toBeVisible();

        const rows = await voucherByDescription(page, DESC);
        // The defect: the payable IS persisted even though its ledger half failed.
        expect(rows.length, 'D12: createVoucher writes the row before posting, then aborts').toBe(1);
        expect(Number(rows[0].amount)).toBe(18000);
        expect(String(rows[0].status)).toBe('open');
        expect(await countRows(page, 'journal_entries'), 'D12: nothing reached the general ledger').toBe(jeBefore);
        expect(dialogs.length, 'D12: the reason never reaches the operator').toBe(0);
        expect(await page.evaluate(() => document.body.innerText.includes('Unknown or inactive posting account code')),
            'D12: no inline error either').toBe(false);
        expect(await redBoxVisible(page), 'the failed post must not crash the app').toBe(false);
        console.log(`[D12] orphan payable kept: voucher_number=${rows[0].voucher_number} amount=${rows[0].amount} journal_entries_delta=0`);
    });
});
