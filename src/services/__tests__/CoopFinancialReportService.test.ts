import { CoopFinancialReportService } from '../CoopFinancialReportService';
import { ChartOfAccountsService } from '../ChartOfAccountsService';
import { JournalEntryService } from '../JournalEntryService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('CoopFinancialReportService', () => {
    let database: Database;
    let service: typeof CoopFinancialReportService;
    let coaService: typeof ChartOfAccountsService;
    let journalService: typeof JournalEntryService;

    beforeEach(async () => {
        database = createTestDatabase();
        service = CoopFinancialReportService;
        coaService = ChartOfAccountsService;
        journalService = JournalEntryService;

        // Inject database instance
        (service as any).db = database;
        (coaService as any).db = database;
        (journalService as any).db = database;
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should save and load period settings correctly', async () => {
        const year = 2025;
        const mockSettings = {
            authorizedShareCapital: 300000,
            subscribedCapital: 260000,
            subscriptionReceivable: 15000,
            sundryAssets: 120000,
            priorYearData: {
                cashOnHand: 35000,
                cashInBank: 50000,
            },
        };

        let settings = await service.getPeriodSettings(year);
        expect(settings).toBeNull();

        await service.savePeriodSettings(year, mockSettings, 'Tester');

        settings = await service.getPeriodSettings(year);
        expect(settings).not.toBeNull();
        expect(settings?.authorizedShareCapital).toBe(300000);
        expect(settings?.subscribedCapital).toBe(260000);
        expect(settings?.subscriptionReceivable).toBe(15000);
        expect(settings?.sundryAssets).toBe(120000);
        
        const prior = JSON.parse(settings?.priorYearData || '{}');
        expect(prior.cashOnHand).toBe(35000);
        expect(prior.cashInBank).toBe(50000);
    });

    it('should compute Balance Sheet correctly based on GL ledger', async () => {
        await coaService.seed('Tester');
        
        // Save period settings with zero starting capital so it balances
        await service.savePeriodSettings(2025, {
            authorizedShareCapital: 280000,
            subscribedCapital: 0,
            subscriptionReceivable: 0,
            sundryAssets: 0,
            priorYearData: {}
        }, 'Tester');

        // Post a transaction: Cash on Hand 10000 (DR) / Share Capital 10000 (CR)
        await journalService.createEntry({
            entryDate: new Date(2025, 5, 15),
            description: 'Capital Contribution',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 10000, description: 'Debit Cash' },
                { accountCode: '3010', creditAmount: 10000, description: 'Credit Share Capital' }
            ]
        }, 'Tester');

        const sheet = await service.getStatementOfFinancialCondition(2025);
        
        expect(sheet.assets.cashOnHand.current).toBe(10000);
        expect(sheet.equity.paidUpCapital.current).toBe(10000); // 0 start + 10000 GL balance
        expect(sheet.totalLiabilitiesAndEquity.current).toBe(sheet.assets.totalAssets.current);
    });

    it('should compute Operations Statement and allocate surplus correctly', async () => {
        await coaService.seed('Tester');

        // Post revenue and expense entries
        // DR Cash on Hand 5000 / CR Interest on Loans 5000
        await journalService.createEntry({
            entryDate: new Date(2025, 6, 20),
            description: 'Interest Collection',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 5000 },
                { accountCode: '4010', creditAmount: 5000 }
            ]
        }, 'Tester');

        // DR Salaries & Wages 2000 / CR Cash on Hand 2000
        await journalService.createEntry({
            entryDate: new Date(2025, 6, 25),
            description: 'Salary Payment',
            entryType: 'manual',
            lines: [
                { accountCode: '5010', debitAmount: 2000 },
                { accountCode: '1010', creditAmount: 2000 }
            ]
        }, 'Tester');

        const ops = await service.getStatementOfOperations(2025);
        expect(ops.revenues.totalRevenues.current).toBe(5000);
        expect(ops.expenses.totalExpenses.current).toBe(2000);
        expect(ops.netSurplus.current).toBe(3000);

        // Perform statutory allocations (Total must equal 3000)
        const allocations = [
            { type: 'reserve', percentage: 10, amount: 300 },
            { type: 'education', percentage: 10, amount: 300 },
            { type: 'union_federation', percentage: 0, amount: 0 },
            { type: 'community_dev', percentage: 3, amount: 90 },
            { type: 'optional', percentage: 7, amount: 210 },
            { type: 'interest_on_capital', percentage: 49, amount: 1470 },
            { type: 'patronage_refund', percentage: 21, amount: 630 },
        ];

        await service.allocateSurplus(2025, 3000, allocations, 'Tester');

        const equityChanges = await service.getStatementOfChangesInEquity(2025);
        const reserveFund = equityChanges.funds.find(f => f.fundType === 'reserve');
        expect(reserveFund?.ending).toBe(300);

        const optionalFund = equityChanges.funds.find(f => f.fundType === 'optional');
        expect(optionalFund?.ending).toBe(210);
    });
});
