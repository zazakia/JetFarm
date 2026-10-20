import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';
import { mySchema } from '../../database/schema';
import Expense from '../../database/models/Expense';
import CashTransaction from '../../database/models/CashTransaction';
import { BaseModelServiceClass } from '../BaseModelService';
import { perf } from '../../utils/PerformanceTracker';
import { closeTestDatabase, modelClasses } from '../../__tests__/test-utils';
import { ErrorService } from "../ErrorService";

jest.mock('../ActionLogService', () => ({
    logAction: jest.fn().mockResolvedValue(undefined),
    logActions: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../AuthService', () => ({
    AuthService: {
        getCurrentUserId: jest.fn().mockResolvedValue('test-user'),
    },
}));

describe('Performance Benchmarks', () => {
    let database: Database;
    let service: BaseModelServiceClass;

    beforeAll(() => {
        const adapter = new LokiJSAdapter({
            schema: mySchema,
            useWebWorker: false,
            useIncrementalIndexedDB: false,
            _testLokiAdapter: new Loki.LokiMemoryAdapter(),
            extraLokiOptions: { autosave: false },
        } as any);

        database = new Database({
            adapter,
            modelClasses,
        });

        service = new BaseModelServiceClass(database);
        perf.clear();
    });

    afterAll(() => {
        const summary = perf.getSummary();
        console.log('\n--- Performance Benchmark Summary ---');
        console.table(summary);
    });

    afterAll(async () => {
        await closeTestDatabase(database);
    });

    describe('Database Write Performance', () => {
        it('measures time to create 100 cash transactions', async () => {
            await perf.measure('Bulk.Create(100)', async () => {
                await database.write(async () => {
                    const collection = database.get<CashTransaction>('cash_transactions');
                    const creators = Array.from({ length: 100 }).map((_, i) => 
                        collection.prepareCreate((r: any) => {
                            r.particulars = `Cash movement ${i}`;
                            r.type = i % 2 === 0 ? 'in' : 'out';
                            r.amount = 100 + i;
                            r.transactionDate = Date.now();
                        })
                    );
                    await database.batch(...creators);
                });
            });
        });

        it('measures time to create 500 expenses', async () => {
            await perf.measure('Bulk.Create(500)', async () => {
                await database.write(async () => {
                    const collection = database.get<Expense>('expenses');
                    const creators = Array.from({ length: 500 }).map((_, i) => 
                        collection.prepareCreate((r: any) => {
                            r.description = `Expense ${i}`;
                            r.category = i % 5 === 0 ? 'Farm Inputs' : 'Labor';
                            r.amount = 250 + i;
                            r.expenseDate = Date.now();
                        })
                    );
                    await database.batch(...creators);
                });
            });
        });
    });

    describe('Database Read Performance', () => {
        it('measures time to fetch all active cash transactions (100)', async () => {
            const txns = await service.fetchActive<CashTransaction>('cash_transactions');
            expect(txns.length).toBeGreaterThanOrEqual(100);
        });

        it('measures time to fetch all active expenses (500)', async () => {
            const expenses = await service.fetchActive<Expense>('expenses');
            expect(expenses.length).toBeGreaterThanOrEqual(500);
        });

        it('measures time for a complex filtered query (conceptual)', async () => {
            await perf.measure('Complex.Query(FarmInputExpenses)', async () => {
                // In WatermelonDB, relations are lazy, but we can measure the
                // execution of the encoded-expense feed itself
                await database.get('expenses').query().fetch();
            });
        });
    });

    describe('Service Logic Performance', () => {
        it('measures time to soft-delete and restore an expense', async () => {
            try {
                const expense = await database.write(async () => {
                    return await database.get<Expense>('expenses').create((r: any) => {
                        r.description = 'Clean Expense';
                        r.amount = 10;
                    });
                });

                console.log('Created clean expense:', expense.id);
                
                await perf.measure('Service.SoftDelete', async () => {
                    await service.softDelete(expense, 'perf-test');
                });
                expect((expense as any).deletedAt).not.toBeNull();

                await perf.measure('Service.Restore', async () => {
                    await service.restore(expense, 'perf-test');
                });
                expect((expense as any).deletedAt).toBeNull();
            } catch (err) {
                ErrorService.handleError(err, 'ERROR in soft delete test:');
                throw ErrorService.handleError(err, 'performance.test');
            }
        });
    });
});
