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
import ActionLogServiceInstance, { ActionLogService } from '../ActionLogService';
import { BaseModelServiceClass } from '../BaseModelService';

import { closeTestDatabase } from '../../__tests__/test-utils';

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
    __esModule: true,
    ActionLogService: jest.fn(),
    default: {
        logAction: jest.fn().mockResolvedValue(undefined),
        logActions: jest.fn().mockResolvedValue(undefined),
    }
}));

describe('BaseModelService', () => {
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
    });

    afterEach(async () => {
        jest.clearAllMocks();
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
    });

    afterAll(async () => {
        await closeTestDatabase(database);
    });

    describe('fetchActive and fetchDeleted', () => {
        it('fetches only records with null deleted_at for active', async () => {
            await database.write(async () => {
                await database.get('borrowers').create((r: any) => {
                    r.fullName = 'Active';
                    r.deletedAt = null;
                });
                await database.get('borrowers').create((r: any) => {
                    r.fullName = 'Deleted';
                    r.deletedAt = Date.now();
                });
            });

            const active = await service.fetchActive<Borrower>('borrowers');
            expect(active.length).toBe(1);
            expect((active[0] as any).fullName).toBe('Active');

            const deleted = await service.fetchDeleted<Borrower>('borrowers');
            expect(deleted.length).toBe(1);
            expect((deleted[0] as any).fullName).toBe('Deleted');
        });
    });

    describe('CRUD operations', () => {
        const crudCases: {
            table: string;
            label: string;
            create: (record: any) => void;
            update: (record: any) => void;
            expectUpdated: (record: any) => void;
        }[] = [
            {
                table: 'user_profiles',
                label: 'user profiles',
                create: (r) => { r.fullName = 'CRUD User'; r.email = 'crud-user@example.com'; r.role = 'admin'; r.isActive = true; },
                update: (r) => { r.fullName = 'CRUD User Updated'; },
                expectUpdated: (r) => expect(r.fullName).toBe('CRUD User Updated'),
            },
            {
                table: 'collectors',
                label: 'collectors',
                create: (r) => { r.fullName = 'CRUD Collector'; r.authId = 'auth-collector'; r.isActive = true; },
                update: (r) => { r.fullName = 'CRUD Collector Updated'; },
                expectUpdated: (r) => expect(r.fullName).toBe('CRUD Collector Updated'),
            },
            {
                table: 'borrowers',
                label: 'borrowers',
                create: (r) => { r.fullName = 'CRUD Borrower'; r.phone = '09170000000'; r.collectorId = 'collector-1'; },
                update: (r) => { r.phone = '09171111111'; },
                expectUpdated: (r) => expect(r.phone).toBe('09171111111'),
            },
            {
                table: 'loans',
                label: 'loans',
                create: (r) => {
                    r.borrowerId = 'borrower-1';
                    r.loanNumber = 'CRUD-LOAN-1';
                    r.principalAmount = 1000;
                    r.interestRate = 5;
                    r.interestType = 'flat';
                    r.term = 30;
                    r.termUnit = 'days';
                    r.frequency = 'daily';
                    r.totalAmount = 1050;
                    r.installmentAmount = 35;
                    r.status = 'active';
                },
                update: (r) => { r.status = 'paid'; },
                expectUpdated: (r) => expect(r.status).toBe('paid'),
            },
            {
                table: 'payments',
                label: 'payments',
                create: (r) => { r.loanId = 'loan-1'; r.borrowerId = 'borrower-1'; r.amount = 100; r.paymentDate = Date.now(); r.receiptNumber = 'RCT-1'; },
                update: (r) => { r.amount = 125; },
                expectUpdated: (r) => expect(r.amount).toBe(125),
            },
            {
                table: 'payment_schedules',
                label: 'payment schedules',
                create: (r) => { r.loanId = 'loan-1'; r.dueDate = Date.now(); r.scheduledAmount = 100; r.status = 'pending'; },
                update: (r) => { r.status = 'paid'; },
                expectUpdated: (r) => expect(r.status).toBe('paid'),
            },
            {
                table: 'expenses',
                label: 'expenses',
                create: (r) => { r.category = 'Transport'; r.description = 'CRUD Expense'; r.amount = 250; r.expenseDate = Date.now(); },
                update: (r) => { r.amount = 300; },
                expectUpdated: (r) => expect(r.amount).toBe(300),
            },
            {
                table: 'cash_transactions',
                label: 'cash transactions',
                create: (r) => { r.transactionDate = Date.now(); r.particulars = 'Opening cash'; r.type = 'in'; r.amount = 500; },
                update: (r) => { r.remarks = 'verified'; },
                expectUpdated: (r) => expect(r.remarks).toBe('verified'),
            },
            {
                table: 'bank_accounts',
                label: 'bank accounts',
                create: (r) => { r.bankName = 'CRUD Bank'; r.accountName = 'Infinity'; r.accountNumber = '0001'; r.startingBalance = 1000; },
                update: (r) => { r.accountName = 'Infinity Updated'; },
                expectUpdated: (r) => expect(r.accountName).toBe('Infinity Updated'),
            },
            {
                table: 'bank_transactions',
                label: 'bank transactions',
                create: (r) => { r.bankAccountId = 'bank-1'; r.transactionDate = Date.now(); r.type = 'deposit'; r.amount = 100; r.particulars = 'CRUD deposit'; },
                update: (r) => { r.amount = 150; },
                expectUpdated: (r) => expect(r.amount).toBe(150),
            },
            {
                table: 'remittances',
                label: 'remittances',
                create: (r) => { r.collectorId = 'collector-1'; r.amount = 700; r.remittanceDate = Date.now(); r.status = 'pending'; },
                update: (r) => { r.status = 'approved'; },
                expectUpdated: (r) => expect(r.status).toBe('approved'),
            },
            {
                table: 'savings_transactions',
                label: 'savings transactions',
                create: (r) => { r.borrowerId = 'borrower-1'; r.type = 'deposit'; r.amount = 200; r.date = Date.now(); },
                update: (r) => { r.notes = 'passbook verified'; },
                expectUpdated: (r) => expect(r.notes).toBe('passbook verified'),
            },
            {
                table: 'expense_categories',
                label: 'expense categories',
                create: (r) => { r.name = 'CRUD Category'; r.isActive = true; },
                update: (r) => { r.name = 'CRUD Category Updated'; },
                expectUpdated: (r) => expect(r.name).toBe('CRUD Category Updated'),
            },
            {
                table: 'collection_groups',
                label: 'collection groups',
                create: (r) => { r.name = 'CRUD Group'; r.collectorId = 'collector-1'; r.collectionDay = 1; r.isActive = true; },
                update: (r) => { r.collectionDay = 5; },
                expectUpdated: (r) => expect(r.collectionDay).toBe(5),
            },
            {
                table: 'loan_penalties',
                label: 'loan penalties',
                create: (r) => { r.loanId = 'loan-1'; r.amount = 50; r.penaltyDate = Date.now(); r.reason = 'late'; },
                update: (r) => { r.reason = 'waived'; },
                expectUpdated: (r) => expect(r.reason).toBe('waived'),
            },
        ];

        it.each(crudCases)('performs create/read/update/soft-delete/restore for $label', async ({ table, create, update, expectUpdated }) => {
            const recordIds = async (fetch: 'active' | 'deleted') => (
                fetch === 'active'
                    ? await service.fetchActive<any>(table)
                    : await service.fetchDeleted<any>(table)
            ).map((item: any) => item.id);

            const record = await service.create<any>(table, create, 'crud-test');

            expect(await recordIds('active')).toContain(record.id);

            await service.update(record, update, 'crud-test');
            expectUpdated(record);

            await service.softDelete(record, 'crud-test');
            expect(await recordIds('active')).not.toContain(record.id);
            expect(await recordIds('deleted')).toContain(record.id);

            await service.restore(record, 'crud-test');
            expect(await recordIds('active')).toContain(record.id);
        });

        it('creates an entity and logs the action', async () => {
            const borrower = await service.create<Borrower>('borrowers', (r: any) => {
                r.fullName = 'New Borrower';
            }, 'user123');

            expect(borrower.fullName).toBe('New Borrower');
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                entityType: 'borrowers',
                action: 'CREATE',
                performedBy: 'user123'
            }));
        });

        it('updates an entity and logs the action', async () => {
            let borrower: any;
            await database.write(async () => {
                borrower = await database.get('borrowers').create((r: any) => {
                    r.fullName = 'Old Name';
                });
            });

            await service.update(borrower, (r: any) => {
                r.fullName = 'New Name';
            }, 'user123');

            expect(borrower.fullName).toBe('New Name');
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                action: 'UPDATE',
                performedBy: 'user123'
            }));
        });

        it('soft deletes and restores an entity', async () => {
            let borrower: any;
            await database.write(async () => {
                borrower = await database.get('borrowers').create((r: any) => {
                    r.fullName = 'To Delete';
                });
            });

            await service.softDelete(borrower, 'user123');
            expect(borrower.deletedAt).not.toBeNull();
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                action: 'DELETE'
            }));

            await service.restore(borrower, 'user123');
            expect(borrower.deletedAt).toBeNull();
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                action: 'RESTORE'
            }));
        });

        it('permanently deletes an entity and logs the action', async () => {
            let borrower: any;
            await database.write(async () => {
                borrower = await database.get('borrowers').create((r: any) => {
                    r.fullName = 'Permanent Delete';
                });
            });

            const borrowerId = borrower.id;
            await service.delete(borrower, 'user123');
            
            // Verify destruction
            const b = await database.get('borrowers').query().fetch();
            expect(b.find(r => r.id === borrowerId)).toBeUndefined();
            
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                entityType: 'borrowers',
                entityId: borrowerId,
                action: 'DELETE',
                performedBy: 'user123'
            }));
        });
    });

    describe('Cascade Deletes', () => {
        it('cascades delete for a loan', async () => {
            let borrower: any, loan: any;
            await database.write(async () => {
                borrower = await database.get('borrowers').create((r: any) => r.fullName = 'B');
                loan = await database.get('loans').create((r: any) => {
                    r.borrowerId = borrower.id;
                    r.loanNumber = 'L1';
                    r.status = 'active';
                    r.interestType = 'flat';
                    r.frequency = 'daily';
                    r.term = 30;
                    r.termUnit = 'days';
                    r.totalAmount = 1000;
                    r.principalAmount = 900;
                    r.interestRate = 10;
                    r.installmentAmount = 33.33;
                });
                await database.get('payment_schedules').create((r: any) => {
                    r.loanId = loan.id;
                    r.dueDate = Date.now();
                    r.scheduledAmount = 100;
                    r.status = 'pending';
                });
                await database.get('payments').create((r: any) => {
                    r.loanId = loan.id;
                    r.amount = 50;
                    r.paymentDate = Date.now();
                });
                await database.get('loan_penalties').create((r: any) => {
                    r.loanId = loan.id;
                    r.amount = 10;
                    r.penaltyDate = Date.now();
                });
            });

            await service.cascadeDeleteLoan(loan, 'user123');

            expect((loan as any).deletedAt).not.toBeNull();
            
            const schedules = await database.get('payment_schedules').query().fetch();
            expect(schedules.every((s: any) => s.deletedAt != null)).toBe(true);

            expect(ActionLogServiceInstance.logActions).toHaveBeenCalled();
        });

        it('cascades delete for a borrower and its related data', async () => {
           let borrower: any, loan: any;
            await database.write(async () => {
                borrower = await database.get('borrowers').create((r: any) => r.fullName = 'B');
                loan = await database.get('loans').create((r: any) => {
                    r.borrowerId = borrower.id;
                    r.loanNumber = 'L1';
                    r.status = 'paid'; // Not active/defaulted
                    r.interestType = 'flat';
                    r.frequency = 'daily';
                    r.term = 30;
                    r.termUnit = 'days';
                    r.totalAmount = 1000;
                    r.principalAmount = 900;
                    r.interestRate = 10;
                    r.installmentAmount = 33.33;
                });
                await database.get('savings_transactions').create((r: any) => {
                    r.borrowerId = borrower.id;
                    r.type = 'deposit';
                    r.amount = 100;
                    r.date = Date.now();
                });
            });

            await service.cascadeDeleteBorrower(borrower, 'user123');

            expect((borrower as any).deletedAt).not.toBeNull();
            expect((loan as any).deletedAt).not.toBeNull();
            
            const savings = await database.get('savings_transactions').query().fetch();
            expect((savings[0] as any).deletedAt).not.toBeNull();
        });

        it('throws error when deleting borrower with active loans', async () => {
            let borrower: any;
            await database.write(async () => {
                borrower = await database.get('borrowers').create((r: any) => r.fullName = 'B');
                await database.get('loans').create((r: any) => {
                    r.borrowerId = borrower.id;
                    r.loanNumber = 'L1';
                    r.status = 'active';
                    r.interestType = 'flat';
                    r.frequency = 'daily';
                    r.term = 30;
                    r.termUnit = 'days';
                    r.totalAmount = 1000;
                    r.principalAmount = 900;
                    r.interestRate = 10;
                    r.installmentAmount = 33.33;
                });
            });

            await expect(service.cascadeDeleteBorrower(borrower)).rejects.toThrow('Close all loans first');
        });
    });
});
