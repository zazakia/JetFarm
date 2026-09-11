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
import { SyncService } from '../SyncService';
import { supabase } from '../../database/supabase';
import { closeTestDatabase } from '../../__tests__/test-utils';

// Define the mock at the top level
const mockOverrides = new Map();

jest.mock('../../database/supabase', () => {
    // Define helper INSIDE the factory to avoid hoisting issues
    const createMockChain = (data = [], error = null) => {
        return {
            select: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: (data || [])[0] || null, error }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
            insert: jest.fn().mockResolvedValue({ error: null }),
            delete: jest.fn().mockReturnThis(),
            then(resolve) {
                return Promise.resolve({ data, error }).then(resolve);
            }
        };
    };

    return {
        supabase: {
            from: jest.fn((t) => {
                if (mockOverrides.has(t)) return mockOverrides.get(t)();
                return createMockChain([]);
            }),
            rpc: jest.fn().mockResolvedValue({ data: new Date().toISOString(), error: null }),
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
                getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: 'u1' } } }, error: null }),
            }
        }
    };
});

describe('Integration', () => {
    let db: any;
    let service: SyncService;
    
    // Define a helper to recreate the chain for specific tables
    const createLocalMockChain = (data = [], error = null) => {
        return {
            select: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            lte: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            range: jest.fn().mockReturnThis(),
            in: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: (data || [])[0] || null, error }),
            upsert: jest.fn().mockResolvedValue({ error: null }),
            insert: jest.fn().mockResolvedValue({ error: null }),
            delete: jest.fn().mockReturnThis(),
            then(resolve) {
                return Promise.resolve({ data, error }).then(resolve);
            }
        };
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        mockOverrides.clear();
        db = new Database({
            adapter: new LokiJSAdapter({
                schema: mySchema,
                migrations: myMigrations,
                useWebWorker: false,
                useIncrementalIndexedDB: false,
                _testLokiAdapter: new Loki.LokiMemoryAdapter(),
                extraLokiOptions: { autosave: false },
            } as any),
            modelClasses: [
                Borrower, Loan, Payment, PaymentSchedule, Expense,
                CashTransaction, BankAccount, BankTransaction,
                CollectionLog, FinancialSnapshot, UserProfile, Remittance,
                SavingsTransaction, ExpenseCategory, Collector,
                LoanPenalty, CollectionGroup
            ],
        });
        service = new SyncService(db, supabase as any);
    });

    afterEach(async () => {
        await closeTestDatabase(db);
    });

    it('should pull a remittance from Supabase and update local status', async () => {
        const remoteRemit = {
            id: 'remit-1',
            collector_id: 'coll-1',
            amount: 500,
            status: 'approved',
            approved_by: '00000000-0000-0000-0000-000000000001',
            updated_at: new Date().toISOString()
        };

        mockOverrides.set('app_remittances', () => {
            const c = createLocalMockChain([remoteRemit]);
            c.not.mockImplementation(() => createLocalMockChain([]));
            return c;
        });

        await service.sync(true);

        const allRemits = await db.get('remittances').query().fetch();
        console.log(`[Integration Debug] Local remittances count: ${allRemits.length}`);
        if (allRemits.length > 0) {
            console.log(`[Integration Debug] First record ID: ${allRemits[0].id}`);
        }

        const local = await db.get('remittances').find('remit-1');
        expect(local.status).toBe('approved');
        expect(local.approvedBy).toBe('00000000-0000-0000-0000-000000000001');
    });

    it('should push a new remittance to Supabase', async () => {
        let pushedData: any = null;
        mockOverrides.set('app_remittances', () => {
            const chain = createLocalMockChain([]);
            chain.upsert.mockImplementation((data: any) => {
                pushedData = data;
                return Promise.resolve({ error: null });
            });
            return chain;
        });

        await db.write(async () => {
            await db.get('remittances').create(r => {
                (r as any)._raw.id = 'local-1';
                r.amount = 1000;
                r.status = 'pending';
            });
        });

        await service.sync(true);

        expect(pushedData).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'local-1', amount: 1000 })
        ]));
    });
});
