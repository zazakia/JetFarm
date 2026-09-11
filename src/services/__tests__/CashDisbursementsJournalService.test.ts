import { CashDisbursementsJournalService } from '../CashDisbursementsJournalService';
import { JournalEntryService } from '../JournalEntryService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('CashDisbursementsJournalService', () => {
    let database: Database;
    let cdjService: typeof CashDisbursementsJournalService;
    let jeService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        cdjService = CashDisbursementsJournalService;
        jeService = JournalEntryService;
        (cdjService as any).db = database;
        (jeService as any).db = database;
        (ChartOfAccountsService as any).db = database;
        await ChartOfAccountsService.seed('TestUser');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('returns empty summary when no cash disbursements exist', async () => {
        const start = new Date(2026, 0, 1);
        const end = new Date(2026, 0, 31);
        const summary = await cdjService.getReport(start, end);

        expect(summary.rows).toHaveLength(0);
        expect(summary.grandTotalCash).toBe(0);
    });

    it('extracts loan releases and operating expenses correctly into columns', async () => {
        const date = new Date(2026, 0, 15);

        // 1. Post loan disbursement (Dr 1100 ₱5000, Cr 1010 ₱5000)
        await jeService.createEntry({
            entryDate: date,
            description: 'Disbursement for Loan #LN-001',
            entryType: 'auto',
            sourceTable: 'loans',
            sourceId: 'loan-001',
            lines: [
                { accountCode: '1100', debitAmount: 5000, description: 'Loan release' },
                { accountCode: '1010', creditAmount: 5000, description: 'Cash disbursed' },
            ],
        }, 'Admin');

        // 2. Post office expense (Dr 5020 ₱350, Cr 1010 ₱350)
        await jeService.createEntry({
            entryDate: date,
            description: 'Office supplies purchase',
            entryType: 'auto',
            sourceTable: 'expenses',
            sourceId: 'exp-001',
            lines: [
                { accountCode: '5020', debitAmount: 350, description: 'Office supplies' },
                { accountCode: '1010', creditAmount: 350, description: 'Cash paid' },
            ],
        }, 'Admin');

        const summary = await cdjService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));

        expect(summary.rows).toHaveLength(2);
        expect(summary.grandTotalCash).toBe(5350);
        expect(summary.totalLoanDisbursements).toBe(5000);
        expect(summary.totalOperatingExpenses).toBe(350);
    });
});
