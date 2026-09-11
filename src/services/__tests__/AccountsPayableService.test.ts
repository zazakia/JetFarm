import { AccountsPayableService } from '../AccountsPayableService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('AccountsPayableService', () => {
    let database: Database;
    let apService: typeof AccountsPayableService;
    let jeService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        apService = AccountsPayableService;
        jeService = JournalEntryService;
        (apService as any).db = database;
        (apService as any).journalEntryService = jeService;
        (jeService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('creates a supplier and an AP voucher with automatic journal entry', async () => {
        const supplier = await apService.createSupplier({
            name: 'Agri Supply Corp',
            contactPerson: 'Juan Dela Cruz',
            phone: '09171234567',
            paymentTermsDays: 30,
        });

        expect(supplier.id).toBeDefined();
        expect(supplier.name).toBe('Agri Supply Corp');

        const voucher = await apService.createVoucher({
            supplierId: supplier.id,
            invoiceNumber: 'INV-1001',
            invoiceDate: new Date(2026, 0, 10),
            description: 'Fertilizer bulk order',
            amount: 25000,
            expenseAccountCode: '1210',
            postedBy: 'Admin',
        });

        expect(voucher.voucherNumber).toMatch(/APV-\d{4}-\d{5}/);
        expect(voucher.amount).toBe(25000);
        expect(voucher.balance).toBe(25000);
        expect(voucher.status).toBe('open');

        // Check posted journal entry
        const entries = await jeService.getEntries({ limit: 1 });
        expect(entries).toHaveLength(1);
        expect(entries[0].totalDebit).toBe(25000);
        expect(entries[0].totalCredit).toBe(25000);
    });

    it('records partial and full payments against an AP voucher', async () => {
        const supplier = await apService.createSupplier({ name: 'Office Depot' });
        const voucher = await apService.createVoucher({
            supplierId: supplier.id,
            invoiceDate: new Date(),
            description: 'Printing paper',
            amount: 5000,
            postedBy: 'Admin',
        });

        // 1. Partial payment ₱2000
        await apService.recordPayment({
            voucherId: voucher.id,
            amount: 2000,
            paymentDate: new Date(),
            postedBy: 'Admin',
        });

        let updated = await database.get('accounts_payable_vouchers').find(voucher.id);
        expect((updated as any).balance).toBe(3000);
        expect((updated as any).amountPaid).toBe(2000);
        expect((updated as any).status).toBe('partial');

        // 2. Final payment ₱3000
        await apService.recordPayment({
            voucherId: voucher.id,
            amount: 3000,
            paymentDate: new Date(),
            postedBy: 'Admin',
        });

        updated = await database.get('accounts_payable_vouchers').find(voucher.id);
        expect((updated as any).balance).toBe(0);
        expect((updated as any).amountPaid).toBe(5000);
        expect((updated as any).status).toBe('paid');
    });

    it('rejects payments exceeding remaining balance', async () => {
        const supplier = await apService.createSupplier({ name: 'Water Filter Supplies' });
        const voucher = await apService.createVoucher({
            supplierId: supplier.id,
            invoiceDate: new Date(),
            description: 'Filter membranes',
            amount: 1000,
            postedBy: 'Admin',
        });

        await expect(
            apService.recordPayment({
                voucherId: voucher.id,
                amount: 1500, // exceeds 1000
                paymentDate: new Date(),
                postedBy: 'Admin',
            })
        ).rejects.toThrow(/exceeds voucher balance/);
    });
});
