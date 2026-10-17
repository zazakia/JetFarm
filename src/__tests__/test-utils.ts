import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import Loki from 'lokijs';
import { mySchema } from '../database/schema';
import UserProfile from '../database/models/UserProfile';
import Collector from '../database/models/Collector';
import Borrower from '../database/models/Borrower';
import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import PaymentSchedule from '../database/models/PaymentSchedule';
import Expense from '../database/models/Expense';
import CashTransaction from '../database/models/CashTransaction';
import BankAccount from '../database/models/BankAccount';
import BankTransaction from '../database/models/BankTransaction';
import CollectionLog from '../database/models/CollectionLog';
import FinancialSnapshot from '../database/models/FinancialSnapshot';
import Remittance from '../database/models/Remittance';
import SavingsTransaction from '../database/models/SavingsTransaction';
import ExpenseCategory from '../database/models/ExpenseCategory';
import LoanPenalty from '../database/models/LoanPenalty';
import CollectionGroup from '../database/models/CollectionGroup';
import ActionLog from '../database/models/ActionLog';
import FileCase from '../database/models/FileCase';
import AppSetting from '../database/models/AppSetting';
import LoanProduct from '../database/models/LoanProduct';
import FeatureFlag from '../database/models/FeatureFlag';
import RolePermission from '../database/models/RolePermission';
import LoanApplication from '../database/models/LoanApplication';
import Guarantor from '../database/models/Guarantor';
import Area from '../database/models/Area';
import Employee from '../database/models/Employee';
import Payroll from '../database/models/Payroll';
import ChartOfAccount from '../database/models/ChartOfAccount';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import StatutoryFundAllocation from '../database/models/StatutoryFundAllocation';
import FinancialPeriodSetting from '../database/models/FinancialPeriodSetting';
import ShareCapitalTransaction from '../database/models/ShareCapitalTransaction';
import BusinessUnit from '../database/models/BusinessUnit';
import ModuleTransaction from '../database/models/ModuleTransaction';
import WsCustomer from '../database/models/WsCustomer';
import WsDelivery from '../database/models/WsDelivery';
import WsContainer from '../database/models/WsContainer';
import WsPayment from '../database/models/WsPayment';
import WsExpense from '../database/models/WsExpense';
import MarketplaceStore from '../database/models/MarketplaceStore';
import MarketplaceCategory from '../database/models/MarketplaceCategory';
import MarketplaceProduct from '../database/models/MarketplaceProduct';
import MarketplaceOrder from '../database/models/MarketplaceOrder';
import MarketplaceSubOrder from '../database/models/MarketplaceSubOrder';
import MarketplaceOrderItem from '../database/models/MarketplaceOrderItem';
import MarketplacePayout from '../database/models/MarketplacePayout';
import MarketplaceReview from '../database/models/MarketplaceReview';
import MarketplacePromotion from '../database/models/MarketplacePromotion';
import MarketplaceDispute from '../database/models/MarketplaceDispute';
import Supplier from '../database/models/Supplier';
import AccountsPayableVoucher from '../database/models/AccountsPayableVoucher';
import StockMovement from '../database/models/StockMovement';
import CommissaryDispatch from '../database/models/CommissaryDispatch';
import WasteLog from '../database/models/WasteLog';
import RoyaltyCalculation from '../database/models/RoyaltyCalculation';
import PayrollRun from '../database/models/PayrollRun';
import PayrollLine from '../database/models/PayrollLine';
import StatutoryRate from '../database/models/StatutoryRate';
import Branch from '../database/models/Branch';
import Warehouse from '../database/models/Warehouse';
import UserBranchRole from '../database/models/UserBranchRole';
import SalesReturn from '../database/models/SalesReturn';
import SalesReturnLine from '../database/models/SalesReturnLine';
import PosSession from '../database/models/PosSession';
import FranchiseContract from '../database/models/FranchiseContract';
import StoreAudit from '../database/models/StoreAudit';
import DeviceRegistry from '../database/models/DeviceRegistry';
import EmployeeLeave from '../database/models/EmployeeLeave';
import FranchiseRoyaltyLedger from '../database/models/FranchiseRoyaltyLedger';
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
import MeetingAttendance from '../database/models/MeetingAttendance';

export const modelClasses = [
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
    ChartOfAccount,
    JournalEntry,
    JournalEntryLine,
    StatutoryFundAllocation,
    FinancialPeriodSetting,
    ShareCapitalTransaction,
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
    PayrollRun,
    PayrollLine,
    StatutoryRate,
    Branch,
    Warehouse,
    UserBranchRole,
    SalesReturn,
    SalesReturnLine,
    PosSession,
    FranchiseContract,
    StoreAudit,
    DeviceRegistry,
    EmployeeLeave,
    FranchiseRoyaltyLedger,
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
    MeetingAttendance,
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

export async function createTestData(database: Database, options: {
    collectorName?: string,
    borrowerName?: string,
    loanAmount?: number,
    status?: string,
    frequency?: string
} = {}) {
    return await database.write(async () => {
        const collector = await database.get<Collector>('collectors').create((c) => {
            c.fullName = options.collectorName || 'Test Collector';
            c.isActive = true;
        });

        const borrower = await database.get<Borrower>('borrowers').create((b) => {
            b.fullName = options.borrowerName || 'Test Borrower';
            b.collectorId = collector.id;
        });

        const loan = await database.get<Loan>('loans').create((l) => {
            l.borrowerId = borrower.id;
            l.principalAmount = options.loanAmount || 1000;
            l.interestAmount = (options.loanAmount || 1000) * 0.2;
            l.totalAmount = l.principalAmount + l.interestAmount;
            l.status = options.status || 'active';
            l.frequency = options.frequency || 'daily';
            l.installmentAmount = l.totalAmount / 30;
        });

        return { collector, borrower, loan };
    });
}
