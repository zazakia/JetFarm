import { PurchaseJournalService } from '../PurchaseJournalService';
import { AccountsPayableService } from '../AccountsPayableService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('PurchaseJournalService', () => {
    let database: Database;
    let pjService: typeof PurchaseJournalService;
    let apService: typeof AccountsPayableService;
    let jeService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        pjService = PurchaseJournalService;
        apService = AccountsPayableService;
        jeService = JournalEntryService;
        (pjService as any).db = database;
        (apService as any).db = database;
        (apService as any).journalEntryService = jeService;
        (jeService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('generates columnar report separating inventory vs expense debits', async () => {
        const supplier = await apService.createSupplier({ name: 'Agri Vet Supply' });

        // 1. Merchandise Inventory voucher (Dr 1210 ₱15,000, Cr 2030 ₱15,000)
        await apService.createVoucher({
            supplierId: supplier.id,
            invoiceNumber: 'INV-001',
            invoiceDate: new Date(2026, 0, 5),
            description: 'Feeds stock purchase',
            amount: 15000,
            expenseAccountCode: '1210',
            moduleId: 'agri-store',
            postedBy: 'Admin',
        });

        // 2. Operating Expense voucher (Dr 5100 ₱2,000, Cr 2030 ₱2,000)
        await apService.createVoucher({
            supplierId: supplier.id,
            invoiceNumber: 'INV-002',
            invoiceDate: new Date(2026, 0, 10),
            description: 'Delivery services fee',
            amount: 2000,
            expenseAccountCode: '5100',
            moduleId: 'agri-store',
            postedBy: 'Admin',
        });

        const summary = await pjService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));

        expect(summary.rows).toHaveLength(2);
        expect(summary.totalInventoryDebit).toBe(15000);
        expect(summary.totalExpenseDebit).toBe(2000);
        expect(summary.totalAPCredit).toBe(17000);
        expect(summary.rows[0].supplierName).toBe('Agri Vet Supply');
    });
});
