import { CooperativeSavingsService } from '../CooperativeSavingsService';
import { database } from '../../database';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn().mockImplementation((callback) => callback())
    }
}));

jest.mock('../SettingsService', () => ({
    SettingsService: {
        getNumberSetting: jest.fn((key, fallback) => Promise.resolve(fallback))
    }
}));

jest.mock('../ActionLogService', () => ({
    __esModule: true,
    default: {
        logAction: jest.fn().mockResolvedValue(undefined),
        logActions: jest.fn().mockResolvedValue(undefined)
    }
}));

describe('CooperativeSavingsService', () => {
    let mockQuery: any;
    let mockFetch: any;

    beforeEach(() => {
        mockFetch = jest.fn();
        mockQuery = jest.fn().mockReturnValue({ fetch: mockFetch });
        (database.get as jest.Mock).mockReturnValue({ query: mockQuery });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        jest.clearAllMocks();
    });

    describe('getTransactions', () => {
        it('queries database for savings transactions sorted by date', async () => {
            const mockTxList = [{ id: 'tx-1', amount: 500, type: 'deposit', date: 1711382400000 }];
            mockFetch.mockResolvedValue(mockTxList);

            const result = await CooperativeSavingsService.getTransactions('borrower-1');
            expect(result).toEqual(mockTxList);
            expect(database.get).toHaveBeenCalledWith('savings_transactions');
            expect(mockQuery).toHaveBeenCalled();
        });
    });

    describe('getBalanceAsOf', () => {
        it('calculates correct running balance excluding post-as-of transactions', async () => {
            const mockTxList = [
                { type: 'deposit', amount: 1000, date: new Date('2026-03-01').getTime() },
                { type: 'withdrawal', amount: 300, date: new Date('2026-03-05').getTime() },
                { type: 'interest', amount: 50, date: new Date('2026-03-10').getTime() },
                { type: 'deposit', amount: 500, date: new Date('2026-03-20').getTime() }
            ];
            mockFetch.mockResolvedValue(mockTxList);

            // As of 2026-03-06 (includes 1st and 5th, excludes 10th and 20th)
            const balance = await CooperativeSavingsService.getBalanceAsOf('borrower-1', new Date('2026-03-06'));
            expect(balance).toBe(700); // 1000 - 300
        });
    });

    describe('calculateAverageMonthlyBalance', () => {
        it('calculates correct average daily balance for a month', async () => {
            // January 2026
            const mockTxList = [
                { type: 'deposit', amount: 1000, date: new Date('2026-01-05').getTime() }, // Day 5
                { type: 'withdrawal', amount: 300, date: new Date('2026-01-15').getTime() } // Day 15
            ];
            mockFetch.mockResolvedValue(mockTxList);

            // Spy on getBalanceAsOf to return initial balance of 0
            jest.spyOn(CooperativeSavingsService, 'getBalanceAsOf').mockResolvedValue(0);

            const amb = await CooperativeSavingsService.calculateAverageMonthlyBalance('borrower-1', 2026, 0);

            // Day 1 to 4: balance = 0
            // Day 5 to 14: balance = 1000 (10 days)
            // Day 15 to 31: balance = 700 (17 days)
            // Sum = 0*4 + 1000*10 + 700*17 = 21900
            // Days in Jan = 31
            // AMB = 21900 / 31 = 706.45...
            expect(amb).toBeCloseTo(21900 / 31);
        });
    });

    describe('calculateQuarterlyInterest', () => {
        it('calculates 0 interest if average monthly balance is below maintaining balance', async () => {
            jest.spyOn(CooperativeSavingsService, 'calculateAverageMonthlyBalance')
                .mockResolvedValueOnce(50)   // Month 1
                .mockResolvedValueOnce(80)   // Month 2
                .mockResolvedValueOnce(100); // Month 3

            const interest = await CooperativeSavingsService.calculateQuarterlyInterest('borrower-1', 2026, 1);
            expect(interest).toBe(0);
        });

        it('calculates correct interest for a qualifying average monthly balance', async () => {
            jest.spyOn(CooperativeSavingsService, 'calculateAverageMonthlyBalance')
                .mockResolvedValueOnce(15000) // Month 1
                .mockResolvedValueOnce(15000) // Month 2
                .mockResolvedValueOnce(15000); // Month 3

            const interest = await CooperativeSavingsService.calculateQuarterlyInterest('borrower-1', 2026, 1);
            expect(interest).toBe(225);
        });

        it('rounds interest to 2 decimal places', async () => {
            jest.spyOn(CooperativeSavingsService, 'calculateAverageMonthlyBalance')
                .mockResolvedValueOnce(10050.25)
                .mockResolvedValueOnce(10050.25)
                .mockResolvedValueOnce(10050.25);

            const interest = await CooperativeSavingsService.calculateQuarterlyInterest('borrower-1', 2026, 1);
            expect(interest).toBe(150.75);
        });
    });

    describe('updateTransaction', () => {
        it('updates transaction fields and logs action', async () => {
            const mockTx = {
                id: 'tx-1',
                amount: 500,
                type: 'deposit',
                notes: '',
                _raw: { id: 'tx-1', amount: 500 },
                update: jest.fn().mockImplementation(async (cb) => cb(mockTx))
            };
            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue(mockTx)
            });

            const result = await CooperativeSavingsService.updateTransaction('tx-1', { amount: 800, notes: 'Updated' }, 'user-1');

            expect(mockTx.update).toHaveBeenCalled();
            expect(result).toBe(mockTx);
        });
    });

    describe('deleteTransaction', () => {
        it('soft deletes savings transaction by setting deletedAt', async () => {
            const mockTx = {
                id: 'tx-1',
                deletedAt: null as number | null,
                _raw: { id: 'tx-1', amount: 500 },
                update: jest.fn().mockImplementation(async (cb) => cb(mockTx))
            };
            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue(mockTx)
            });

            await CooperativeSavingsService.deleteTransaction('tx-1', 'user-1');

            expect(mockTx.update).toHaveBeenCalled();
            expect(mockTx.deletedAt).toBeGreaterThan(0);
        });
    });
});
