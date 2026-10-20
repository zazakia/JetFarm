import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';
import { mySchema } from '../../database/schema';
import Expense from '../../database/models/Expense';
import ActionLogServiceInstance from '../ActionLogService';
import { BaseModelServiceClass } from '../BaseModelService';

import { closeTestDatabase, modelClasses } from '../../__tests__/test-utils';

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
                await database.get('expenses').create((r: any) => {
                    r.description = 'Active';
                    r.amount = 10;
                    r.deletedAt = null;
                });
                await database.get('expenses').create((r: any) => {
                    r.description = 'Deleted';
                    r.amount = 20;
                    r.deletedAt = Date.now();
                });
            });

            const active = await service.fetchActive<Expense>('expenses');
            expect(active.length).toBe(1);
            expect((active[0] as any).description).toBe('Active');

            const deleted = await service.fetchDeleted<Expense>('expenses');
            expect(deleted.length).toBe(1);
            expect((deleted[0] as any).description).toBe('Deleted');
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
                table: 'expense_categories',
                label: 'expense categories',
                create: (r) => { r.name = 'CRUD Category'; r.isActive = true; },
                update: (r) => { r.name = 'CRUD Category Updated'; },
                expectUpdated: (r) => expect(r.name).toBe('CRUD Category Updated'),
            },
            {
                table: 'suppliers',
                label: 'suppliers',
                create: (r) => { r.name = 'CRUD Supplier'; r.phone = '09170000000'; r.isActive = true; },
                update: (r) => { r.phone = '09171111111'; },
                expectUpdated: (r) => expect(r.phone).toBe('09171111111'),
            },
            {
                table: 'agri_parcels',
                label: 'agri parcels',
                create: (r) => {
                    r.name = 'CRUD Parcel';
                    r.code = 'P-1';
                    r.landOwnerId = 'owner-1';
                    r.areaHectares = 2.5;
                    r.status = 'available';
                },
                update: (r) => { r.status = 'planted'; },
                expectUpdated: (r) => expect(r.status).toBe('planted'),
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
            const expense = await service.create<Expense>('expenses', (r: any) => {
                r.description = 'New Expense';
                r.amount = 100;
            }, 'user123');

            expect(expense.description).toBe('New Expense');
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                entityType: 'expenses',
                action: 'CREATE',
                performedBy: 'user123'
            }));
        });

        it('updates an entity and logs the action', async () => {
            let expense: any;
            await database.write(async () => {
                expense = await database.get('expenses').create((r: any) => {
                    r.description = 'Old Name';
                    r.amount = 100;
                });
            });

            await service.update(expense, (r: any) => {
                r.description = 'New Name';
            }, 'user123');

            expect(expense.description).toBe('New Name');
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                action: 'UPDATE',
                performedBy: 'user123'
            }));
        });

        it('soft deletes and restores an entity', async () => {
            let expense: any;
            await database.write(async () => {
                expense = await database.get('expenses').create((r: any) => {
                    r.description = 'To Delete';
                    r.amount = 100;
                });
            });

            await service.softDelete(expense, 'user123');
            expect(expense.deletedAt).not.toBeNull();
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                action: 'DELETE'
            }));

            await service.restore(expense, 'user123');
            expect(expense.deletedAt).toBeNull();
            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                action: 'RESTORE'
            }));
        });

        it('permanently deletes an entity and logs the action', async () => {
            let expense: any;
            await database.write(async () => {
                expense = await database.get('expenses').create((r: any) => {
                    r.description = 'Permanent Delete';
                    r.amount = 100;
                });
            });

            const expenseId = expense.id;
            await service.delete(expense, 'user123');

            // Verify destruction
            const rows = await database.get('expenses').query().fetch();
            expect(rows.find(r => r.id === expenseId)).toBeUndefined();

            expect(ActionLogServiceInstance.logAction).toHaveBeenCalledWith(expect.objectContaining({
                entityType: 'expenses',
                entityId: expenseId,
                action: 'DELETE',
                performedBy: 'user123'
            }));
        });
    });

    // The former "Cascade Deletes" suite drove cascadeDeleteLoan and
    // cascadeDeleteBorrower across payment schedules, penalties and savings.
    // Both methods and every table they touched are retired on this branch, so
    // the generic create / update / soft-delete / restore / hard-delete
    // contract above is the entire remaining surface.
});
