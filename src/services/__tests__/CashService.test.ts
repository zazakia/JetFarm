import { CashService } from '../CashService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

/**
 * Cash-box coverage for the agribusiness build.
 *
 * The lending coop derived its cash balance from loan payments, approved
 * remittances, savings movements, share-capital deposits and loan
 * disbursements. Those tables are retired on this branch, so the balance is
 * now: starting float + manual cash in - expenses - manual cash out, all
 * measured from the first starting-balance record onward. This suite is the
 * guard that the retired feeds stay retired and that the remaining four
 * categories still add up.
 */
describe('CashService Integration', () => {
    let database: Database;
    let service: CashService;

    beforeEach(async () => {
        database = createTestDatabase();
        service = new CashService(database);
        (CashService as any).defaultInstance = service;
    });

    const seedCashTxn = async (row: {
        type: string;
        amount: number;
        transactionDate?: number;
        particulars?: string;
        isPettyCash?: boolean;
    }) => {
        await database.write(async () => {
            await database.get('cash_transactions').create((t: any) => {
                t.type = row.type;
                t.amount = row.amount;
                if (row.transactionDate !== undefined) t.transactionDate = row.transactionDate;
                if (row.particulars !== undefined) t.particulars = row.particulars;
                if (row.isPettyCash !== undefined) t.isPettyCash = row.isPettyCash;
            });
        });
    };

    const seedExpense = async (amount: number) => {
        await database.write(async () => {
            await database.get('expenses').create((e: any) => {
                e.amount = amount;
                e.description = 'Farm input';
            });
        });
    };

    describe('Static Methods Delegation', () => {
        it('delegates the surviving static methods to the instance', async () => {
            jest.spyOn(service, 'getCurrentBalance').mockResolvedValue(100);
            expect(await CashService.getCurrentBalance()).toBe(100);

            jest.spyOn(service, 'getPettyCashBalance').mockResolvedValue(200);
            expect(await CashService.getPettyCashBalance()).toBe(200);

            jest.spyOn(service, 'getBalanceBreakdown').mockResolvedValue({ balance: 300, categories: [] });
            expect(await CashService.getBalanceBreakdown()).toEqual({ balance: 300, categories: [] });
        });

        it('exposes no collector or timeframe collection readers', () => {
            // Those readers were the lending cash office; a reintroduced one would
            // need its deleted tables back, so assert they stay absent.
            expect((service as any).getCollectorBalance).toBeUndefined();
            expect((service as any).getTodayCollection).toBeUndefined();
            expect((service as any).getMonthCollection).toBeUndefined();
            expect((CashService as any).getCollectorBalance).toBeUndefined();
            expect((CashService as any).getTodayCollection).toBeUndefined();
            expect((CashService as any).getMonthCollection).toBeUndefined();
        });
    });

    describe('getCurrentBalance', () => {
        it('returns 0 balance for empty database', async () => {
            expect(await service.getCurrentBalance()).toBe(0);
        });

        it('calculates the balance from float, cash in, expenses and cash out', async () => {
            const cutoff = Date.now();
            await seedCashTxn({ type: 'starting_balance', amount: 5000, transactionDate: cutoff });
            await seedCashTxn({ type: 'in', amount: 1000, transactionDate: cutoff + 1000 });
            await seedCashTxn({ type: 'out', amount: 200, transactionDate: cutoff + 2000 });
            await seedExpense(300);

            // 5000 + 1000 - 300 - 200 = 5500
            expect(await service.getCurrentBalance()).toBe(5500);
        });

        it('ignores petty cash transactions when calculating the main vault balance', async () => {
            const cutoff = Date.now();
            await seedCashTxn({ type: 'starting_balance', amount: 5000, transactionDate: cutoff, isPettyCash: false });
            await seedCashTxn({ type: 'in', amount: 1000, transactionDate: cutoff + 1000, isPettyCash: true });
            await seedCashTxn({ type: 'out', amount: 200, transactionDate: cutoff + 2000, isPettyCash: true });

            expect(await service.getCurrentBalance()).toBe(5000);
        });

        it('ignores cash movements recorded before the first starting balance', async () => {
            const cutoff = Date.now();
            await seedCashTxn({ type: 'in', amount: 9000, transactionDate: cutoff - 5000 });
            await seedCashTxn({ type: 'starting_balance', amount: 10000, transactionDate: cutoff });
            await seedCashTxn({ type: 'in', amount: 1500, transactionDate: cutoff + 5000 });

            // The 9,000 predates the float; it is history, not cash movement.
            expect(await service.getCurrentBalance()).toBe(11500);
        });

        it('handles database errors gracefully in getCurrentBalance', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('DB Error'); });
            expect(await service.getCurrentBalance()).toBe(0);
        });

        it('returns zero if database is not initialized', async () => {
            const brokenService = new CashService(null as any);
            expect(await brokenService.getCurrentBalance()).toBe(0);
        });

        it('returns zero if collections are missing', async () => {
            const mockDb = { collections: { get: jest.fn().mockReturnValue(null) } } as any;
            const brokenService = new CashService(mockDb);
            expect(await brokenService.getCurrentBalance()).toBe(0);
        });
    });

    describe('getBalanceBreakdown', () => {
        it('reports exactly the four categories the cash box is built from', async () => {
            const cutoff = Date.now();
            await seedCashTxn({ type: 'starting_balance', amount: 10000, transactionDate: cutoff, particulars: 'Opening float' });
            await seedCashTxn({ type: 'in', amount: 2000, transactionDate: cutoff + 100, particulars: 'Harvest cash sale' });
            await seedCashTxn({ type: 'out', amount: 500, transactionDate: cutoff + 200, particulars: 'Truck diesel' });
            await seedExpense(700);

            const breakdown = await service.getBalanceBreakdown();

            // 10000 + 2000 - 700 - 500 = 10800
            expect(breakdown.balance).toBe(10800);
            expect(breakdown.categories.map(c => c.key)).toEqual([
                'starting_balance', 'cash_in', 'expenses', 'cash_out',
            ]);
            expect(breakdown.categories.find(c => c.key === 'cash_in')?.total).toBe(2000);
            expect(breakdown.categories.find(c => c.key === 'expenses')?.sign).toBe('-');
            expect(breakdown.categories.find(c => c.key === 'cash_in')?.items[0].label).toBe('Harvest cash sale');
        });

        it('keeps each category total equal to the sum of its drill-down items', async () => {
            const cutoff = Date.now();
            await seedCashTxn({ type: 'starting_balance', amount: 1000, transactionDate: cutoff });
            await seedCashTxn({ type: 'in', amount: 400, transactionDate: cutoff + 100 });
            await seedCashTxn({ type: 'in', amount: 600, transactionDate: cutoff + 200 });

            const breakdown = await service.getBalanceBreakdown();
            const cashIn = breakdown.categories.find(c => c.key === 'cash_in')!;

            expect(cashIn.items).toHaveLength(2);
            expect(cashIn.items.reduce((s, i) => s + i.amount, 0)).toBe(cashIn.total);
        });

        it('returns an empty breakdown when the database is unusable', async () => {
            const brokenService = new CashService(null as any);
            expect(await brokenService.getBalanceBreakdown()).toEqual({ balance: 0, categories: [] });
        });
    });

    describe('getPettyCashBalance', () => {
        it('calculates petty cash balance correctly', async () => {
            const cutoff = Date.now();
            await seedCashTxn({ type: 'starting_balance', amount: 2000, transactionDate: cutoff, isPettyCash: true });
            await seedCashTxn({ type: 'in', amount: 500, transactionDate: cutoff + 100, isPettyCash: true });
            await seedCashTxn({ type: 'out', amount: 300, transactionDate: cutoff + 200, isPettyCash: true });
            await seedCashTxn({ type: 'in', amount: 1000, transactionDate: cutoff + 300, isPettyCash: false });

            // 2000 + 500 - 300 = 2200 (the main-vault row is excluded)
            expect(await service.getPettyCashBalance()).toBe(2200);
        });

        it('returns zero if database is not initialized', async () => {
            const brokenService = new CashService(null as any);
            expect(await brokenService.getPettyCashBalance()).toBe(0);
        });
    });
});
