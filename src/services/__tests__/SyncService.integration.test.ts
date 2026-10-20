import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';
import { mySchema } from '../../database/schema';
import { myMigrations } from '../../database/migrations';
import Expense from '../../database/models/Expense';
import CashTransaction from '../../database/models/CashTransaction';
import { SyncService } from '../SyncService';
import { closeTestDatabase, modelClasses } from '../../__tests__/test-utils';

import { supabase } from '../../database/supabase';

// Mock supabase BEFORE importing things that might use it
const createSupabaseQueryMock = (resolvesTo = { data: [], error: null }) => {
    const chain : any = {
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        is: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        then: (resolve: any) => resolve(resolvesTo)
    };
    chain.is.mockReturnValue(chain);
    chain.not.mockReturnValue(chain);
    return chain;
};

jest.mock('../../database/supabase', () => ({
    supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
        upsert: jest.fn(),
        rpc: jest.fn().mockResolvedValue({ data: new Date().toISOString(), error: null }),
            auth: {
            getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user' } } }, error: null }),
            getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null }),
        }
    }
}));

// Mock EncryptionService to prevent issues with encryption during tests
jest.mock('../EncryptionService', () => ({
    EncryptionService: {
        encrypt: jest.fn(val => val),
        decrypt: jest.fn(val => val),
    }
}));

// Mock the sync store
jest.mock('../../stores/syncStore', () => ({
    useSyncStore: {
        getState: jest.fn().mockReturnValue({
            setSyncProgress: jest.fn(),
            addLog: jest.fn(),
        }),
    }
}));

// Mock react-native-toast-message
jest.mock('react-native-toast-message', () => ({
    show: jest.fn(),
    hide: jest.fn(),
}));

// Hand the database/index getter our in-memory instance so anything that
// reaches for the global singleton lands on the test database.
let mockTestDb: Database;

jest.mock('../../database', () => ({
    get database() {
        return mockTestDb;
    }
}));

const pushChain = (upsertMock: jest.Mock) => ({
    upsert: upsertMock,
    select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
    then: (resolve: any) => resolve({ data: [], error: null })
});

describe('SyncService Integration Test', () => {
    let service: SyncService;

    beforeEach(async () => {
        jest.clearAllMocks();

        // Initialize a fresh In-Memory database for each test
        const adapter = new LokiJSAdapter({
            schema: mySchema,
            migrations: myMigrations,
            useWebWorker: false,
            useIncrementalIndexedDB: false,
            _testLokiAdapter: new Loki.LokiMemoryAdapter(),
            extraLokiOptions: { autosave: false },
        } as any);

        mockTestDb = new Database({
            adapter,
            modelClasses,
        });

        service = new SyncService(mockTestDb, supabase as any);

        // Reset SyncService internal state if needed
        // @ts-ignore
        SyncService.isSyncing = false;
    });

    afterEach(async () => {
        await closeTestDatabase(mockTestDb);
    });

    it('should push a locally created expense to Supabase remote', async () => {
        // 1. Arrange: Setup Supabase mock to succeed on upsert
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue(pushChain(upsertMock));

        // 2. Act: Create the record locally
        let newExpense: any;
        await mockTestDb.write(async () => {
            newExpense = await mockTestDb.get<Expense>('expenses').create((record) => {
                record.category = 'Farm Inputs';
                record.description = 'Test Expense';
                record.amount = 1250;
            });
        });

        // Verify it exists locally
        const localCount = await mockTestDb.get('expenses').query().fetchCount();
        expect(localCount).toBe(1);

        // 3. Sync
        await service.sync();

        // 4. Assert: Verify Supabase was called with the new expense
        expect(supabase.from).toHaveBeenCalledWith('app_expenses');
        expect(upsertMock).toHaveBeenCalled();

        const pushedData = upsertMock.mock.calls[0][0];
        expect(pushedData[0]).toMatchObject({
            id: newExpense.id,
            category: 'Farm Inputs',
            description: 'Test Expense',
            amount: 1250,
        });
    });

    it('should pull a new expense from Supabase remote to local database', async () => {
        // 1. Arrange: Setup Supabase mock to return a "remote" expense
        const remoteExpense = {
            id: 'remote-uuid-1',
            category: 'Harvest Hauling',
            description: 'Remote Expense',
            amount: 800,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
        };

        (supabase.from as jest.Mock).mockImplementation((table) => {
            const hasData = table === 'app_expenses';
            const resolvesTo = { data: hasData ? [remoteExpense] : [], error: null };

            return {
                select: jest.fn().mockReturnValue(createSupabaseQueryMock(resolvesTo)),
                upsert: jest.fn().mockResolvedValue({ error: null }),
                then: (resolve: any) => resolve(resolvesTo)
            };
        });

        // 2. Act: Sync
        await service.sync();

        // 3. Assert: Verify the expense exists in the local database
        const localExpenses = await mockTestDb.get<Expense>('expenses').query().fetch();
        expect(localExpenses.length).toBe(1);
        expect(localExpenses[0].id).toBe('remote-uuid-1');
        expect(localExpenses[0].description).toBe('Remote Expense');
    });

    it('should handle offline updates: modification made offline is pushed during sync', async () => {
        // 1. Create an "already synced" expense locally
        let existingExpense: any;
        await mockTestDb.write(async () => {
            existingExpense = await mockTestDb.get<Expense>('expenses').create((record) => {
                (record as any)._raw.id = 'synced-1';
                record.description = 'Old Name';
                record.amount = 100;
            });
        });

        // 2. Mock Supabase upsert
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue(pushChain(upsertMock));

        // 3. Update the expense locally (simulating offline edit)
        await mockTestDb.write(async () => {
            await existingExpense.update((record: any) => {
                record.description = 'New Name';
            });
        });

        // 4. Sync
        await service.sync();

        // 5. Assert: The update was pushed
        expect(upsertMock).toHaveBeenCalled();
        const pushedData = upsertMock.mock.calls.find(call =>
            call[0][0].id === 'synced-1'
        )[0][0];
        expect(pushedData.description).toBe('New Name');
    });

    it('should successfully sync complex cash transaction data with date fields', async () => {
        // 1. Setup Supabase mock
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockImplementation(() => pushChain(upsertMock));

        // 2. Create a cash transaction locally with the dated + typed fields
        const transactionDate = Date.UTC(2026, 5, 12, 8, 30);
        let testTxn: any;
        await mockTestDb.write(async () => {
            testTxn = await mockTestDb.get<CashTransaction>('cash_transactions').create((record) => {
                record.type = 'in';
                record.particulars = 'Harvest cash sale';
                record.amount = 18500;
                record.transactionDate = transactionDate;
                record.isPettyCash = false;
            });
        });

        // 3. Sync
        await service.sync();

        // 4. Assert
        expect(supabase.from).toHaveBeenCalledWith('app_cash_transactions');
        const pushedTxn = upsertMock.mock.calls.find(call =>
            call[0][0].id === testTxn.id
        )[0][0];

        expect(pushedTxn).toMatchObject({
            type: 'in',
            particulars: 'Harvest cash sale',
            amount: 18500,
            is_petty_cash: false,
        });
        // Dates cross the wire as ISO strings, not epoch numbers.
        expect(typeof pushedTxn.transaction_date).toBe('string');
        expect(new Date(pushedTxn.transaction_date).getTime()).toBe(transactionDate);
    });

    it('should sync soft deletions from local to remote', async () => {
        // 1. Create a record locally
        let recordToDelete: any;
        await mockTestDb.write(async () => {
            recordToDelete = await mockTestDb.get<Expense>('expenses').create((record) => {
                record.description = 'To Be Deleted';
                record.amount = 10;
            });
        });

        // 2. Setup mock for push (first sync to make it "synced")
        (supabase.from as jest.Mock).mockReturnValue(pushChain(jest.fn().mockResolvedValue({ error: null })));
        await service.sync();

        // 3. Delete locally
        await mockTestDb.write(async () => {
            await recordToDelete.markAsDeleted();
        });

        // 4. Reset mock to capture the deletion push
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue(pushChain(upsertMock));

        // 5. Sync
        await service.sync();

        // 6. Assert: Supabase should receive a record with deleted_at
        const deletionCall = upsertMock.mock.calls.find(call =>
            call[0][0].id === recordToDelete.id && call[0][0].deleted_at !== undefined
        );
        expect(deletionCall).toBeDefined();
        expect(deletionCall[0][0].deleted_at).toBeTruthy();
    });

    it('should sync soft deletions from remote to local', async () => {
        // 1. Arrange: Record exists locally
        await mockTestDb.write(async () => {
            await mockTestDb.get<Expense>('expenses').create((record) => {
                (record as any)._raw.id = 'remote-del-1';
                record.description = 'I will be deleted';
                record.amount = 10;
            });
        });

        // 2. Mock Supabase returning a deletion record
        const remoteDeletion = {
            id: 'remote-del-1',
            description: 'I will be deleted',
            deleted_at: new Date().toISOString(),
        };

        (supabase.from as jest.Mock).mockImplementation((table) => {
            const hasData = table === 'app_expenses';
            const activeMock = {
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                range: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                then: (resolve: any) => resolve({ data: [], error: null })
            };
            const deletedMock = {
                gte: jest.fn().mockReturnThis(),
                lte: jest.fn().mockReturnThis(),
                range: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                then: (resolve: any) => resolve({ data: hasData ? [remoteDeletion] : [], error: null })
            };
            return {
                select: jest.fn().mockReturnValue({
                    is: jest.fn().mockReturnValue(activeMock),
                    not: jest.fn().mockReturnValue(deletedMock),
                }),
                upsert: jest.fn().mockResolvedValue({ error: null }),
                then: (resolve: any) => resolve({ data: [], error: null }) // Generic fallback
            };
        });

        // 3. Act: Sync
        await service.sync();

        // 4. Assert: Local record should be gone
        const localExpenses = await mockTestDb.get<Expense>('expenses').query().fetch();
        expect(localExpenses.length).toBe(0);
    });

    it('should handle multi-table sync (Expense and Cash Transaction)', async () => {
        // 1. Arrange: Setup Supabase mock
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue(pushChain(upsertMock));

        // 2. Create an Expense and a Cash Transaction locally
        await mockTestDb.write(async () => {
            await mockTestDb.get<Expense>('expenses').create((record) => {
                record.category = 'Transportation';
                record.amount = 150;
            });
            await mockTestDb.get<CashTransaction>('cash_transactions').create((record) => {
                record.type = 'out';
                record.amount = 500;
                record.particulars = 'Fuel advance';
                record.transactionDate = Date.now();
            });
        });

        // 3. Sync
        await service.sync();

        // 4. Assert: Both tables were pushed
        expect(supabase.from).toHaveBeenCalledWith('app_expenses');
        expect(supabase.from).toHaveBeenCalledWith('app_cash_transactions');
        // Upsert is called once per table with that table's row batch.
        const pushedRows = upsertMock.mock.calls.flatMap(call => call[0] as any[]);
        expect(pushedRows.some(row => row.category === 'Transportation')).toBe(true);
        expect(pushedRows.some(row => row.particulars === 'Fuel advance')).toBe(true);
        expect(upsertMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should be resilient to API failures and continue for other tables', async () => {
        // 1. Arrange: Mock one table failing
        (supabase.from as jest.Mock).mockImplementation((table) => ({
            upsert: table === 'app_expenses'
                ? jest.fn().mockResolvedValue({ error: { message: 'API Crash' } })
                : jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
            then: (resolve: any) => resolve({ data: [], error: null })
        }));

        // 2. Create records in two tables
        await mockTestDb.write(async () => {
            await mockTestDb.get<Expense>('expenses').create((record) => {
                record.category = 'Failing Expense';
                record.amount = 10;
            });
            await mockTestDb.get<CashTransaction>('cash_transactions').create((record) => {
                record.type = 'in';
                record.particulars = 'Resilient Cash In';
                record.amount = 50;
                record.transactionDate = Date.now();
            });
        });

        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        // 3. Sync
        try {
            await service.sync();
        } catch (e) {
            // Expected to throw for integrity
        }

        // 4. Assert: Error was logged via our diagnostic logging
        const errorLogged = consoleErrorSpy.mock.calls.some(call =>
            call.join(' ').includes('Partial Failure: Failed to push app_expenses')
        );
        expect(errorLogged).toBe(true);
        consoleErrorSpy.mockRestore();
    });
});
