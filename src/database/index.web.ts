import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
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

// Persistent storage identity, not a schema version. Keep v48 offline history in place;
// schema upgrades still run through mySchema and myMigrations on this same database.
export const WEB_DATABASE_NAME = 'poscursor-v48';

const adapter = new LokiJSAdapter({
    dbName: WEB_DATABASE_NAME,
    schema: mySchema,
    migrations: myMigrations,
    useWebWorker: false,
    useIncrementalIndexedDB: process.env.NODE_ENV !== 'test',
    _testLokiAdapter:
        process.env.NODE_ENV === 'test'
            ? new (require('lokijs').LokiMemoryAdapter)()
            : undefined,
    extraLokiOptions: process.env.NODE_ENV === 'test' ? { autosave: false } : undefined,
    onQuotaExceededError: (error: any) => {
        console.error("Quota exceeded:", error);
    },
    onSetUpError: (error: Error) => {
        console.error('[Database] Failed to initialize local web database:', error);
    },
    extraIncrementalIDBOptions: {
        onversionchange: () => {
            console.warn('[Database] Local web database changed in another tab. Reloading this tab.');
            if (typeof window !== 'undefined') {
                window.location.reload();
            }
        },
        onDidOverwrite: () => {
            console.warn('[Database] Local web database was refreshed by another tab.');
        },
    },
} as any);

export const database = new Database({
    adapter,
    modelClasses: [
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
    ],
});

if (typeof window !== 'undefined') {
    (window as any).__WATERMELON_DB__ = database;
}

