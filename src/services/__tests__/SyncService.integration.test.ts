import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';
import { mySchema } from '../../database/schema';
import { myMigrations } from '../../database/migrations';
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
import { SyncService } from '../SyncService';
import { closeTestDatabase } from '../../__tests__/test-utils';

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

// Mock the database/index file to return our test database instance
const modelClasses = [
    UserProfile,
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
    Collector,
    LoanPenalty,
    CollectionGroup,
    ActionLog
];

let mockTestDb: Database;

jest.mock('../../database', () => ({
    get database() {
        return mockTestDb;
    }
}));

describe('SyncService Integration Test', () => {
    let mockTestDb: Database;
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

    it('should push a locally created borrower to Supabase remote', async () => {
        // 1. Arrange: Setup Supabase mock to succeed on upsert
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue({
            upsert: upsertMock,
            select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
            then: (resolve: any) => resolve({ data: [], error: null })
        });

        // 2. Act: Create a record locally
        let newBorrower: any;
        await mockTestDb.write(async () => {
            newBorrower = await mockTestDb.get<Borrower>('borrowers').create((record) => {
                record.fullName = 'Test Borrower';
                record.address = '123 Test St';
            });
        });

        // Verify it exists locally
        const localCount = await mockTestDb.get('borrowers').query().fetchCount();
        expect(localCount).toBe(1);

        // 3. Sync
        await service.sync();

        // 4. Assert: Verify Supabase was called with the new borrower
        expect(supabase.from).toHaveBeenCalledWith('app_borrowers');
        expect(upsertMock).toHaveBeenCalled();

        const pushedData = upsertMock.mock.calls[0][0];
        expect(pushedData[0]).toMatchObject({
            id: newBorrower.id,
            full_name: 'Test Borrower',
            address: '123 Test St',
        });
    });

    it('should pull a new borrower from Supabase remote to local database', async () => {
        // 1. Arrange: Setup Supabase mock to return a "remote" borrower
        const remoteBorrower = {
            id: 'remote-uuid-1',
            full_name: 'Remote Borrower',
            address: '456 Remote Rd',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            deleted_at: null,
        };

        (supabase.from as jest.Mock).mockImplementation((table) => {
            const hasData = table === 'app_borrowers';
            const resolvesTo = { data: hasData ? [remoteBorrower] : [], error: null };

            return {
                select: jest.fn().mockReturnValue(createSupabaseQueryMock(resolvesTo)),
                upsert: jest.fn().mockResolvedValue({ error: null }),
                then: (resolve: any) => resolve(resolvesTo)
            };
        });

        // 2. Act: Sync
        await service.sync();

        // 3. Assert: Verify the borrower exists in the local database
        const localBorrowers = await mockTestDb.get<Borrower>('borrowers').query().fetch();
        expect(localBorrowers.length).toBe(1);
        expect(localBorrowers[0].id).toBe('remote-uuid-1');
        expect(localBorrowers[0].fullName).toBe('Remote Borrower');
    });

    it('should handle offline updates: modification made offline is pushed during sync', async () => {
        // 1. Create an "already synced" borrower locally
        let existingBorrower: any;
        await mockTestDb.write(async () => {
            existingBorrower = await mockTestDb.get<Borrower>('borrowers').create((record) => {
                record._raw.id = 'synced-1';
                record.fullName = 'Old Name';
            });
        });

        // 2. Mock Supabase upsert
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue({
            upsert: upsertMock,
            select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
            then: (resolve: any) => resolve({ data: [], error: null })
        });

        // 3. Update the borrower locally (simulating offline edit)
        await mockTestDb.write(async () => {
            await existingBorrower.update((record: any) => {
                record.fullName = 'New Name';
            });
        });

        // 4. Sync
        await service.sync();

        // 5. Assert: The update was pushed
        expect(upsertMock).toHaveBeenCalled();
        const pushedData = upsertMock.mock.calls.find(call =>
            call[0][0].id === 'synced-1'
        )[0][0];
        expect(pushedData.full_name).toBe('New Name');
    });

    it('should successfully sync complex Loan data with new schema fields', async () => {
        // 1. Setup Supabase mock
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockImplementation((table) => ({
            upsert: upsertMock,
            select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
            then: (resolve: any) => resolve({ data: [], error: null })
        }));

        // 2. Create a Loan locally with the new fields
        let testLoan: any;
        await mockTestDb.write(async () => {
            testLoan = await mockTestDb.get<Loan>('loans').create((record) => {
                record.loanNumber = 'LN-123';
                record.principalAmount = 10000;
                record.interestRate = 5;
                record.term = 12;
                record.termUnit = 'months';
                record.status = 'active';
                record.depositAmount = 500;
                record.insuranceAmount = 200;
            });
        });

        // 3. Sync
        await service.sync();

        // 4. Assert
        expect(supabase.from).toHaveBeenCalledWith('app_loans');
        const pushedLoan = upsertMock.mock.calls.find(call =>
            call[0][0].id === testLoan.id
        )[0][0];

        expect(pushedLoan).toMatchObject({
            loan_number: 'LN-123',
            principal_amount: 10000,
            term: 12,
            term_unit: 'months',
            deposit_amount: 500,
            insurance_amount: 200,
            status: 'active'
        });
    });

    it('should sync soft deletions from local to remote', async () => {
        // 1. Create a record locally
        let recordToDelete: any;
        await mockTestDb.write(async () => {
            recordToDelete = await mockTestDb.get<Borrower>('borrowers').create((record) => {
                record.fullName = 'To Be Deleted';
            });
        });

        // 2. Setup mock for push (first sync to make it "synced")
        (supabase.from as jest.Mock).mockReturnValue({
            upsert: jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
            then: (resolve: any) => resolve({ data: [], error: null })
        });
        await service.sync();

        // 3. Delete locally
        await mockTestDb.write(async () => {
            await recordToDelete.markAsDeleted();
        });

        // 4. Reset mock to capture the deletion push
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue({
            upsert: upsertMock,
            select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
            then: (resolve: any) => resolve({ data: [], error: null })
        });

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
            await mockTestDb.get<Borrower>('borrowers').create((record) => {
                record._raw.id = 'remote-del-1';
                record.fullName = 'I will be deleted';
            });
        });

        // 2. Mock Supabase returning a deletion record
        const remoteDeletion = {
            id: 'remote-del-1',
            full_name: 'I will be deleted',
            deleted_at: new Date().toISOString(),
        };

        (supabase.from as jest.Mock).mockImplementation((table) => {
            const hasData = table === 'app_borrowers';
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
        const localBorrowed = await mockTestDb.get<Borrower>('borrowers').query().fetch();
        expect(localBorrowed.length).toBe(0);
    });

    it('should handle multi-table sync (Expense and Payment)', async () => {
        // 1. Arrange: Setup Supabase mock
        const upsertMock = jest.fn().mockResolvedValue({ error: null });
        (supabase.from as jest.Mock).mockReturnValue({
            upsert: upsertMock,
            select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
            then: (resolve: any) => resolve({ data: [], error: null })
        });

        // 2. Create an Expense and a Payment locally
        await mockTestDb.write(async () => {
            await mockTestDb.get<Expense>('expenses').create((record) => {
                record.category = 'Transportation';
                record.amount = 150;
            });
            await mockTestDb.get<Payment>('payments').create((record) => {
                record.amount = 500;
                record.paymentDate = Date.now();
            });
        });

        // 3. Sync
        await service.sync();

        // 4. Assert: Both tables were pushed
        expect(supabase.from).toHaveBeenCalledWith('app_expenses');
        expect(supabase.from).toHaveBeenCalledWith('app_payments');
        expect(upsertMock).toHaveBeenCalledTimes(2); // One for each table
    });

    it('should be resilient to API failures and continue for other tables', async () => {
        // 1. Arrange: Mock one table failing
        (supabase.from as jest.Mock).mockImplementation((table) => ({
            upsert: table === 'app_borrowers'
                ? jest.fn().mockResolvedValue({ error: { message: 'API Crash' } })
                : jest.fn().mockResolvedValue({ error: null }),
            select: jest.fn().mockReturnValue(createSupabaseQueryMock()),
            then: (resolve: any) => resolve({ data: [], error: null })
        }));

        // 2. Create records in two tables
        await mockTestDb.write(async () => {
            await mockTestDb.get<Borrower>('borrowers').create((record) => {
                record.fullName = 'Failing Borrower';
            });
            await mockTestDb.get<Expense>('expenses').create((record) => {
                record.category = 'Resilient Expense';
                record.amount = 10;
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
            call.join(' ').includes('Partial Failure: Failed to push app_borrowers')
        );
        expect(errorLogged).toBe(true);
        consoleErrorSpy.mockRestore();
    });
});
