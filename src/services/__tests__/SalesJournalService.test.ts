import { SalesJournalService } from '../SalesJournalService';
import { MarketplaceSalesPostingService } from '../MarketplaceSalesPostingService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('SalesJournalService & MarketplaceSalesPostingService', () => {
    let database: Database;
    let sjService: typeof SalesJournalService;
    let mpSalesService: typeof MarketplaceSalesPostingService;
    let jeService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        sjService = SalesJournalService;
        mpSalesService = MarketplaceSalesPostingService;
        jeService = JournalEntryService;
        (sjService as any).db = database;
        (mpSalesService as any).db = database;
        (mpSalesService as any).journalEntryService = jeService;
        (jeService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('posts marketplace sale and extracts it in the Sales Journal report', async () => {
        const orderDate = new Date(2026, 0, 12);

        // Post sale (Dr 1500 ₱2500, Cr 4100 ₱2500)
        await mpSalesService.postSale({
            orderId: 'ord-1001',
            orderNumber: 'ORD-2026-0001',
            buyerName: 'Pedro Penduko',
            totalAmount: 2500,
            orderDate,
            postedBy: 'System',
        });

        const summary = await sjService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));

        expect(summary.rows).toHaveLength(1);
        expect(summary.totalARDebit).toBe(2500);
        expect(summary.totalSalesCredit).toBe(2500);
        expect(summary.rows[0].referenceNumber).toBeDefined();
        expect(summary.rows[0].sourceId).toBe('ord-1001');
    });

    it('posts payment received for marketplace sale', async () => {
        const paymentDate = new Date(2026, 0, 15);

        // Post payment (Dr 1010 ₱2500, Cr 1500 ₱2500)
        await mpSalesService.postPaymentReceived({
            orderId: 'ord-1001',
            orderNumber: 'ORD-2026-0001',
            totalAmount: 2500,
            paymentDate,
            postedBy: 'Cashier',
        });

        const entries = await jeService.getEntries({ limit: 1 });
        expect(entries).toHaveLength(1);
        expect(entries[0].description).toContain('Marketplace Payment Received');
        expect(entries[0].totalDebit).toBe(2500);
    });
});
