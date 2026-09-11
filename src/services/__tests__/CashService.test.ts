import { CashService } from '../CashService';
import { createTestDatabase } from '../../__tests__/test-utils';
import { Database } from '@nozbe/watermelondb';

describe('CashService Integration', () => {
    let database: Database;
    let service: CashService;

    beforeEach(async () => {
        database = createTestDatabase();
        service = new CashService(database);
        (CashService as any).defaultInstance = service;
    });

    describe('Static Methods Delegation', () => {
        it('delegates all static methods to the instance', async () => {
            const spy1 = jest.spyOn(service, 'getCurrentBalance').mockResolvedValue(100);
            expect(await CashService.getCurrentBalance()).toBe(100);

            const spy2 = jest.spyOn(service, 'getCollectorBalance').mockResolvedValue(200);
            expect(await CashService.getCollectorBalance('c1')).toBe(200);

            const spy3 = jest.spyOn(service, 'getTodayCollection').mockResolvedValue(300);
            expect(await CashService.getTodayCollection()).toBe(300);

            const spy4 = jest.spyOn(service, 'getMonthCollection').mockResolvedValue(400);
            expect(await CashService.getMonthCollection()).toBe(400);
        });
    });

    describe('getCurrentBalance', () => {
        it('returns 0 balance for empty database', async () => {
            expect(await service.getCurrentBalance()).toBe(0);
        });

        it('calculates balance with all transaction types', async () => {
            await database.write(async () => {
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'starting_balance';
                    t.amount = 5000;
                });
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'in';
                    t.amount = 1000;
                });
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'out';
                    t.amount = 200;
                });
                await database.get('remittances').create((r: any) => {
                    r.amount = 1500;
                    r.status = 'approved';
                });
                await database.get('expenses').create((e: any) => {
                    e.amount = 300;
                });
            });

            // 5000 + 1000 + 1500 - 200 - 300 = 7000
            expect(await service.getCurrentBalance()).toBe(7000);
        });

        it('ignores petty cash transactions when calculating main vault balance', async () => {
            await database.write(async () => {
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'starting_balance';
                    t.amount = 5000;
                    t.isPettyCash = false;
                });
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'in';
                    t.amount = 1000;
                    t.isPettyCash = true; // Petty cash deposit, ignore
                });
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'out';
                    t.amount = 200;
                    t.isPettyCash = true; // Petty cash expense, ignore
                });
            });

            // Main vault only counts the starting_balance (5000)
            expect(await service.getCurrentBalance()).toBe(5000);
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

        it('calculates balance by connecting to disbursements, payments, savings, and share capital', async () => {
            const cutoffTime = Date.now();
            await database.write(async () => {
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'starting_balance';
                    t.amount = 5000;
                    t.transactionDate = cutoffTime;
                });
                // Payment (Cash collections) (+ 1000)
                await database.get('payments').create((p: any) => {
                    p.amount = 1000;
                    p.paymentDate = cutoffTime + 1000;
                });
                // Savings deposit (+ 800)
                await database.get('savings_transactions').create((s: any) => {
                    s.type = 'deposit';
                    s.amount = 800;
                    s.date = cutoffTime + 2000;
                });
                // Savings withdrawal (- 300)
                await database.get('savings_transactions').create((s: any) => {
                    s.type = 'withdraw_cash';
                    s.amount = 300;
                    s.date = cutoffTime + 3000;
                });
                // Share Capital (+ 2000)
                await database.get('share_capital_transactions').create((s: any) => {
                    s.transactionType = 'DEPOSIT';
                    s.amount = 2000;
                    s.transactionDate = cutoffTime + 4000;
                });
                // Loan Disbursement (- 4000)
                await database.get('loans').create((l: any) => {
                    l.principalAmount = 4000;
                    l.status = 'active';
                    l.releaseDate = cutoffTime + 5000;
                });
                // Loan Disbursement before cutoff (should be ignored)
                await database.get('loans').create((l: any) => {
                    l.principalAmount = 10000;
                    l.status = 'active';
                    l.releaseDate = cutoffTime - 10000;
                });
            });

            // 5000 + 1000 + 800 - 300 + 2000 - 4000 = 4500
            expect(await service.getCurrentBalance()).toBe(4500);
        });

        it('excludes migration summary cash transactions to prevent double counting with individual savings/share capital', async () => {
            const cutoffTime = Date.now();
            await database.write(async () => {
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'starting_balance';
                    t.amount = 10000;
                    t.transactionDate = cutoffTime;
                });
                // Compound migration cash-in entry (should be excluded from manual cash-in)
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'in';
                    t.amount = 633968.78;
                    t.particulars = 'Total CBU and Savings Migration 2025';
                    t.transactionDate = cutoffTime + 100;
                });
                // Individual savings deposit
                await database.get('savings_transactions').create((s: any) => {
                    s.type = 'deposit';
                    s.amount = 5000;
                    s.date = cutoffTime + 200;
                });
                // Individual share capital deposit
                await database.get('share_capital_transactions').create((s: any) => {
                    s.transactionType = 'DEPOSIT';
                    s.amount = 10000;
                    s.transactionDate = cutoffTime + 300;
                });
            });

            // Balance should be: Starting (10,000) + Savings (5,000) + Share Capital (10,000) = 25,000 (NOT + 633,968.78)
            expect(await service.getCurrentBalance()).toBe(25000);

            const breakdown = await service.getBalanceBreakdown();
            expect(breakdown.balance).toBe(25000);
            const manualCashIn = breakdown.categories.find(c => c.key === 'cash_in');
            expect(manualCashIn?.total).toBe(0);
        });
    });

    describe('getPettyCashBalance', () => {
        it('calculates petty cash balance correctly', async () => {
            await database.write(async () => {
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'starting_balance';
                    t.amount = 2000;
                    t.isPettyCash = true;
                });
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'in';
                    t.amount = 500;
                    t.isPettyCash = true;
                });
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'out';
                    t.amount = 300;
                    t.isPettyCash = true;
                });
                await database.get('cash_transactions').create((t: any) => {
                    t.type = 'in';
                    t.amount = 1000;
                    t.isPettyCash = false; // Main vault transaction, ignore
                });
            });

            // 2000 + 500 - 300 = 2200
            expect(await service.getPettyCashBalance()).toBe(2200);
        });

        it('delegates static method for petty cash balance', async () => {
            const spy = jest.spyOn(service, 'getPettyCashBalance').mockResolvedValue(150);
            expect(await CashService.getPettyCashBalance()).toBe(150);
        });

        it('returns zero if database is not initialized in getPettyCashBalance', async () => {
            const brokenService = new CashService(null as any);
            expect(await brokenService.getPettyCashBalance()).toBe(0);
        });
    });

    describe('getCollectorBalance', () => {
        it('calculates collector balance correctly', async () => {
            const collectorId = 'coll-1';
            await database.write(async () => {
                await database.get('payments').create((p: any) => {
                    p.collectorId = collectorId;
                    p.amount = 1000;
                });
                await database.get('remittances').create((r: any) => {
                    r.collectorId = collectorId;
                    r.amount = 400;
                    r.status = 'approved';
                });
            });
            expect(await service.getCollectorBalance(collectorId)).toBe(600);
        });

        it('handles errors in getCollectorBalance', async () => {
            jest.spyOn(database.collections, 'get').mockImplementation(() => { throw new Error('DB Error'); });
            expect(await service.getCollectorBalance('any')).toBe(0);
        });

        it('returns zero if database is not initialized in getCollectorBalance', async () => {
            const brokenService = new CashService(null as any);
            expect(await brokenService.getCollectorBalance('any')).toBe(0);
        });
    });

    describe('Collection Timeframes', () => {
        it('filters today and month collections', async () => {
            const now = new Date();
            const today = now.getTime();
            const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            
            await database.write(async () => {
                await database.get('payments').create((p: any) => {
                    p.amount = 500;
                    p.paymentDate = today;
                });
            });

            expect(await service.getTodayCollection()).toBe(500);
            expect(await service.getMonthCollection()).toBe(500);
        });

        it('handles errors in timeframe collections', async () => {
            const brokenService = new CashService(null as any);
            expect(await brokenService.getTodayCollection()).toBe(0);
            expect(await brokenService.getMonthCollection()).toBe(0);
        });
    });
});
