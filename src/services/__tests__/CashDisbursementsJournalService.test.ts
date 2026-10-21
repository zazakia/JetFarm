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

    it('extracts land-owner settlements and farm operating expenses into columns', async () => {
        const date = new Date(2026, 4, 12);

        // 1. Pay a land owner crop-share settlement (Dr 2035 ₱8000, Cr 1010 ₱8000)
        await jeService.createEntry({
            entryDate: date,
            description: 'Settlement payout — Parcel A-12 cycle 1',
            entryType: 'auto',
            sourceTable: 'agri_weekly_settlements',
            sourceId: 'set-001',
            lines: [
                { accountCode: '2035', debitAmount: 8000, description: 'Crop share settled' },
                { accountCode: '1010', creditAmount: 8000, description: 'Cash paid' },
            ],
        }, 'Admin');

        // 2. Pay field wages accrual (Dr 2036 ₱2000, Cr 1010 ₱2000)
        await jeService.createEntry({
            entryDate: date,
            description: 'Farm labor payroll — week 20',
            entryType: 'auto',
            sourceTable: 'agri_labor_logs',
            sourceId: 'lab-001',
            lines: [
                { accountCode: '2036', debitAmount: 2000, description: 'Wages paid' },
                { accountCode: '1010', creditAmount: 2000, description: 'Cash paid' },
            ],
        }, 'Admin');

        // 3. Pay a farm expense in cash (Dr 5040 ₱1200, Cr 1010 ₱1200)
        await jeService.createEntry({
            entryDate: date,
            description: 'Haulage truck rental',
            entryType: 'auto',
            sourceTable: 'agri_farm_expenses',
            sourceId: 'exp-001',
            lines: [
                { accountCode: '5040', debitAmount: 1200, description: 'Transportation' },
                { accountCode: '1010', creditAmount: 1200, description: 'Cash paid' },
            ],
        }, 'Admin');

        const summary = await cdjService.getReport(new Date(2026, 4, 1), new Date(2026, 4, 31));

        expect(summary.rows).toHaveLength(3);
        expect(summary.grandTotalCash).toBe(11200);
        expect(summary.totalSettlementsAndWages).toBe(10000);
        expect(summary.totalOperatingExpenses).toBe(1200);
        expect(summary.totalOtherDisbursements).toBe(0);
    });

    it('classifies an offtake advance and an investor capital refund', async () => {
        const date = new Date(2026, 5, 3);

        // Advance receivable funded from the bank account (Dr 1500 ₱3000, Cr 1020 ₱3000)
        await jeService.createEntry({
            entryDate: date,
            description: 'Advance to offtaker',
            entryType: 'manual',
            sourceTable: 'manual',
            lines: [
                { accountCode: '1500', debitAmount: 3000, description: 'Other receivable' },
                { accountCode: '1020', creditAmount: 3000, description: 'BDO payout' },
            ],
        }, 'Admin');

        // Return capital to a BioGreen partner (Dr 3015 ₱10000, Cr 1010 ₱10000)
        await jeService.createEntry({
            entryDate: date,
            description: 'BioGreen partner capital withdrawal',
            entryType: 'manual',
            sourceTable: 'manual',
            lines: [
                { accountCode: '3015', debitAmount: 10000, description: 'Equity returned' },
                { accountCode: '1010', creditAmount: 10000, description: 'Cash paid' },
            ],
        }, 'Admin');

        const summary = await cdjService.getReport(new Date(2026, 5, 1), new Date(2026, 5, 30));

        expect(summary.rows).toHaveLength(2);
        expect(summary.grandTotalCash).toBe(13000);
        expect(summary.totalReceivableAdvances).toBe(3000);
        expect(summary.totalCapitalRefunds).toBe(10000);
    });
});
