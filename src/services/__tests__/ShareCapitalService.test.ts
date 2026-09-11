import { ShareCapitalService } from '../ShareCapitalService';
import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';

jest.mock('../../database', () => ({
    database: {
        get: jest.fn(),
        write: jest.fn().mockImplementation((callback) => callback())
    }
}));

jest.mock('../ActionLogService', () => ({
    __esModule: true,
    default: {
        logAction: jest.fn().mockResolvedValue(undefined),
        logActions: jest.fn().mockResolvedValue(undefined)
    }
}));

describe('ShareCapitalService', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getCurrentBalance', () => {
        it('calculates total paid amount and shares correctly', async () => {
            const mockTransactions = [
                { runningBalanceAmount: 2500, runningBalanceShares: 25 }
            ];

            const mockQuery = {
                fetch: jest.fn().mockResolvedValue(mockTransactions)
            };

            (database.get as jest.Mock).mockReturnValue({
                query: jest.fn().mockReturnValue(mockQuery)
            });

            const balance = await ShareCapitalService.getCurrentBalance('borrower-1');

            expect(balance.amount).toBe(2500); // 1000 + 2000 - 500
            expect(balance.shares).toBe(25); // 2500 / 100 (par value)
        });
    });

    describe('deposit', () => {
        it('creates a deposit transaction', async () => {
            const mockCreate = jest.fn();
            (database.get as jest.Mock).mockReturnValue({
                create: mockCreate,
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([])
                })
            });

            await ShareCapitalService.deposit('borrower-1', 1000, 'admin');

            expect(mockCreate).toHaveBeenCalled();
            const callback = mockCreate.mock.calls[0][0];
            const record: any = {};
            callback(record);

            expect(record.memberId).toBe('borrower-1');
            expect(record.transactionType).toBe('DEPOSIT');
            expect(record.amount).toBe(1000);
            expect(record.recordedBy).toBe('admin');
        });
    });

    describe('subscribe', () => {
        it('creates a subscription transaction', async () => {
            const mockCreate = jest.fn();
            (database.get as jest.Mock).mockReturnValue({
                create: mockCreate,
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([])
                })
            });

            await ShareCapitalService.subscribe('borrower-1', 'COMMON', 5000, 50, 100, 'admin');

            expect(mockCreate).toHaveBeenCalled();
            const callback = mockCreate.mock.calls[0][0];
            const record: any = {};
            callback(record);

            expect(record.memberId).toBe('borrower-1');
            expect(record.transactionType).toBe('SUBSCRIPTION');
            expect(record.shareType).toBe('COMMON');
            expect(record.numberOfShares).toBe(50);
            expect(record.amount).toBe(5000);
            expect(record.parValue).toBe(100);
            expect(record.recordedBy).toBe('admin');
        });
    });

    describe('updateTransaction', () => {
        it('updates transaction fields and logs action', async () => {
            const mockTx = {
                id: 'tx-1',
                amount: 1000,
                notes: '',
                _raw: { id: 'tx-1', amount: 1000 },
                update: jest.fn().mockImplementation(async (cb) => cb(mockTx))
            };
            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue(mockTx)
            });

            const result = await ShareCapitalService.updateTransaction('tx-1', { amount: 1500, notes: 'Updated' }, 'user-1');

            expect(mockTx.update).toHaveBeenCalled();
            expect(result).toBe(mockTx);
        });
    });

    describe('deleteTransaction', () => {
        it('soft deletes transaction by setting deletedAt', async () => {
            const mockTx = {
                id: 'tx-1',
                deletedAt: null as number | null,
                _raw: { id: 'tx-1', amount: 1000 },
                update: jest.fn().mockImplementation(async (cb) => cb(mockTx))
            };
            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue(mockTx)
            });

            await ShareCapitalService.deleteTransaction('tx-1', 'user-1');

            expect(mockTx.update).toHaveBeenCalled();
            expect(mockTx.deletedAt).toBeGreaterThan(0);
        });
    });

    describe('deleteTransactionById', () => {
        it('routes to share_capital_transactions when isLegacy=false', async () => {
            const mockTx = {
                id: 'tx-native',
                deletedAt: null as number | null,
                _raw: { id: 'tx-native', amount: 500 },
                update: jest.fn().mockImplementation(async (cb) => cb(mockTx))
            };
            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue(mockTx)
            });

            await ShareCapitalService.deleteTransactionById('tx-native', false, 'user-1');

            // Should call database.get with share_capital_transactions
            expect(database.get).toHaveBeenCalledWith('share_capital_transactions');
            expect(mockTx.deletedAt).toBeGreaterThan(0);
        });

        it('routes to savings_transactions when isLegacy=true', async () => {
            const mockLegacyTx = {
                id: 'tx-legacy',
                deletedAt: null as number | null,
                _raw: { id: 'tx-legacy', amount: 300 },
                update: jest.fn().mockImplementation(async (cb) => cb(mockLegacyTx))
            };
            (database.get as jest.Mock).mockReturnValue({
                find: jest.fn().mockResolvedValue(mockLegacyTx)
            });

            await ShareCapitalService.deleteTransactionById('tx-legacy', true, 'user-1');

            // Should call database.get with savings_transactions for legacy rows
            expect(database.get).toHaveBeenCalledWith('savings_transactions');
            expect(mockLegacyTx.deletedAt).toBeGreaterThan(0);
        });
    });

    describe('deposit duplicate guard', () => {
        it('throws when an identical deposit exists within the last 60 seconds', async () => {
            const recentTx = [{ id: 'dup-tx' }]; // Simulate existing duplicate
            (database.get as jest.Mock).mockReturnValue({
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue(recentTx)
                }),
                create: jest.fn()
            });

            await expect(
                ShareCapitalService.deposit('borrower-1', 1000, 'admin')
            ).rejects.toThrow('Duplicate CBU deposit detected');
        });

        it('proceeds when no duplicate exists within the last 60 seconds', async () => {
            const mockCreate = jest.fn();
            // First call (duplicate check): empty result; second call (getCurrentBalance): empty; third call (create)
            (database.get as jest.Mock).mockReturnValue({
                query: jest.fn().mockReturnValue({
                    fetch: jest.fn().mockResolvedValue([]) // no duplicates
                }),
                create: mockCreate
            });

            await ShareCapitalService.deposit('borrower-1', 1000, 'admin');

            expect(mockCreate).toHaveBeenCalled();
        });
    });
});
