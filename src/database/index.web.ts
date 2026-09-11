import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
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

// Configure WatermelonDB to use standard UUID v4 for record IDs.
// This is required for compatibility with Supabase UUID columns.
setGenerator(() => uuid.v4() as string);

const adapter = new LokiJSAdapter({
    dbName: `poscursor-v${mySchema.version}`,
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
    ],
});
