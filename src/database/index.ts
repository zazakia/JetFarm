import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import uuid from 'react-native-uuid';
import { mySchema } from './schema';
import { myMigrations } from './migrations';

import Expense from './models/Expense';
import CashTransaction from './models/CashTransaction';
import BankAccount from './models/BankAccount';
import BankTransaction from './models/BankTransaction';
import FinancialSnapshot from './models/FinancialSnapshot';
import UserProfile from './models/UserProfile';
import ExpenseCategory from './models/ExpenseCategory';
import ActionLog from './models/ActionLog';
import AppSetting from './models/AppSetting';
import FeatureFlag from './models/FeatureFlag';
import RolePermission from './models/RolePermission';
import Area from './models/Area';
import ChartOfAccount from './models/ChartOfAccount';
import JournalEntry from './models/JournalEntry';
import JournalEntryLine from './models/JournalEntryLine';
import StatutoryFundAllocation from './models/StatutoryFundAllocation';
import FinancialPeriodSetting from './models/FinancialPeriodSetting';
import BusinessUnit from './models/BusinessUnit';
import Supplier from './models/Supplier';
import AccountsPayableVoucher from './models/AccountsPayableVoucher';
import StockMovement from './models/StockMovement';
import StatutoryRate from './models/StatutoryRate';
import Branch from './models/Branch';
import Warehouse from './models/Warehouse';
import UserBranchRole from './models/UserBranchRole';
import AgriParcel from './models/AgriParcel';
import AgriParcelBlock from './models/AgriParcelBlock';
import AgriBlockAssignment from './models/AgriBlockAssignment';
import AgriBlockProgress from './models/AgriBlockProgress';
import AgriPendingLayoutOperation from './models/AgriPendingLayoutOperation';
import AgriLandOwner from './models/AgriLandOwner';
import AgriInvestor from './models/AgriInvestor';
import AgriCropCycle from './models/AgriCropCycle';
import AgriGrowthCheckin from './models/AgriGrowthCheckin';
import AgriHarvestLog from './models/AgriHarvestLog';
import AgriFarmExpense from './models/AgriFarmExpense';
import AgriFarmWorker from './models/AgriFarmWorker';
import AgriLaborLog from './models/AgriLaborLog';
import AgriWeeklySettlement from './models/AgriWeeklySettlement';
import AgriInvestorLedger from './models/AgriInvestorLedger';

// Configure WatermelonDB to use standard UUID v4 for record IDs.
// This is required for compatibility with Supabase UUID columns.
setGenerator(() => uuid.v4() as string);

const modelClasses = [
    UserProfile,
    Expense,
    CashTransaction,
    BankAccount,
    BankTransaction,
    FinancialSnapshot,
    ExpenseCategory,
    ActionLog,
    AppSetting,
    FeatureFlag,
    RolePermission,
    Area,
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
    StatutoryFundAllocation,
    FinancialPeriodSetting,
    BusinessUnit,
    Supplier,
    AccountsPayableVoucher,
    StockMovement,
    StatutoryRate,
    Branch,
    Warehouse,
    UserBranchRole,
    AgriParcel,
    AgriParcelBlock,
    AgriBlockAssignment,
    AgriBlockProgress,
    AgriPendingLayoutOperation,
    AgriLandOwner,
    AgriInvestor,
    AgriCropCycle,
    AgriGrowthCheckin,
    AgriHarvestLog,
    AgriFarmExpense,
    AgriFarmWorker,
    AgriLaborLog,
    AgriWeeklySettlement,
    AgriInvestorLedger,
];

if (process.env.NODE_ENV !== 'test') {
    console.log('[Database] Starting initialization...');
    console.log('[Database] Schema tables:', Object.keys(mySchema.tables));
    console.log('[Database] Model Classes:', modelClasses.map(c => c.table));
}

let adapter;

try {
    if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
        if (process.env.NODE_ENV !== 'test') console.log('[Database] Detecting Web platform (LokiJS)...');
        let LokiJSAdapter;
        try {
            // Attempt to load LokiJS adapter for web
            const LokiJSModule = require('@nozbe/watermelondb/adapters/lokijs');
            LokiJSAdapter = LokiJSModule.default || LokiJSModule;
        } catch (requireErr) {
            console.error('[Database] Failed to require LokiJSAdapter. Ensure @nozbe/watermelondb is installed correctly.', requireErr);
        }

        if (LokiJSAdapter) {
            const testLokiAdapter =
                process.env.NODE_ENV === 'test'
                    ? new (require('lokijs').LokiMemoryAdapter)()
                    : undefined;
            adapter = new LokiJSAdapter({
                schema: mySchema,
                migrations: myMigrations,
                useWebWorker: false,
                useIncrementalIndexedDB: process.env.NODE_ENV !== 'test',
                _testLokiAdapter: testLokiAdapter,
                extraLokiOptions: process.env.NODE_ENV === 'test' ? { autosave: false } : undefined,
                onQuotaExceeded: (error: Error) => {
                    console.error('[Database] Storage quota exceeded!', error);
                },
                onSetUpError: (error: Error) => {
                    console.error('[Database] LokiJS setup error:', error);
                },
            } as any);
            if (process.env.NODE_ENV !== 'test') console.log('[Database] LokiJSAdapter initialized');
        }
    } else {
        if (process.env.NODE_ENV !== 'test') console.log('[Database] Detecting Native platform (SQLite)...');
        if (!SQLiteAdapter) {
            console.error('[Database] SQLiteAdapter class is missing/undefined!');
        } else {
            adapter = new SQLiteAdapter({
                schema: mySchema,
                migrations: myMigrations,
                // WatermelonDB 0.27's legacy Android JSI package references APIs
                // removed by React Native 0.83. Keep the supported bridge adapter
                // aligned with the Expo config until WatermelonDB is upgraded.
                jsi: false,
                onSetUpError: (error) => {
                    console.error('[Database] WatermelonDB setup error:', error);
                },
            });
            if (process.env.NODE_ENV !== 'test') console.log('[Database] SQLiteAdapter initialized');
        }
    }
} catch (e) {
    console.error('[Database] CRITICAL: Exception during adapter initialization:', e);
}

if (!adapter) {
    console.error('[Database] FATAL: No database adapter was initialized. Using fail-safe mock adapter.');
    // We must provide an adapter to prevent the Database constructor from throwing a fatal error.
    adapter = {
        schema: mySchema,
        migrations: undefined,
        dbName: 'fallback',
        batch: async () => [],
        find: async () => null,
        query: async () => [],
        count: async () => 0,
        create: async () => { throw new Error('Database not initialized') },
        update: async () => { throw new Error('Database not initialized') },
        destroyPermanently: async () => { throw new Error('Database not initialized') },
        unsafeResetDatabase: async () => { throw new Error('Database not initialized') },
        getLocal: async () => null,
        setLocal: async () => {},
        removeLocal: async () => {},
        getDeletedRecords: async () => [],
        destroyDeletedRecords: async () => {},
        // Missing properties that might be accessed by internal WatermelonDB logic
        collections: {},
        schemaVersion: mySchema.version,
        testMode: false,
    } as any;
}

if (process.env.NODE_ENV !== 'test') console.log('[Database] Initializing with models:', modelClasses.map(m => m.table));

export const database = new Database({
    adapter,
    modelClasses,
});

if (Platform.OS === 'web' || process.env.NODE_ENV === 'test') {
    (globalThis as any).__WATERMELON_DB__ = database;
    if (typeof window !== 'undefined') {
        (window as any).__WATERMELON_DB__ = database;
    }
}

if (process.env.NODE_ENV !== 'test') console.log('[Database] Database instance created successfully');

