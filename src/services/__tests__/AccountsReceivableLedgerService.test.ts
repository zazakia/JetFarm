import { AccountsReceivableLedgerService } from '../AccountsReceivableLedgerService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('AccountsReceivableLedgerService', () => {
    let database: Database;
    let arService: typeof AccountsReceivableLedgerService;
    let jeService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        arService = AccountsReceivableLedgerService;
        jeService = JournalEntryService;
        (arService as any).db = database;
        (jeService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('computes running debtor balance from charges and payments', async () => {
        const loanId = 'loan-xyz-123';

        // 1. Initial loan disbursement (charge) Dr 1100 ₱10,000
        await jeService.createEntry({
            entryDate: new Date(2026, 0, 1),
            description: 'Loan release #LN-XYZ',
            entryType: 'auto',
            sourceTable: 'loans',
            sourceId: loanId,
            lines: [
                { accountCode: '1100', debitAmount: 10000, description: 'Loan release' },
                { accountCode: '1010', creditAmount: 10000, description: 'Cash disbursed' },
            ],
        }, 'Admin');

        // 2. Partial payment (credit) Cr 1100 ₱3,000
        await jeService.createEntry({
            entryDate: new Date(2026, 0, 10),
            description: 'Partial payment installment 1',
            entryType: 'auto',
            sourceTable: 'loans',
            sourceId: loanId,
            lines: [
                { accountCode: '1010', debitAmount: 3000, description: 'Cash collection' },
                { accountCode: '1100', creditAmount: 3000, description: 'Principal repayment' },
            ],
        }, 'Admin');

        const ledger = await arService.getSourceLedger('loans', loanId);
        expect(ledger).toHaveLength(2);
        expect(ledger[0].balance).toBe(10000);
        expect(ledger[1].balance).toBe(7000);

        const currentBal = await arService.getBalance('loans', loanId);
        expect(currentBal).toBe(7000);
    });

    it('generates AR aging summary properly', async () => {
        const asOf = new Date(2026, 1, 1); // Feb 1, 2026
        const loanId = 'loan-aging-1';

        await jeService.createEntry({
            entryDate: new Date(2026, 0, 15), // 17 days old
            description: 'Loan release for aging test',
            entryType: 'auto',
            sourceTable: 'loans',
            sourceId: loanId,
            lines: [
                { accountCode: '1100', debitAmount: 4000 },
                { accountCode: '1010', creditAmount: 4000 },
            ],
        }, 'Admin');

        const aging = await arService.getAgingSummary(asOf);
        expect(aging.grandTotal).toBe(4000);
        expect(aging.total1to30).toBe(4000);
        expect(aging.customers).toHaveLength(1);
        expect(aging.customers[0].customerType).toBe('borrower');
    });
});
