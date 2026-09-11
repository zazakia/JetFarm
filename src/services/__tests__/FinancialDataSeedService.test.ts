import { FinancialDataSeedService } from '../FinancialDataSeedService';
import { CoopFinancialReportServiceClass } from '../CoopFinancialReportService';
import { ChartOfAccountsServiceClass } from '../ChartOfAccountsService';
import { JournalEntryServiceClass } from '../JournalEntryService';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { Database, Q } from '@nozbe/watermelondb';
import JournalEntry from '../../database/models/JournalEntry';
import FinancialPeriodSetting from '../../database/models/FinancialPeriodSetting';
import StatutoryFundAllocation from '../../database/models/StatutoryFundAllocation';

describe('FinancialDataSeedService', () => {
    let database: Database;
    let seedService: FinancialDataSeedService;
    let reportService: CoopFinancialReportServiceClass;
    let coaService: ChartOfAccountsServiceClass;
    let journalService: JournalEntryServiceClass;

    beforeEach(async () => {
        database = createTestDatabase();
        seedService = new FinancialDataSeedService(database);
        reportService = new CoopFinancialReportServiceClass(database);
        coaService = new ChartOfAccountsServiceClass(database);
        journalService = new JournalEntryServiceClass(database);
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should seed 2024 and 2025 financial statements correctly into the local db', async () => {
        // Initial state should not be seeded
        const alreadySeededInitially = await seedService.isAlreadySeeded();
        expect(alreadySeededInitially).toBe(false);

        // Run seed
        const result = await seedService.seedHistoricalData('TestAdmin');
        expect(result.success).toBe(true);
        expect(result.message).toContain('successfully migrated');

        // State should now be seeded
        const alreadySeededPost = await seedService.isAlreadySeeded();
        expect(alreadySeededPost).toBe(true);

        // Verify period settings exist
        const settings2024 = await reportService.getPeriodSettings(2024);
        expect(settings2024).not.toBeNull();
        expect(settings2024?.authorizedShareCapital).toBe(280000);

        const settings2025 = await reportService.getPeriodSettings(2025);
        expect(settings2025).not.toBeNull();
        expect(settings2025?.authorizedShareCapital).toBe(280000);

        // Verify journal entries were posted
        const entries = await database.collections.get<JournalEntry>('journal_entries').query().fetch();
        expect(entries.length).toBeGreaterThan(0);

        // Verify we have entries for both 2024 and 2025
        const entries2024 = entries.filter(e => e.fiscalYear === 2024);
        const entries2025 = entries.filter(e => e.fiscalYear === 2025);
        expect(entries2024.length).toBeGreaterThan(0);
        expect(entries2025.length).toBeGreaterThan(0);

        // Verify statutory fund allocations
        const allocations = await database.collections.get<StatutoryFundAllocation>('statutory_fund_allocations').query().fetch();
        expect(allocations.length).toBeGreaterThan(0);

        const allocs2024 = allocations.filter(a => a.fiscalYear === 2024);
        expect(allocs2024.length).toBe(7); // 7 statutory funds allocated in 2024

        const allocs2025 = allocations.filter(a => a.fiscalYear === 2025);
        expect(allocs2025.length).toBe(1); // 1 (Reserve fund absorption) in 2025
    });
});
