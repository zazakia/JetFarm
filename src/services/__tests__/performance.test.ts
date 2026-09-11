import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';
import { mySchema } from '../../database/schema';
import Borrower from '../../database/models/Borrower';
import Loan from '../../database/models/Loan';
import Payment from '../../database/models/Payment';
import PaymentSchedule from '../../database/models/PaymentSchedule';
import Expense from '../../database/models/Expense';
import CashTransaction from '../../database/models/CashTransaction';
import BankAccount from '../../database/models/BankAccount';
import BankTransaction from '../../database/models/BankTransaction';
import CollectionLog from '../../database/models/CollectionLog';
import FinancialSnapshot from '../../database/models/FinancialSnapshot';
import UserProfile from '../../database/models/UserProfile';
import Remittance from '../../database/models/Remittance';
import SavingsTransaction from '../../database/models/SavingsTransaction';
import ExpenseCategory from '../../database/models/ExpenseCategory';
import Collector from '../../database/models/Collector';
import LoanPenalty from '../../database/models/LoanPenalty';
import CollectionGroup from '../../database/models/CollectionGroup';
import ActionLog from '../../database/models/ActionLog';
import { BaseModelServiceClass } from '../BaseModelService';
import { perf } from '../../utils/PerformanceTracker';
import { closeTestDatabase } from '../../__tests__/test-utils';
import { ErrorService } from "../ErrorService";

const modelClasses = [
    UserProfile,
    Collector,
    Borrower,
    Loan,
    Payment,
    PaymentSchedule,
    Expense,
    CashTransaction,
    BankAccount,
    BankTransaction,
    CollectionLog,
    FinancialSnapshot,
    Remittance,
    SavingsTransaction,
    ExpenseCategory,
    LoanPenalty,
    CollectionGroup,
    ActionLog,
];

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
        it('measures time to create 100 borrowers', async () => {
            await perf.measure('Bulk.Create(100)', async () => {
                await database.write(async () => {
                    const collection = database.get<Borrower>('borrowers');
                    const creators = Array.from({ length: 100 }).map((_, i) => 
                        collection.prepareCreate((r: any) => {
                            r.fullName = `Borrower ${i}`;
                            r.id = `id-${i}`;
                        })
                    );
                    await database.batch(...creators);
                });
            });
        });

        it('measures time to create 500 loans', async () => {
            await perf.measure('Bulk.Create(500)', async () => {
                await database.write(async () => {
                    const collection = database.get<Loan>('loans');
                    const creators = Array.from({ length: 500 }).map((_, i) => 
                        collection.prepareCreate((r: any) => {
                            r.loanNumber = `LN-${i}`;
                            r.borrowerId = `id-${i % 100}`;
                            r.status = 'active';
                            r.interestType = 'flat';
                            r.frequency = 'daily';
                            r.term = 30;
                            r.termUnit = 'days';
                            r.totalAmount = 1000;
                            r.principalAmount = 900;
                            r.interestRate = 10;
                            r.installmentAmount = 33.33;
                        })
                    );
                    await database.batch(...creators);
                });
            });
        });
    });

    describe('Database Read Performance', () => {
        it('measures time to fetch all active borrowers (100)', async () => {
            const borrowers = await service.fetchActive<Borrower>('borrowers');
            expect(borrowers.length).toBeGreaterThanOrEqual(100);
        });

        it('measures time to fetch all active loans (500)', async () => {
            const loans = await service.fetchActive<Loan>('loans');
            expect(loans.length).toBeGreaterThanOrEqual(500);
        });

        it('measures time for a complex joined query (conceptual)', async () => {
            await perf.measure('Complex.Query(ActiveLoansWithBorrowers)', async () => {
                // In WatermelonDB, relations are lazy, but we can measure the query execution
                await database.get('loans').query().fetch();
            });
        });
    });

    describe('Service Logic Performance', () => {
        it('measures time to perform cascade delete on a borrower', async () => {
            try {
                const borrower = await database.write(async () => {
                    return await database.get<Borrower>('borrowers').create((r: any) => {
                        r.fullName = 'Clean Borrower';
                    });
                });

                console.log('Created clean borrower:', borrower.id);
                
                await perf.measure('Service.CascadeDeleteBorrower', async () => {
                    await service.cascadeDeleteBorrower(borrower);
                });
            } catch (err) {
                ErrorService.handleError(err, 'ERROR in cascade delete test:');
                throw ErrorService.handleError(err, 'performance.test');
            }
        });
    });
});
