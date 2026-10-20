import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';
import { mySchema } from '../database/schema';
import UserProfile from '../database/models/UserProfile';
import Expense from '../database/models/Expense';
import CashTransaction from '../database/models/CashTransaction';
import BankAccount from '../database/models/BankAccount';
import BankTransaction from '../database/models/BankTransaction';
import FinancialSnapshot from '../database/models/FinancialSnapshot';
import ExpenseCategory from '../database/models/ExpenseCategory';
import ActionLog from '../database/models/ActionLog';
import AppSetting from '../database/models/AppSetting';
import FeatureFlag from '../database/models/FeatureFlag';
import RolePermission from '../database/models/RolePermission';
import Area from '../database/models/Area';
import ChartOfAccount from '../database/models/ChartOfAccount';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import StatutoryFundAllocation from '../database/models/StatutoryFundAllocation';
import FinancialPeriodSetting from '../database/models/FinancialPeriodSetting';
import BusinessUnit from '../database/models/BusinessUnit';
import Supplier from '../database/models/Supplier';
import AccountsPayableVoucher from '../database/models/AccountsPayableVoucher';
import StockMovement from '../database/models/StockMovement';
import StatutoryRate from '../database/models/StatutoryRate';
import Branch from '../database/models/Branch';
import Warehouse from '../database/models/Warehouse';
import UserBranchRole from '../database/models/UserBranchRole';
import AgriParcel from '../database/models/AgriParcel';
import AgriParcelBlock from '../database/models/AgriParcelBlock';
import AgriBlockAssignment from '../database/models/AgriBlockAssignment';
import AgriBlockProgress from '../database/models/AgriBlockProgress';
import AgriPendingLayoutOperation from '../database/models/AgriPendingLayoutOperation';
import AgriLandOwner from '../database/models/AgriLandOwner';
import AgriInvestor from '../database/models/AgriInvestor';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriGrowthCheckin from '../database/models/AgriGrowthCheckin';
import AgriHarvestLog from '../database/models/AgriHarvestLog';
import AgriFarmExpense from '../database/models/AgriFarmExpense';
import AgriFarmWorker from '../database/models/AgriFarmWorker';
import AgriLaborLog from '../database/models/AgriLaborLog';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import AgriInvestorLedger from '../database/models/AgriInvestorLedger';

export const modelClasses = [
    Branch,
    Warehouse,
    UserBranchRole,
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

export function createTestLokiAdapter(schema = mySchema) {
    return new LokiJSAdapter({
        dbName: 'test_db_' + Math.random().toString(36).substring(7),
        schema,
        useWebWorker: false,
        useIncrementalIndexedDB: false,
        _testLokiAdapter: new Loki.LokiMemoryAdapter(),
        extraLokiOptions: {
            autosave: false,
        },
    } as any);
}

export function createTestDatabase() {
    return new Database({
        adapter: createTestLokiAdapter(),
        modelClasses,
    });
}

export async function closeTestDatabase(database?: Database | null) {
    if (!database) {
        return;
    }

    try {
        await database.write(async () => {
            await database.unsafeResetDatabase();
        });
    } catch {
        // Best-effort cleanup for test teardown only.
    }

    const loki = (database.adapter as any)?._driver?.loki;
    if (loki?.close) {
        await new Promise<void>((resolve) => {
            try {
                if (loki.close.length > 0) {
                    loki.close(() => resolve());
                } else {
                    loki.close();
                    resolve();
                }
            } catch {
                resolve();
            }
        });
    }
}
