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

    it('splits a harvest offtake collection into receivable and farm revenue columns', async () => {
        const date = new Date(2026, 0, 15);

        // Offtake cash-in: Dr 1010 12,000 / Cr 1500 10,000 + Cr 4140 2,000
        await jeService.createEntry({
            entryDate: date,
            description: 'Offtake collection #OR-AGR-001',
            entryType: 'auto',
            sourceTable: 'agri_weekly_settlements',
            sourceId: 'set-001',
            lines: [
                { accountCode: '1010', debitAmount: 12000, description: 'Cash received' },
                { accountCode: '1500', creditAmount: 10000, description: 'Advance recovered' },
                { accountCode: '4140', creditAmount: 2000, description: 'Harvest offtake revenue' },
            ],
        }, 'Admin');

        const summary = await crjService.getReport(new Date(2026, 0, 1), new Date(2026, 0, 31));

        expect(summary.rows).toHaveLength(1);
        expect(summary.grandTotalCash).toBe(12000);
        expect(summary.totalReceivableCollections).toBe(10000);
        expect(summary.totalFarmRevenue).toBe(2000);
        expect(summary.totalOtherReceipts).toBe(0);
    });

    it('classifies a BioGreen investor cash-in as a capital contribution', async () => {
        const date = new Date(2026, 2, 4);

        await jeService.createEntry({
            entryDate: date,
            description: 'BioGreen investor funding',
            entryType: 'manual',
            sourceTable: 'agri_investors',
            sourceId: 'inv-001',
            lines: [
                { accountCode: '1020', debitAmount: 50000, description: 'Cash in bank — BDO' },
                { accountCode: '3015', creditAmount: 50000, description: 'Project equity subscribed' },
            ],
        }, 'Admin');

        const summary = await crjService.getReport(new Date(2026, 2, 1), new Date(2026, 2, 31));

        expect(summary.rows).toHaveLength(1);
        expect(summary.totalCapitalContributions).toBe(50000);
        expect(summary.totalFarmRevenue).toBe(0);
    });

    it('skips accrual entries that move no cash', async () => {
        const date = new Date(2026, 4, 10);

        await jeService.createEntry({
            entryDate: date,
            description: 'Accrual only, no cash moved',
            entryType: 'manual',
            sourceTable: 'journal_entries',
            sourceId: 'je-accrual',
            lines: [
                { accountCode: '5020', debitAmount: 750, description: 'Office expenses' },
                { accountCode: '2040', creditAmount: 750, description: 'Accrued expenses' },
            ],
        }, 'Admin');

        const summary = await crjService.getReport(new Date(2026, 4, 1), new Date(2026, 4, 31));

        expect(summary.rows).toHaveLength(0);
        expect(summary.grandTotalCash).toBe(0);
    });
});
