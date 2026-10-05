/**
 * MarketplaceSalesPostingService — unit tests
 *
 * Locks the auto-posting contract for marketplace sales:
 *   Sale (credit):     DR 1500 Other Receivables / CR 4130 Marketplace Sales Revenue
 *   Payment received:  DR 1010 Cash on Hand      / CR 1500 Other Receivables
 *
 * Also serves as the L4 journal-balance parity guard: after a full
 * sale → payment lifecycle, every journal entry in the ledger must be
 * balanced (totalDebit === totalCredit) and receivables must net to zero.
 */
import { Database, Q } from '@nozbe/watermelondb';
import { MarketplaceSalesPostingServiceClass } from '../MarketplaceSalesPostingService';
import { JournalEntryServiceClass } from '../JournalEntryService';
import { ChartOfAccountsServiceClass } from '../ChartOfAccountsService';
import JournalEntry from '../../database/models/JournalEntry';
import JournalEntryLine from '../../database/models/JournalEntryLine';
import ChartOfAccount from '../../database/models/ChartOfAccount';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';

// Satisfy the module-level `database` import used by DI-default singletons
jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    return { database: createTestDatabase() };
});

describe('MarketplaceSalesPostingService', () => {
    let db: Database;
    let service: MarketplaceSalesPostingServiceClass;
    let journal: JournalEntryServiceClass;
    let coa: ChartOfAccountsServiceClass;

    const ORDER = {
        orderId: 'mp-order-001',
        orderNumber: 'MP-2026-0001',
        buyerName: 'Dela Cruz, Juan',
        totalAmount: 2500,
        orderDate: new Date(2026, 4, 15),
    };

    beforeEach(async () => {
        db = createTestDatabase();
        coa = new ChartOfAccountsServiceClass(db);
        await coa.seed('Tester');
        journal = new JournalEntryServiceClass(db);
        service = new MarketplaceSalesPostingServiceClass(db);
    });

    afterEach(async () => {
        await closeTestDatabase(db);
    });

    // ─── postSale (credit sale) ──────────────────────────────────────────────

    describe('postSale', () => {
        it('posts a balanced credit-sale entry: DR 1500 / CR 4130', async () => {
            await service.postSale(ORDER);

            const entries = await journal.getEntries({ sourceTable: 'marketplace_orders' });
            expect(entries.length).toBe(1);

            const entry = entries[0];
            expect(entry.entryType).toBe('auto');
            expect(entry.sourceId).toBe(ORDER.orderId);
            expect(entry.referenceNumber).toMatch(/JE-\d{4}-\d{6}/);
            expect(entry.totalDebit).toBe(2500);
            expect(entry.totalCredit).toBe(2500);

            const details = await journal.getEntryById(entry.id);
            const lines = details!.lines;
            expect(lines.length).toBe(2);

            const dr = lines.find(l => l.accountCode === '1500');
            const cr = lines.find(l => l.accountCode === '4130');
            expect(dr?.debitAmount).toBe(2500);
            expect(dr?.creditAmount).toBe(0);
            expect(cr?.creditAmount).toBe(2500);
            expect(cr?.debitAmount).toBe(0);
        });

        it('includes the buyer name in the description when provided', async () => {
            await service.postSale(ORDER);

            const entries = await journal.getEntries({ sourceTable: 'marketplace_orders' });
            expect(entries[0].description).toBe(
                'Marketplace Sale — Order #MP-2026-0001 (Dela Cruz, Juan)'
            );
        });

        it('omits the buyer name from the description when absent', async () => {
            await service.postSale({ ...ORDER, buyerName: undefined });

            const entries = await journal.getEntries({ sourceTable: 'marketplace_orders' });
            expect(entries[0].description).toBe('Marketplace Sale — Order #MP-2026-0001');
        });

        it.each([
            ['zero', 0],
            ['negative', -500],
        ])('skips posting when the total amount is %s', async (_label, amount) => {
            await service.postSale({ ...ORDER, totalAmount: amount });

            const entries = await db.get('journal_entries').query().fetch();
            expect(entries.length).toBe(0);
        });

        it('stamps the fiscal year and month from the order date', async () => {
            await service.postSale(ORDER);

            const entries = await journal.getEntries({ sourceTable: 'marketplace_orders' });
            expect(entries[0].fiscalYear).toBe(2026);
            expect(entries[0].fiscalMonth).toBe(5);
        });
    });

    // ─── postPaymentReceived (collection) ────────────────────────────────────

    describe('postPaymentReceived', () => {
        it('posts a balanced collection entry: DR 1010 / CR 1500', async () => {
            await service.postPaymentReceived({
                orderId: ORDER.orderId,
                orderNumber: ORDER.orderNumber,
                totalAmount: ORDER.totalAmount,
                paymentDate: new Date(2026, 4, 20),
            });

            const entries = await journal.getEntries({ sourceTable: 'marketplace_orders' });
            expect(entries.length).toBe(1);

            const details = await journal.getEntryById(entries[0].id);
            const lines = details!.lines;

            const dr = lines.find(l => l.accountCode === '1010');
            const cr = lines.find(l => l.accountCode === '1500');
            expect(dr?.debitAmount).toBe(2500);
            expect(cr?.creditAmount).toBe(2500);
            expect(entries[0].description).toBe(
                'Marketplace Payment Received — Order #MP-2026-0001'
            );
        });

        it('skips posting when the payment amount is zero', async () => {
            await service.postPaymentReceived({
                orderId: ORDER.orderId,
                orderNumber: ORDER.orderNumber,
                totalAmount: 0,
                paymentDate: new Date(2026, 4, 20),
            });

            const entries = await db.get('journal_entries').query().fetch();
            expect(entries.length).toBe(0);
        });
    });

    // ─── Full lifecycle + L4 parity guard ────────────────────────────────────

    describe('sale → payment lifecycle', () => {
        it('clears receivables to zero and lands revenue in cash', async () => {
            await service.postSale(ORDER);
            await service.postPaymentReceived({
                orderId: ORDER.orderId,
                orderNumber: ORDER.orderNumber,
                totalAmount: ORDER.totalAmount,
                paymentDate: new Date(2026, 4, 20),
            });

            const asOf = new Date(2026, 4, 31);
            expect(await journal.getAccountBalance('1500', asOf)).toBe(0);
            expect(await journal.getAccountBalance('1010', asOf)).toBe(2500);
            expect(await journal.getAccountBalance('4130', asOf)).toBe(2500);
        });

        it('parity guard: every journal entry stays balanced across multiple orders', async () => {
            const orders = [
                { ...ORDER, orderId: 'a-1', orderNumber: 'MP-1', totalAmount: 1200.55 },
                { ...ORDER, orderId: 'a-2', orderNumber: 'MP-2', totalAmount: 780 },
                { ...ORDER, orderId: 'a-3', orderNumber: 'MP-3', totalAmount: 3333.33 },
            ];

            for (const o of orders) {
                await service.postSale(o);
                await service.postPaymentReceived({
                    orderId: o.orderId,
                    orderNumber: o.orderNumber,
                    totalAmount: o.totalAmount,
                    paymentDate: o.orderDate,
                });
            }

            const entries = await db.get<JournalEntry>('journal_entries').query().fetch();
            expect(entries.length).toBe(6); // 3 sales + 3 collections

            for (const entry of entries) {
                expect(entry.totalDebit).toBeCloseTo(entry.totalCredit, 2);
                const lines = await db
                    .get<JournalEntryLine>('journal_entry_lines')
                    .query(Q.where('journal_entry_id', entry.id))
                    .fetch();
                const lineDebits = lines.reduce((s, l) => s + l.debitAmount, 0);
                const lineCredits = lines.reduce((s, l) => s + l.creditAmount, 0);
                expect(lineDebits).toBe(entry.totalDebit);
                expect(lineCredits).toBe(entry.totalCredit);
            }

            // Trial balance across the whole ledger must be balanced
            const tb = await journal.getTrialBalance(new Date(2026, 4, 31));
            expect(tb.isBalanced).toBe(true);
            expect(tb.totalDebits).toBeCloseTo(tb.totalCredits, 2);
        });
    });

    // ─── COA integrity ───────────────────────────────────────────────────────

    describe('chart-of-accounts enforcement', () => {
        it('rejects the sale when the marketplace revenue account is inactive', async () => {
            const accounts = await db
                .get<ChartOfAccount>('chart_of_accounts')
                .query(Q.where('code', '4130'))
                .fetch();
            await db.write(async () => {
                await accounts[0].update(a => {
                    a.isActive = false;
                });
            });

            await expect(service.postSale(ORDER)).rejects.toThrow(
                'Unknown or inactive posting account code: 4130'
            );

            const entries = await db.get('journal_entries').query().fetch();
            expect(entries.length).toBe(0);
        });

        it('propagates postedBy to the journal entry', async () => {
            await service.postSale({ ...ORDER, postedBy: 'collector-7' });

            const entries = await journal.getEntries({ sourceTable: 'marketplace_orders' });
            expect(entries[0].postedBy).toBe('collector-7');
        });
    });
});
