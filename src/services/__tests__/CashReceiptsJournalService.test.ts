import { CashReceiptsJournalService } from '../CashReceiptsJournalService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('CashReceiptsJournalService', () => {
    let database: Database;
    let crjService: typeof CashReceiptsJournalService;
    let jeService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        crjService = CashReceiptsJournalService;
        jeService = JournalEntryService;
        (crjService as any).db = database;
        (jeService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('returns empty summary when no cash receipts exist', async () => {
        const start = new Date(2026, 0, 1);
        const end = new Date(2026, 0, 31);
        const summary = await crjService.getReport(start, end);

        expect(summary.rows).toHaveLength(0);
        expect(summary.grandTotalCash).toBe(0);
    });

    it('extracts loan collection and savings deposit correctly into columns', async () => {
        const date = new Date(2026, 0, 15);

        // 1. Post a loan collection (Dr 1010 ₱1000, Cr 1100 ₱800, Cr 4020 ₱200)
        await jeService.createEntry({
            entryDate: date,
            description: 'Loan collection #OR-001',
            entryType: 'auto',
            sourceTable: 'payments',
            sourceId: 'pay-001',
            lines: [
                { accountCode: '1010', debitAmount: 1000, description: 'Cash received' },
                { accountCode: '1100', creditAmount: 800, description: 'Principal repayment' },
                { accountCode: '4020', creditAmount: 200, description: 'Service charge' },
            ],
        }, 'Admin');

        // 2. Post a savings deposit (Dr 1010 ₱500, Cr 2010 ₱500)
        await jeService.createEntry({
            entryDate: date,
            description: 'Member savings deposit',
            entryType: 'auto',
            sourceTable: 'savings_transactions',
            sourceId: 'sav-001',
            lines: [
                { accountCode: '1010', debitAmount: 500, description: 'Cash received' },
                { accountCode: '2010', creditAmount: 500, description: 'Savings deposit' },
            ],
        }, 'Admin');

        const summary = await crjService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));

        expect(summary.rows).toHaveLength(2);
        expect(summary.grandTotalCash).toBe(1500);
        expect(summary.totalLoanRepayments).toBe(800);
        expect(summary.totalServiceCharges).toBe(200);
        expect(summary.totalSavingsDeposits).toBe(500);
    });
});
