import { Platform } from 'react-native';
import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { setGenerator } from '@nozbe/watermelondb/utils/common/randomId';
import uuid from 'react-native-uuid';
import { mySchema } from './schema';
import { myMigrations } from './migrations';

import Borrower from './models/Borrower';
import Loan from './models/Loan';
import Payment from './models/Payment';
import PaymentSchedule from './models/PaymentSchedule';
import Expense from './models/Expense';
import CashTransaction from './models/CashTransaction';
import BankAccount from './models/BankAccount';
import BankTransaction from './models/BankTransaction';
import CollectionLog from './models/CollectionLog';
import FinancialSnapshot from './models/FinancialSnapshot';
import UserProfile from './models/UserProfile';
import Remittance from './models/Remittance';
import SavingsTransaction from './models/SavingsTransaction';
import ExpenseCategory from './models/ExpenseCategory';
import Collector from './models/Collector';
import LoanPenalty from './models/LoanPenalty';
import CollectionGroup from './models/CollectionGroup';
import ActionLog from './models/ActionLog';
import FileCase from './models/FileCase';
import AppSetting from './models/AppSetting';
import LoanProduct from './models/LoanProduct';
import FeatureFlag from './models/FeatureFlag';
import RolePermission from './models/RolePermission';
import LoanApplication from './models/LoanApplication';
import Guarantor from './models/Guarantor';
import Area from './models/Area';
import Employee from './models/Employee';
import Payroll from './models/Payroll';
import Dependent from './models/Dependent';
import Child from './models/Child';
import ShareCapitalTransaction from './models/ShareCapitalTransaction';
import Committee from './models/Committee';
import CommitteeMember from './models/CommitteeMember';
import BoardResolution from './models/BoardResolution';
import MeetingAttendance from './models/MeetingAttendance';
import ChartOfAccount from './models/ChartOfAccount';
import JournalEntry from './models/JournalEntry';
import JournalEntryLine from './models/JournalEntryLine';
import StatutoryFundAllocation from './models/StatutoryFundAllocation';
import FinancialPeriodSetting from './models/FinancialPeriodSetting';
import BusinessUnit from './models/BusinessUnit';
import ModuleTransaction from './models/ModuleTransaction';
import WsCustomer from './models/WsCustomer';
import WsDelivery from './models/WsDelivery';
import WsContainer from './models/WsContainer';
import WsPayment from './models/WsPayment';
import WsExpense from './models/WsExpense';
import MarketplaceStore from './models/MarketplaceStore';
import MarketplaceCategory from './models/MarketplaceCategory';
import MarketplaceProduct from './models/MarketplaceProduct';
import MarketplaceOrder from './models/MarketplaceOrder';
import MarketplaceSubOrder from './models/MarketplaceSubOrder';
import MarketplaceOrderItem from './models/MarketplaceOrderItem';
import MarketplacePayout from './models/MarketplacePayout';
import MarketplaceReview from './models/MarketplaceReview';
import MarketplacePromotion from './models/MarketplacePromotion';
import MarketplaceDispute from './models/MarketplaceDispute';
import Supplier from './models/Supplier';
import AccountsPayableVoucher from './models/AccountsPayableVoucher';
import StockMovement from './models/StockMovement';
import CommissaryDispatch from './models/CommissaryDispatch';
import WasteLog from './models/WasteLog';
import RoyaltyCalculation from './models/RoyaltyCalculation';
import FranchiseContract from './models/FranchiseContract';
import StoreAudit from './models/StoreAudit';
import DeviceRegistry from './models/DeviceRegistry';
import EmployeeLeave from './models/EmployeeLeave';
import FranchiseRoyaltyLedger from './models/FranchiseRoyaltyLedger';
import PayrollRun from './models/PayrollRun';
import PayrollLine from './models/PayrollLine';
import StatutoryRate from './models/StatutoryRate';
import Branch from './models/Branch';
import Warehouse from './models/Warehouse';
import UserBranchRole from './models/UserBranchRole';
import SalesReturn from './models/SalesReturn';
import SalesReturnLine from './models/SalesReturnLine';
import PosSession from './models/PosSession';

// Configure WatermelonDB to use standard UUID v4 for record IDs.
// This is required for compatibility with Supabase UUID columns.
setGenerator(() => uuid.v4() as string);

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
    FileCase,
    AppSetting,
    LoanProduct,
    FeatureFlag,
    RolePermission,
    LoanApplication,
    Guarantor,
    Area,
    Employee,
    Payroll,
    Dependent,
    Child,
    ShareCapitalTransaction,
    Committee,
    CommitteeMember,
    BoardResolution,
    MeetingAttendance,
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
    StatutoryFundAllocation,
    FinancialPeriodSetting,
    BusinessUnit,
    ModuleTransaction,
    WsCustomer,
    WsDelivery,
    WsContainer,
    WsPayment,
    WsExpense,
    MarketplaceStore,
    MarketplaceCategory,
    MarketplaceProduct,
    MarketplaceOrder,
    MarketplaceSubOrder,
    MarketplaceOrderItem,
    MarketplacePayout,
    MarketplaceReview,
    MarketplacePromotion,
    MarketplaceDispute,
    Supplier,
    AccountsPayableVoucher,
    StockMovement,
    CommissaryDispatch,
    WasteLog,
    RoyaltyCalculation,
    FranchiseContract,
    StoreAudit,
    DeviceRegistry,
    EmployeeLeave,
    FranchiseRoyaltyLedger,
    PayrollRun,
    PayrollLine,
    StatutoryRate,
    Branch,
    Warehouse,
    UserBranchRole,
    SalesReturn,
    SalesReturnLine,
    PosSession,
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
                onQuotaExceeded: (error) => {
                    console.error('[Database] Storage quota exceeded!', error);
                },
                onSetUpError: (error) => {
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

