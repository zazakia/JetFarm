import { Database } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import { BusinessUnitServiceClass } from '../BusinessUnitService';
import { ConsolidationServiceClass } from '../ConsolidationService';
import { ChartOfAccountsServiceClass } from '../ChartOfAccountsService';
import { JournalEntryServiceClass } from '../JournalEntryService';

jest.mock('../ActionLogService', () => ({
    __esModule: true,
    default: { logAction: jest.fn().mockResolvedValue(undefined) },
}));

describe('Business-unit consolidation', () => {
    let database: Database;
    let businessUnitService: BusinessUnitServiceClass;
    let consolidationService: ConsolidationServiceClass;
    let coaService: ChartOfAccountsServiceClass;
    let journalService: JournalEntryServiceClass;

    beforeEach(async () => {
        database = createTestDatabase();
        businessUnitService = new BusinessUnitServiceClass(database);
        consolidationService = new ConsolidationServiceClass(database);
        coaService = new ChartOfAccountsServiceClass(database);
        journalService = new JournalEntryServiceClass(database);

        await coaService.seed('TestAdmin');
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('should aggregate ledger balances by business unit segment correctly', async () => {
        const agriStore = await businessUnitService.create(
            { name: 'Agri-Store', slug: 'agri-store', description: 'Farm input supply' },
            'TestAdmin'
        );

        // Segment entry: agri-store buys fertilizer inventory on account.
        await journalService.createEntry({
            entryDate: new Date(),
            description: 'Agri-Store input purchase on account',
            entryType: 'manual',
            lines: [
                { accountCode: '1210', debitAmount: 15000, businessUnitId: agriStore.slug },
                { accountCode: '2030', creditAmount: 15000, businessUnitId: agriStore.slug }
            ]
        }, 'TestAdmin');

        // Head-office (unsegmented) entry: farm labor paid from cash on hand.
        await journalService.createEntry({
            entryDate: new Date(),
            description: 'Field wages from cash on hand',
            entryType: 'manual',
            lines: [
                { accountCode: '5010', debitAmount: 4200 },
                { accountCode: '1010', creditAmount: 4200 }
            ]
        }, 'TestAdmin');

        const asOf = new Date();
        const segmentBalances = await consolidationService.getBalances(asOf, agriStore.slug);
        expect(segmentBalances.get('1210')).toBe(15000);
        expect(segmentBalances.get('2030')).toBe(15000);
        expect(segmentBalances.get('5010')).toBeUndefined();

        const headOfficeBalances = await consolidationService.getBalances(asOf, 'coop-base');
        expect(headOfficeBalances.get('5010')).toBe(4200);
        expect(headOfficeBalances.get('1010')).toBe(-4200);
        expect(headOfficeBalances.get('1210')).toBeUndefined();

        const consolidated = await consolidationService.getBalances(asOf);
        expect(consolidated.get('1210')).toBe(15000);
        expect(consolidated.get('2030')).toBe(15000);
        expect(consolidated.get('5010')).toBe(4200);
        expect(consolidated.get('1010')).toBe(-4200);
    });

    it('should exclude unposted entries from segment and consolidated balances', async () => {
        const agriStore = await businessUnitService.create(
            { name: 'Agri-Store', slug: 'agri-store' },
            'TestAdmin'
        );

        const entry = await journalService.createEntry({
            entryDate: new Date(),
            description: 'Agri-Store offtake sale',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 8000, businessUnitId: agriStore.slug },
                { accountCode: '4110', creditAmount: 8000, businessUnitId: agriStore.slug }
            ]
        }, 'TestAdmin');

        await database.write(async () => {
            await entry.update(record => {
                (record as any).isPosted = false;
            });
        });

        expect((await consolidationService.getBalances(new Date(), agriStore.slug)).size).toBe(0);
        expect((await consolidationService.getBalances(new Date())).size).toBe(0);
    });

    it('should report segment and consolidated profit or loss for the fiscal year', async () => {
        const agriStore = await businessUnitService.create(
            { name: 'Agri-Store', slug: 'agri-store' },
            'TestAdmin'
        );
        const now = new Date();
        const year = now.getFullYear();

        await journalService.createEntry({
            entryDate: now,
            description: 'Agri-Store input sale',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 9000, businessUnitId: agriStore.slug },
                { accountCode: '4110', creditAmount: 9000, businessUnitId: agriStore.slug }
            ]
        }, 'TestAdmin');

        await journalService.createEntry({
            entryDate: now,
            description: 'Agri-Store cost of goods sold',
            entryType: 'manual',
            lines: [
                { accountCode: '5130', debitAmount: 6000, businessUnitId: agriStore.slug },
                { accountCode: '1210', creditAmount: 6000, businessUnitId: agriStore.slug }
            ]
        }, 'TestAdmin');

        // Head-office harvest offtake belongs to the consolidated view only.
        await journalService.createEntry({
            entryDate: now,
            description: 'Cassava offtake revenue',
            entryType: 'manual',
            lines: [
                { accountCode: '1010', debitAmount: 20000 },
                { accountCode: '4140', creditAmount: 20000 }
            ]
        }, 'TestAdmin');

        const segmentPnl = await consolidationService.getPnL(year, agriStore.slug);
        expect(segmentPnl.totalRevenues).toBe(9000);
        expect(segmentPnl.totalExpenses).toBe(6000);
        expect(segmentPnl.netSurplus).toBe(3000);

        const consolidatedPnl = await consolidationService.getPnL(year);
        expect(consolidatedPnl.totalRevenues).toBe(29000);
        expect(consolidatedPnl.netSurplus).toBe(23000);
    });

    it('should balance the consolidated balance sheet equation', async () => {
        const agriStore = await businessUnitService.create(
            { name: 'Agri-Store', slug: 'agri-store' },
            'TestAdmin'
        );

        await journalService.createEntry({
            entryDate: new Date(),
            description: 'Agri-Store input purchase on account',
            entryType: 'manual',
            lines: [
                { accountCode: '1210', debitAmount: 15000, businessUnitId: agriStore.slug },
                { accountCode: '2030', creditAmount: 15000, businessUnitId: agriStore.slug }
            ]
        }, 'TestAdmin');

        const sheet = await consolidationService.getBalanceSheet(new Date().getFullYear());
        expect(sheet.totalAssets).toBe(15000);
        expect(sheet.totalLiabilities).toBe(15000);
        expect(sheet.totalAssets).toBe(sheet.totalLiabilities + sheet.totalEquity);
    });
});
