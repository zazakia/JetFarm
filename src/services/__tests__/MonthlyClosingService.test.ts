import { MonthlyClosingService } from '../MonthlyClosingService';
import { MfiKpiService } from '../MfiKpiService';
import FinancialSnapshot from '../../database/models/FinancialSnapshot';

// We need to import the mocked database to interact with it in tests
import { database } from '../../database';

// Mock the database module to inject our test DB
jest.mock('../../database', () => {
    const { createTestDatabase } = jest.requireActual('../../__tests__/test-utils');
    const db = createTestDatabase();
    return { database: db };
});

jest.mock('../MfiKpiService', () => ({
    MfiKpiService: {
        getBalanceSheet: jest.fn(),
        getIncomeStatement: jest.fn(),
        getAdvancedKpis: jest.fn(),
    },
}));

describe('MonthlyClosingService', () => {
    beforeEach(async () => {
        // Clean the database safely — manually delete all financial_snapshots
        // instead of using unsafeResetDatabase() which destroys the adapter
        await database.write(async () => {
            const snapshots = await database.get('financial_snapshots').query().fetch();
            for (const snap of snapshots) {
                await snap.destroyPermanently();
            }
        });
        jest.clearAllMocks();
    });

    describe('closeMonth', () => {
        it('creates a financial snapshot for the given month', async () => {
            const testDate = new Date('2024-03-15');

            (MfiKpiService.getBalanceSheet as jest.Mock).mockResolvedValue({
                assets: { totalAssets: 100000, loanPortfolio: 80000 },
                equity: { totalEquity: 60000 },
                liabilities: { totalLiabilities: 40000 },
            });

            (MfiKpiService.getIncomeStatement as jest.Mock).mockResolvedValue({
                operatingRevenue: 15000,
                financialCosts: 3000,
                loanLossProvisions: 1000,
            });

            (MfiKpiService.getAdvancedKpis as jest.Mock).mockResolvedValue({});

            const result = await MonthlyClosingService.closeMonth(testDate);

            expect(result).not.toBeNull();
            const snapshots = await database.get<FinancialSnapshot>('financial_snapshots').query().fetch();
            expect(snapshots.length).toBe(1);
            
            const snapshot = snapshots[0];
            expect(snapshot.totalAssets).toBe(100000);
            expect(snapshot.totalEquity).toBe(60000);
            expect(snapshot.totalLiabilities).toBe(40000);
            expect(snapshot.loanLossReserve).toBe(1000);
            expect(snapshot.operatingRevenue).toBe(15000);
            expect(snapshot.financialCosts).toBe(3000);
            expect(snapshot.riskWeightedAssets).toBe(80000 * 1.2);
        });

        it('returns null on error', async () => {
            (MfiKpiService.getBalanceSheet as jest.Mock).mockRejectedValue(new Error('API Error'));
            const result = await MonthlyClosingService.closeMonth(new Date());
            expect(result).toBeNull();
        });
    });

    describe('isMonthClosed', () => {
        it('returns true if a snapshot exists for the month end', async () => {
            const testDate = new Date('2024-03-15');
            
            (MfiKpiService.getBalanceSheet as jest.Mock).mockResolvedValue({
                assets: { totalAssets: 0, loanPortfolio: 0 },
                equity: { totalEquity: 0 },
                liabilities: { totalLiabilities: 0 },
            });
            (MfiKpiService.getIncomeStatement as jest.Mock).mockResolvedValue({
                operatingRevenue: 0,
                financialCosts: 0,
                loanLossProvisions: 0,
            });
            (MfiKpiService.getAdvancedKpis as jest.Mock).mockResolvedValue({});
            
            await MonthlyClosingService.closeMonth(testDate);
            
            const isClosed = await MonthlyClosingService.isMonthClosed(testDate);
            expect(isClosed).toBe(true);
        });

        it('returns false if no snapshot exists', async () => {
            const isClosed = await MonthlyClosingService.isMonthClosed(new Date('2024-03-15'));
            expect(isClosed).toBe(false);
        });
    });

    describe('getClosingHistory', () => {
        it('returns all financial snapshots', async () => {
             (MfiKpiService.getBalanceSheet as jest.Mock).mockResolvedValue({
                assets: { totalAssets: 0, loanPortfolio: 0 },
                equity: { totalEquity: 0 },
                liabilities: { totalLiabilities: 0 },
            });
            (MfiKpiService.getIncomeStatement as jest.Mock).mockResolvedValue({
                operatingRevenue: 0,
                financialCosts: 0,
                loanLossProvisions: 0,
            });
            (MfiKpiService.getAdvancedKpis as jest.Mock).mockResolvedValue({});
            
            await MonthlyClosingService.closeMonth(new Date('2024-01-15'));
            await MonthlyClosingService.closeMonth(new Date('2024-02-15'));
            
            const history = await MonthlyClosingService.getClosingHistory();
            expect(history.length).toBe(2);
        });
    });
});
