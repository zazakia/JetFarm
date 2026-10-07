import { Database, Q } from '@nozbe/watermelondb';
import uuid from 'react-native-uuid';
import { database as globalDatabase } from '../database';
import Borrower from '../database/models/Borrower';
import Collector from '../database/models/Collector';
import Expense from '../database/models/Expense';
import FileCase from '../database/models/FileCase';
import Loan from '../database/models/Loan';
import Payment from '../database/models/Payment';
import PaymentSchedule from '../database/models/PaymentSchedule';
import Area from '../database/models/Area';
import AgriParcel from '../database/models/AgriParcel';
import AgriCropCycle from '../database/models/AgriCropCycle';
import AgriFarmWorker from '../database/models/AgriFarmWorker';
import AgriFarmExpense from '../database/models/AgriFarmExpense';
import AgriLaborLog from '../database/models/AgriLaborLog';
import AgriHarvestLog from '../database/models/AgriHarvestLog';
import Branch from '../database/models/Branch';
import Warehouse from '../database/models/Warehouse';
import MarketplaceStore from '../database/models/MarketplaceStore';
import MarketplaceCategory from '../database/models/MarketplaceCategory';
import MarketplaceProduct from '../database/models/MarketplaceProduct';
import StockMovement from '../database/models/StockMovement';
import MarketplaceOrder from '../database/models/MarketplaceOrder';
import MarketplaceSubOrder from '../database/models/MarketplaceSubOrder';
import MarketplaceOrderItem from '../database/models/MarketplaceOrderItem';
import SalesReturn from '../database/models/SalesReturn';
import SalesReturnLine from '../database/models/SalesReturnLine';
import WsCustomer from '../database/models/WsCustomer';
import WsContainer from '../database/models/WsContainer';
import WsDelivery from '../database/models/WsDelivery';
import WsPayment from '../database/models/WsPayment';
import WsExpense from '../database/models/WsExpense';
import BankAccount from '../database/models/BankAccount';
import CashTransaction from '../database/models/CashTransaction';
import Employee from '../database/models/Employee';
import AgriLandOwner from '../database/models/AgriLandOwner';
import AgriInvestor from '../database/models/AgriInvestor';
import AgriInvestorLedger from '../database/models/AgriInvestorLedger';
import AgriWeeklySettlement from '../database/models/AgriWeeklySettlement';
import AgriGrowthCheckin from '../database/models/AgriGrowthCheckin';
import BusinessUnit from '../database/models/BusinessUnit';
import ChartOfAccount from '../database/models/ChartOfAccount';
import JournalEntry from '../database/models/JournalEntry';
import JournalEntryLine from '../database/models/JournalEntryLine';
import StatutoryFundAllocation from '../database/models/StatutoryFundAllocation';
import Supplier from '../database/models/Supplier';
import AccountsPayableVoucher from '../database/models/AccountsPayableVoucher';
import CommissaryDispatch from '../database/models/CommissaryDispatch';
import WasteLog from '../database/models/WasteLog';
import FranchiseContract from '../database/models/FranchiseContract';
import RoyaltyCalculation from '../database/models/RoyaltyCalculation';
import PosSession from '../database/models/PosSession';
import PayrollRun from '../database/models/PayrollRun';
import PayrollLine from '../database/models/PayrollLine';
import EmployeeLeave from '../database/models/EmployeeLeave';
import ShareCapitalTransaction from '../database/models/ShareCapitalTransaction';
import SavingsTransaction from '../database/models/SavingsTransaction';
import LoanApplication from '../database/models/LoanApplication';
import Guarantor from '../database/models/Guarantor';
import { LOAN_PRODUCT_PRESETS, LoanProductType } from '../utils/loanProducts';

const SAMPLE_MARKER = '[sample-data]';
const SAMPLE_COLLECTOR_ID = sampleUuid('sample-collector-main');
const SAMPLE_AREA_ID = sampleUuid('sample-area-poblacion');
const SAMPLE_BRANCH_ID = sampleUuid('sample-branch-main');
const SAMPLE_WAREHOUSE_ID = sampleUuid('sample-warehouse-main');
const SAMPLE_STORE_ID = sampleUuid('sample-store-agri');

const BORROWER_ID_PREFIX = 'sample-borrower-';
const LOAN_ID_PREFIX = 'sample-loan-';
const EXPENSE_ID_PREFIX = 'sample-expense-';
const FILE_CASE_ID_PREFIX = 'sample-file-case-';

export type SampleStatus = {
    enabled: boolean;
    active: number;
    deleted: number;
    totals: {
        borrowers: number;
        loans: number;
        expenses: number;
        fileCases: number;
        payments: number;
        agriParcels: number;
        agriCropCycles: number;
        agriFarmWorkers: number;
        agriHarvestLogs: number;
        agriLandOwners: number;
        agriInvestors: number;
        agriWeeklySettlements: number;
        agriGrowthCheckins: number;
        marketplaceProducts: number;
        marketplaceStores: number;
        salesReturns: number;
        waterCustomers: number;
        waterDeliveries: number;
        bankAccounts: number;
        employees: number;
        chartOfAccounts: number;
        journalEntries: number;
        suppliers: number;
        accountsPayableVouchers: number;
        payrollRuns: number;
        loanApplications: number;
        shareCapitalTransactions: number;
        savingsTransactions: number;
    };
};

type LoanSeed = {
    type: LoanProductType;
    borrowerName: string;
    principal: number;
    status: string;
    delinquent?: boolean;
    maturityOffsetDays?: number;
};

const LOAN_SEEDS: LoanSeed[] = [
    { type: 'standard', borrowerName: 'Sample Standard Client', principal: 10000, status: 'pending' },
    { type: 'petty_cash', borrowerName: 'Sample Petty Cash Client', principal: 18000, status: 'active' },
    { type: 'livelihood', borrowerName: 'Sample Livelihood Client', principal: 25000, status: 'active' },
    { type: 'salary', borrowerName: 'Sample Salary Client', principal: 12000, status: 'active' },
    { type: 'emergency', borrowerName: 'Sample Emergency Client', principal: 2000, status: 'active' },
    { type: 'standard', borrowerName: 'Sample Delinquent Client', principal: 15000, status: 'defaulted', delinquent: true, maturityOffsetDays: -120 },
];

const EXPENSE_SEEDS = [
    { category: 'Office Supplies', description: `${SAMPLE_MARKER} Printer ink and receipt paper`, amount: 1850 },
    { category: 'Transportation', description: `${SAMPLE_MARKER} Collector route fuel allowance`, amount: 2400 },
    { category: 'Legal', description: `${SAMPLE_MARKER} Case filing documentation fee`, amount: 3200 },
];

function nowMinusDays(days: number) {
    return Date.now() - days * 86400000;
}

/**
 * Deterministic demo-data id generator (2026-10-08).
 *
 * WHY: several synced remote tables declare `id UUID PRIMARY KEY` (app_areas,
 * app_borrowers, ws_customers, employees, ...). PostgREST rejects readable ids
 * like "sample-area-poblacion" with error 22P02, which made the ENTIRE table
 * push fail on every sync and also blocked real (non-sample) records batched
 * with them. Sample records now carry stable UUIDv4-shaped ids derived from a
 * pure, platform-independent 128-bit hash of the historical readable key, so
 * every device computes the same id and enable/disable/purge lookups stay in
 * sync. Legacy readable ids are purged once at bootstrap
 * (purgeLegacyReadableIds) so existing installs stop failing sync.
 */
export function sampleUuid(key: string): string {
    let h1 = 1779033703, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
    for (let i = 0; i < key.length; i++) {
        const k = key.charCodeAt(i);
        h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
        h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
        h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
        h4 = h1 ^ Math.imul(h4 ^ k, 2713634553);
    }
    h1 = (Math.imul(h3 ^ h1, 597399067) ^ Math.imul(h2 ^ h3, 2869860233)) >>> 0;
    h2 = (Math.imul(h4 ^ h2, 951274213) ^ Math.imul(h1 ^ h3, 2713634553)) >>> 0;
    h3 = (Math.imul(h1 ^ h3, 597399067) ^ Math.imul(h2 ^ h4, 2869860233)) >>> 0;
    h4 = (Math.imul(h2 ^ h4, 951274213) ^ Math.imul(h1 ^ h4, 2713634553)) >>> 0;
    const hex = [h1, h2, h3, h4].map(x => x.toString(16).padStart(8, '0')).join('');
    const version = `4${hex.slice(13, 16)}`;
    const variant = (((parseInt(hex.slice(16, 20), 16) & 0x3fff) | 0x8000) >>> 0).toString(16).padStart(4, '0');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${version}-${variant}-${hex.slice(20, 32)}`;
}

/** Pre-2026-10 readable id scheme. Only for purging legacy rows; never assign these as record ids. */
function legacyStableId(prefix: string, value: string) {
    return `${prefix}${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}

function stableId(prefix: string, value: string) {
    return sampleUuid(legacyStableId(prefix, value));
}

async function findById<T>(db: Database, table: string, id: string): Promise<T | null> {
    try {
        return await db.get<T & any>(table).find(id) as T;
    } catch {
        return null;
    }
}

export class SampleDataService {
    static marker = SAMPLE_MARKER;
    static loanSeeds = LOAN_SEEDS;

    static async getStatus(db: Database = globalDatabase): Promise<SampleStatus> {
        const [
            borrowers, loans, expenses, fileCases,
            payments, agriParcels, agriCycles, agriWorkers, agriHarvests,
            stores, products, salesReturns,
            waterCustomers, waterDeliveries, bankAccounts, employees,
            categories, branches, warehouses, stockMovements,
            orders, subOrders, orderItems, returnLines,
            containers, waterPayments, waterExpenses, cashTxns,
            laborLogs, agriExpenses, collectors, areas, schedules,
            landOwners, investors, settlements, checkins, investorLedgers,
            businessUnits, chartOfAccounts, journalEntries, journalEntryLines, statutoryFunds,
            suppliers, apVouchers, commissaryDispatches, wasteLogs, franchiseContracts, royaltyCalcs, posSessions,
            payrollRuns, payrollLines, employeeLeaves,
            shareCapitals, savings, loanApps, guarantors
        ] = await Promise.all([
            this.fetchSampleRecords<Borrower>(db, 'borrowers'),
            this.fetchSampleRecords<Loan>(db, 'loans'),
            this.fetchSampleRecords<Expense>(db, 'expenses'),
            this.fetchSampleRecords<FileCase>(db, 'file_cases'),
            this.fetchSampleRecords<Payment>(db, 'payments'),
            this.fetchSampleRecords<AgriParcel>(db, 'agri_parcels'),
            this.fetchSampleRecords<AgriCropCycle>(db, 'agri_crop_cycles'),
            this.fetchSampleRecords<AgriFarmWorker>(db, 'agri_farm_workers'),
            this.fetchSampleRecords<AgriHarvestLog>(db, 'agri_harvest_logs'),
            this.fetchSampleRecords<MarketplaceStore>(db, 'marketplace_stores'),
            this.fetchSampleRecords<MarketplaceProduct>(db, 'marketplace_products'),
            this.fetchSampleRecords<SalesReturn>(db, 'sales_returns'),
            this.fetchSampleRecords<WsCustomer>(db, 'ws_customers'),
            this.fetchSampleRecords<WsDelivery>(db, 'ws_deliveries'),
            this.fetchSampleRecords<BankAccount>(db, 'bank_accounts'),
            this.fetchSampleRecords<Employee>(db, 'employees'),
            this.fetchSampleRecords<MarketplaceCategory>(db, 'marketplace_categories'),
            this.fetchSampleRecords<Branch>(db, 'branches'),
            this.fetchSampleRecords<Warehouse>(db, 'warehouses'),
            this.fetchSampleRecords<StockMovement>(db, 'stock_movements'),
            this.fetchSampleRecords<MarketplaceOrder>(db, 'marketplace_orders'),
            this.fetchSampleRecords<MarketplaceSubOrder>(db, 'marketplace_sub_orders'),
            this.fetchSampleRecords<MarketplaceOrderItem>(db, 'marketplace_order_items'),
            this.fetchSampleRecords<SalesReturnLine>(db, 'sales_return_lines'),
            this.fetchSampleRecords<WsContainer>(db, 'ws_containers'),
            this.fetchSampleRecords<WsPayment>(db, 'ws_payments'),
            this.fetchSampleRecords<WsExpense>(db, 'ws_expenses'),
            this.fetchSampleRecords<CashTransaction>(db, 'cash_transactions'),
            this.fetchSampleRecords<AgriLaborLog>(db, 'agri_labor_logs'),
            this.fetchSampleRecords<AgriFarmExpense>(db, 'agri_farm_expenses'),
            this.fetchSampleRecords<Collector>(db, 'collectors'),
            this.fetchSampleRecords<Area>(db, 'areas'),
            this.fetchSampleRecords<PaymentSchedule>(db, 'payment_schedules'),
            this.fetchSampleRecords<AgriLandOwner>(db, 'agri_land_owners'),
            this.fetchSampleRecords<AgriInvestor>(db, 'agri_investors'),
            this.fetchSampleRecords<AgriWeeklySettlement>(db, 'agri_weekly_settlements'),
            this.fetchSampleRecords<AgriGrowthCheckin>(db, 'agri_growth_checkins'),
            this.fetchSampleRecords<AgriInvestorLedger>(db, 'agri_investor_ledgers'),
            this.fetchSampleRecords<BusinessUnit>(db, 'business_units'),
            this.fetchSampleRecords<ChartOfAccount>(db, 'chart_of_accounts'),
            this.fetchSampleRecords<JournalEntry>(db, 'journal_entries'),
            this.fetchSampleRecords<JournalEntryLine>(db, 'journal_entry_lines'),
            this.fetchSampleRecords<StatutoryFundAllocation>(db, 'statutory_fund_allocations'),
            this.fetchSampleRecords<Supplier>(db, 'suppliers'),
            this.fetchSampleRecords<AccountsPayableVoucher>(db, 'accounts_payable_vouchers'),
            this.fetchSampleRecords<CommissaryDispatch>(db, 'commissary_dispatches'),
            this.fetchSampleRecords<WasteLog>(db, 'waste_logs'),
            this.fetchSampleRecords<FranchiseContract>(db, 'franchise_contracts'),
            this.fetchSampleRecords<RoyaltyCalculation>(db, 'royalty_calculations'),
            this.fetchSampleRecords<PosSession>(db, 'pos_sessions'),
            this.fetchSampleRecords<PayrollRun>(db, 'payroll_runs'),
            this.fetchSampleRecords<PayrollLine>(db, 'payroll_lines'),
            this.fetchSampleRecords<EmployeeLeave>(db, 'employee_leaves'),
            this.fetchSampleRecords<ShareCapitalTransaction>(db, 'share_capital_transactions'),
            this.fetchSampleRecords<SavingsTransaction>(db, 'savings_transactions'),
            this.fetchSampleRecords<LoanApplication>(db, 'loan_applications'),
            this.fetchSampleRecords<Guarantor>(db, 'guarantors'),
        ]);

        const all = [
            ...borrowers, ...loans, ...expenses, ...fileCases,
            ...payments, ...agriParcels, ...agriCycles, ...agriWorkers, ...agriHarvests,
            ...stores, ...products, ...salesReturns,
            ...waterCustomers, ...waterDeliveries, ...bankAccounts, ...employees,
            ...categories, ...branches, ...warehouses, ...stockMovements,
            ...orders, ...subOrders, ...orderItems, ...returnLines,
            ...containers, ...waterPayments, ...waterExpenses, ...cashTxns,
            ...laborLogs, ...agriExpenses, ...collectors, ...areas, ...schedules,
            ...landOwners, ...investors, ...settlements, ...checkins, ...investorLedgers,
            ...businessUnits, ...chartOfAccounts, ...journalEntries, ...journalEntryLines, ...statutoryFunds,
            ...suppliers, ...apVouchers, ...commissaryDispatches, ...wasteLogs, ...franchiseContracts, ...royaltyCalcs, ...posSessions,
            ...payrollRuns, ...payrollLines, ...employeeLeaves,
            ...shareCapitals, ...savings, ...loanApps, ...guarantors
        ] as any[];

        const active = all.filter(record => !record.deletedAt).length;
        const deleted = all.filter(record => record.deletedAt).length;

        return {
            enabled: active > 0,
            active,
            deleted,
            totals: {
                borrowers: borrowers.length,
                loans: loans.length,
                expenses: expenses.length,
                fileCases: fileCases.length,
                payments: payments.length,
                agriParcels: agriParcels.length,
                agriCropCycles: agriCycles.length,
                agriFarmWorkers: agriWorkers.length,
                agriHarvestLogs: agriHarvests.length,
                agriLandOwners: landOwners.length,
                agriInvestors: investors.length,
                agriWeeklySettlements: settlements.length,
                agriGrowthCheckins: checkins.length,
                marketplaceProducts: products.length,
                marketplaceStores: stores.length,
                salesReturns: salesReturns.length,
                waterCustomers: waterCustomers.length,
                waterDeliveries: waterDeliveries.length,
                bankAccounts: bankAccounts.length,
                employees: employees.length,
                chartOfAccounts: chartOfAccounts.length,
                journalEntries: journalEntries.length,
                suppliers: suppliers.length,
                accountsPayableVouchers: apVouchers.length,
                payrollRuns: payrollRuns.length,
                loanApplications: loanApps.length,
                shareCapitalTransactions: shareCapitals.length,
                savingsTransactions: savings.length,
            },
        };
    }

    static async enable(db: Database = globalDatabase) {
        const existing = await this.fetchAllSampleRecords(db);
        const existingIds = new Set(existing.map((r: any) => r.id));

        await db.write(async () => {
            // Restore any previously soft-deleted sample records
            for (const record of existing as any[]) {
                if (record.deletedAt) {
                    await record.update((r: any) => {
                        r.deletedAt = null;
                    });
                }
            }

            // 1. Core Lending: Area & Collector
            if (!existingIds.has(SAMPLE_AREA_ID)) {
                await db.get<Area>('areas').create(record => {
                    record._raw.id = SAMPLE_AREA_ID;
                    record.name = `${SAMPLE_MARKER} District 1 - Poblacion Agri-Center`;
                    record.code = 'AREA-POB-01';
                    record.isActive = true;
                });
            }

            if (!existingIds.has(SAMPLE_COLLECTOR_ID)) {
                await db.get<Collector>('collectors').create(record => {
                    record._raw.id = SAMPLE_COLLECTOR_ID;
                    record.fullName = `${SAMPLE_MARKER} Main Field Collector`;
                    record.authId = uuid.v4().toString();
                    record.isActive = true;
                    record.commissionRate = 5;
                });
            }

            // 2. Borrowers, Loans, Schedules, and Payments
            for (const seed of LOAN_SEEDS) {
                const borrowerId = stableId(BORROWER_ID_PREFIX, seed.borrowerName);
                const loanId = stableId(LOAN_ID_PREFIX, `${seed.type}-${seed.borrowerName}`);

                if (!existingIds.has(borrowerId)) {
                    await db.get<Borrower>('borrowers').create(record => {
                        record._raw.id = borrowerId;
                        record.fullName = seed.borrowerName;
                        record.firstName = seed.borrowerName.replace(/^Sample\s+/, '').split(' ')[0] || 'Sample';
                        record.lastName = 'Client';
                        record.address = `${SAMPLE_MARKER} Purok 4, Poblacion, Tacurong City`;
                        record.business = seed.type.includes('salary') ? 'Sample Employer Inc.' : 'Sample Sari-sari Store';
                        record.group = seed.type.includes('salary') ? 'Institutional' : 'Community';
                        record.collectorId = SAMPLE_COLLECTOR_ID;
                        record.areaId = SAMPLE_AREA_ID;
                        record.createdBy = 'sample-data';
                    });
                }

                if (!existingIds.has(loanId)) {
                    const preset = LOAN_PRODUCT_PRESETS[seed.type];
                    const releaseDate = nowMinusDays(seed.delinquent ? 240 : 14);
                    const maturityDate = seed.maturityOffsetDays ? nowMinusDays(Math.abs(seed.maturityOffsetDays)) : releaseDate + 90 * 86400000;
                    const interestRate = Number(preset.defaultRatePercent || 0);
                    const totalAmount = Math.round(seed.principal * (1 + interestRate / 100));
                    const term = Number(preset.defaultTerm || 1);
                    const installmentAmount = Math.round(totalAmount / Math.max(1, term));

                    await db.get<Loan>('loans').create(record => {
                        record._raw.id = loanId;
                        record.borrowerId = borrowerId;
                        record.collectorId = SAMPLE_COLLECTOR_ID;
                        record.loanNumber = `SAMPLE-${seed.type.toUpperCase()}`;
                        record.loanType = seed.type;
                        record.principalAmount = seed.principal;
                        record.interestRate = interestRate;
                        record.interestType = 'flat';
                        record.term = term;
                        record.termUnit = preset.defaultTermUnit;
                        record.frequency = preset.defaultFrequency;
                        record.totalAmount = totalAmount;
                        record.installmentAmount = installmentAmount;
                        record.status = seed.status;
                        record.releaseDate = releaseDate;
                        record.firstPaymentDate = releaseDate + 30 * 86400000;
                        record.maturityDate = maturityDate;
                        record.interestAmount = totalAmount - seed.principal;
                        record.notes = `${SAMPLE_MARKER} ${preset.label}`;
                        record.isDelinquent = !!seed.delinquent;
                        record.delinquentSince = seed.delinquent ? nowMinusDays(90) : null;
                        record.encodedBy = 'sample-data';
                    });

                    // Payment Schedule & Payment for active loans
                    if (seed.status === 'active') {
                        const sched1Id = sampleUuid(`sample-sched-${loanId}-1`);
                        const sched2Id = sampleUuid(`sample-sched-${loanId}-2`);
                        const pay1Id = sampleUuid(`sample-pay-${loanId}-1`);

                        if (!existingIds.has(sched1Id)) {
                            await db.get<PaymentSchedule>('payment_schedules').create(sched => {
                                sched._raw.id = sched1Id;
                                sched.loanId = loanId;
                                sched.dueDate = nowMinusDays(7);
                                sched.scheduledAmount = installmentAmount;
                                sched.principalAmount = Math.round(seed.principal / term);
                                sched.interestAmount = Math.round((totalAmount - seed.principal) / term);
                                sched.feesAmount = 0;
                                sched.status = 'paid';
                            });
                        }

                        if (!existingIds.has(sched2Id)) {
                            await db.get<PaymentSchedule>('payment_schedules').create(sched => {
                                sched._raw.id = sched2Id;
                                sched.loanId = loanId;
                                sched.dueDate = nowMinusDays(-7);
                                sched.scheduledAmount = installmentAmount;
                                sched.principalAmount = Math.round(seed.principal / term);
                                sched.interestAmount = Math.round((totalAmount - seed.principal) / term);
                                sched.feesAmount = 0;
                                sched.status = 'pending';
                            });
                        }

                        if (!existingIds.has(pay1Id)) {
                            await db.get<Payment>('payments').create(payment => {
                                payment._raw.id = pay1Id;
                                payment.loanId = loanId;
                                payment.borrowerId = borrowerId;
                                payment.scheduleId = sched1Id;
                                payment.collectorId = SAMPLE_COLLECTOR_ID;
                                payment.amount = installmentAmount;
                                payment.currentSalary = 0;
                                payment.excessCash = 0;
                                payment.paymentDate = nowMinusDays(7);
                                payment.paymentType = 'cash';
                                payment.receiptNumber = `OR-SAM-${loanId.slice(-4)}`;
                                payment.notes = `${SAMPLE_MARKER} Installment payment on schedule`;
                                payment.encodedAt = nowMinusDays(7);
                            });
                        }
                    }
                }
            }

            // 3. Operating Expenses
            for (const [index, seed] of EXPENSE_SEEDS.entries()) {
                const id = sampleUuid(`${EXPENSE_ID_PREFIX}${index + 1}`);
                if (!existingIds.has(id)) {
                    await db.get<Expense>('expenses').create(record => {
                        record._raw.id = id;
                        record.category = seed.category;
                        record.description = seed.description;
                        record.amount = seed.amount;
                        record.expenseDate = nowMinusDays(index + 1);
                        record.frequency = 'none';
                        record.encodedBy = 'sample-data';
                    });
                }
            }

            // 4. File Cases
            const delinquentLoanId = stableId(LOAN_ID_PREFIX, 'standard-Sample Delinquent Client');
            const delinquentBorrowerId = stableId(BORROWER_ID_PREFIX, 'Sample Delinquent Client');
            if (!existingIds.has(sampleUuid(`${FILE_CASE_ID_PREFIX}delinquent`))) {
                await db.get<FileCase>('file_cases').create(record => {
                    record._raw.id = sampleUuid(`${FILE_CASE_ID_PREFIX}delinquent`);
                    record.loanId = delinquentLoanId;
                    record.borrowerId = delinquentBorrowerId;
                    record.caseNumber = 'SAMPLE-FC-001';
                    record.filedDate = nowMinusDays(7);
                    record.status = 'open';
                    record.notes = `${SAMPLE_MARKER} Six-month overdue account prepared for legal follow-up.`;
                    record.filedBy = 'sample-data';
                });
            }

            // 5. Agribusiness (JetFarm Outgrower Operations)
            const standardBorrowerId = stableId(BORROWER_ID_PREFIX, 'Sample Standard Client');
            const livelihoodBorrowerId = stableId(BORROWER_ID_PREFIX, 'Sample Livelihood Client');

            const parcel1Id = sampleUuid('sample-parcel-1');
            const parcel2Id = sampleUuid('sample-parcel-2');
            if (!existingIds.has(parcel1Id)) {
                await db.get<AgriParcel>('agri_parcels').create(p => {
                    p._raw.id = parcel1Id;
                    p.name = `${SAMPLE_MARKER} Sunrise Valley Parcel A`;
                    p.code = 'PARCEL-SV-01';
                    p.landOwnerId = standardBorrowerId;
                    p.areaHectares = 4.5;
                    p.locationAddress = 'Barangay San Emmanuel, Tacurong City';
                    p.soilType = 'Sandy Loam';
                    p.status = 'planted';
                });
            }
            if (!existingIds.has(parcel2Id)) {
                await db.get<AgriParcel>('agri_parcels').create(p => {
                    p._raw.id = parcel2Id;
                    p.name = `${SAMPLE_MARKER} Highland Ridge Parcel B`;
                    p.code = 'PARCEL-HR-02';
                    p.landOwnerId = livelihoodBorrowerId;
                    p.areaHectares = 3.2;
                    p.locationAddress = 'Barangay Upper Katungal, Tacurong City';
                    p.soilType = 'Clay Loam';
                    p.status = 'harvesting';
                });
            }

            const cycle1Id = sampleUuid('sample-cycle-1');
            const cycle2Id = sampleUuid('sample-cycle-2');
            if (!existingIds.has(cycle1Id)) {
                await db.get<AgriCropCycle>('agri_crop_cycles').create(c => {
                    c._raw.id = cycle1Id;
                    c.cycleCode = 'CYCLE-2026-CAS-01';
                    c.parcelId = parcel1Id;
                    c.cropType = 'Cassava';
                    c.variety = 'KU50 Industrial High-Starch';
                    c.plantingDate = new Date(nowMinusDays(120));
                    c.targetHarvestDate = new Date(nowMinusDays(-60));
                    c.areaPlantedHa = 4.5;
                    c.status = 'growing';
                    c.expectedYieldKg = 28000;
                    c.totalActualYieldKg = 0;
                    c.capitalAllocated = 45000;
                    c.landOwnerRatePerKg = 0.50;
                    c.landOwnerGuaranteedMin = 5000;
                    c.offtakePricePerKg = 4.50;
                    c.notes = `${SAMPLE_MARKER} High-starch cassava outgrower cycle`;
                });
            }
            if (!existingIds.has(cycle2Id)) {
                await db.get<AgriCropCycle>('agri_crop_cycles').create(c => {
                    c._raw.id = cycle2Id;
                    c.cycleCode = 'CYCLE-2026-CRN-02';
                    c.parcelId = parcel2Id;
                    c.cropType = 'Yellow Corn';
                    c.variety = 'Pioneer 30T80 Hybrid';
                    c.plantingDate = new Date(nowMinusDays(90));
                    c.targetHarvestDate = new Date(nowMinusDays(5));
                    c.actualHarvestDate = new Date(nowMinusDays(3));
                    c.areaPlantedHa = 3.2;
                    c.status = 'harvesting';
                    c.expectedYieldKg = 18000;
                    c.totalActualYieldKg = 17200;
                    c.capitalAllocated = 38000;
                    c.landOwnerRatePerKg = 1.20;
                    c.landOwnerGuaranteedMin = 6000;
                    c.offtakePricePerKg = 16.50;
                    c.notes = `${SAMPLE_MARKER} Feed-grade hybrid yellow corn harvest`;
                });
            }

            const worker1Id = sampleUuid('sample-worker-1');
            const worker2Id = sampleUuid('sample-worker-2');
            if (!existingIds.has(worker1Id)) {
                await db.get<AgriFarmWorker>('agri_farm_workers').create(w => {
                    w._raw.id = worker1Id;
                    w.name = `${SAMPLE_MARKER} Ramon Santos`;
                    w.contactNumber = '0917-888-1234';
                    w.specialization = 'Field Supervisor & Harvester';
                    w.dailyRate = 550;
                    w.status = 'active';
                });
            }
            if (!existingIds.has(worker2Id)) {
                await db.get<AgriFarmWorker>('agri_farm_workers').create(w => {
                    w._raw.id = worker2Id;
                    w.name = `${SAMPLE_MARKER} Eduardo Reyes`;
                    w.contactNumber = '0928-777-5678';
                    w.specialization = 'Tractor Operator & Plowing';
                    w.dailyRate = 600;
                    w.status = 'active';
                });
            }

            const agriExp1Id = sampleUuid('sample-agri-exp-1');
            const agriExp2Id = sampleUuid('sample-agri-exp-2');
            if (!existingIds.has(agriExp1Id)) {
                await db.get<AgriFarmExpense>('agri_farm_expenses').create(e => {
                    e._raw.id = agriExp1Id;
                    e.cropCycleId = cycle1Id;
                    e.parcelId = parcel1Id;
                    e.expenseDate = new Date(nowMinusDays(60));
                    e.category = 'Fertilizer';
                    e.description = `${SAMPLE_MARKER} Complete 14-14-14 Fertilizer (30 bags)`;
                    e.amount = 39000;
                    e.paidBy = 'jet';
                });
            }
            if (!existingIds.has(agriExp2Id)) {
                await db.get<AgriFarmExpense>('agri_farm_expenses').create(e => {
                    e._raw.id = agriExp2Id;
                    e.cropCycleId = cycle2Id;
                    e.parcelId = parcel2Id;
                    e.expenseDate = new Date(nowMinusDays(30));
                    e.category = 'Labor';
                    e.description = `${SAMPLE_MARKER} Weeding and foliar spraying service`;
                    e.amount = 8500;
                    e.paidBy = 'jet';
                });
            }

            const labor1Id = sampleUuid('sample-labor-1');
            if (!existingIds.has(labor1Id)) {
                await db.get<AgriLaborLog>('agri_labor_logs').create(l => {
                    l._raw.id = labor1Id;
                    l.workerId = worker1Id;
                    l.cropCycleId = cycle1Id;
                    l.workDate = new Date(nowMinusDays(5));
                    l.task = 'Crop monitoring, furrow weeding, fertilizer application';
                    l.rateType = 'daily';
                    l.unitsCompleted = 3;
                    l.ratePerUnit = 550;
                    l.totalPay = 1650;
                    l.paymentStatus = 'paid';
                    l.notes = `${SAMPLE_MARKER} Logged by field supervisor`;
                });
            }

            const harvest1Id = sampleUuid('sample-harvest-1');
            if (!existingIds.has(harvest1Id)) {
                await db.get<AgriHarvestLog>('agri_harvest_logs').create(h => {
                    h._raw.id = harvest1Id;
                    h.cropCycleId = cycle2Id;
                    h.parcelId = parcel2Id;
                    h.harvestDate = new Date(nowMinusDays(3));
                    h.batchNumber = 'HARV-2026-001';
                    h.grossWeightKg = 18500;
                    h.tareWeightKg = 1300;
                    h.netWeightKg = 17200;
                    h.qualityGrade = 'A';
                    h.truckPlateNumber = 'NBC-4819';
                    h.weighInSupervisor = 'Ramon Santos';
                    h.notes = `${SAMPLE_MARKER} Yellow corn passed quality moisture scale (14%)`;
                });
            }

            // 6. Branch, Warehouse, Marketplace & POS Inventory
            if (!existingIds.has(SAMPLE_BRANCH_ID)) {
                await db.get<Branch>('branches').create(b => {
                    b._raw.id = SAMPLE_BRANCH_ID;
                    b.name = `${SAMPLE_MARKER} JetFarm Main Operations Hub`;
                    b.code = 'JFB-01';
                    b.isHq = true;
                    b.isActive = true;
                });
            }

            if (!existingIds.has(SAMPLE_WAREHOUSE_ID)) {
                await db.get<Warehouse>('warehouses').create(w => {
                    w._raw.id = SAMPLE_WAREHOUSE_ID;
                    w.branchId = SAMPLE_BRANCH_ID;
                    w.name = `${SAMPLE_MARKER} Central Agri & Cold Storage Warehouse`;
                    w.type = 'store';
                    w.isActive = true;
                });
            }

            if (!existingIds.has(SAMPLE_STORE_ID)) {
                await db.get<MarketplaceStore>('marketplace_stores').create(s => {
                    s._raw.id = SAMPLE_STORE_ID;
                    s.borrowerId = standardBorrowerId;
                    s.name = `${SAMPLE_MARKER} JetFarm Agri-Store Hub`;
                    s.slug = 'jetfarm-agri-store';
                    s.description = `${SAMPLE_MARKER} Official distributor of hybrid seeds, biological fertilizers, and farm inputs.`;
                    s.category = 'Agricultural Supplies';
                    s.status = 'active';
                    s.holidayMode = false;
                    s.rating = 4.9;
                    s.commissionTier = 'standard';
                });
            }

            const cat1Id = sampleUuid('sample-cat-fert');
            const cat2Id = sampleUuid('sample-cat-seeds');
            const cat3Id = sampleUuid('sample-cat-produce');
            if (!existingIds.has(cat1Id)) {
                await db.get<MarketplaceCategory>('marketplace_categories').create(c => {
                    c._raw.id = cat1Id;
                    c.name = 'Fertilizers & Soil';
                    c.slug = 'fertilizers';
                    c.icon = 'eco';
                    c.isActive = true;
                });
            }
            if (!existingIds.has(cat2Id)) {
                await db.get<MarketplaceCategory>('marketplace_categories').create(c => {
                    c._raw.id = cat2Id;
                    c.name = 'Hybrid Seeds';
                    c.slug = 'seeds';
                    c.icon = 'grass';
                    c.isActive = true;
                });
            }
            if (!existingIds.has(cat3Id)) {
                await db.get<MarketplaceCategory>('marketplace_categories').create(c => {
                    c._raw.id = cat3Id;
                    c.name = 'Fresh Produce';
                    c.slug = 'produce';
                    c.icon = 'local-florist';
                    c.isActive = true;
                });
            }

            const prod1Id = sampleUuid('sample-prod-1');
            const prod2Id = sampleUuid('sample-prod-2');
            const prod3Id = sampleUuid('sample-prod-3');
            if (!existingIds.has(prod1Id)) {
                await db.get<MarketplaceProduct>('marketplace_products').create(p => {
                    p._raw.id = prod1Id;
                    p.storeId = SAMPLE_STORE_ID;
                    p.title = `${SAMPLE_MARKER} Bio-Organic Fertilizer 14-14-14 (50kg)`;
                    p.description = 'Balanced organic complete fertilizer for corn, cassava, and vegetables.';
                    p.productType = 'Fertilizer';
                    p.price = 1450;
                    p.compareAtPrice = 1600;
                    p.stockQuantity = 120;
                    p.sku = 'AGRI-FERT-14-50K';
                    p.status = 'active';
                });
            }
            if (!existingIds.has(prod2Id)) {
                await db.get<MarketplaceProduct>('marketplace_products').create(p => {
                    p._raw.id = prod2Id;
                    p.storeId = SAMPLE_STORE_ID;
                    p.title = `${SAMPLE_MARKER} Pioneer 30T80 Hybrid Corn Seeds (1kg)`;
                    p.description = 'High germination, drought-resistant yellow hybrid corn seeds.';
                    p.productType = 'Seeds';
                    p.price = 380;
                    p.compareAtPrice = 420;
                    p.stockQuantity = 85;
                    p.sku = 'SEED-PION-01K';
                    p.status = 'active';
                });
            }
            if (!existingIds.has(prod3Id)) {
                await db.get<MarketplaceProduct>('marketplace_products').create(p => {
                    p._raw.id = prod3Id;
                    p.storeId = SAMPLE_STORE_ID;
                    p.title = `${SAMPLE_MARKER} Fresh Farm Eggs Grade A (Tray of 30)`;
                    p.description = 'Freshly gathered brown table eggs from free-range hens.';
                    p.productType = 'Produce';
                    p.price = 240;
                    p.compareAtPrice = 260;
                    p.stockQuantity = 50;
                    p.sku = 'PROD-EGG-30S';
                    p.status = 'active';
                });
            }

            const stock1Id = sampleUuid('sample-stock-1');
            const stock2Id = sampleUuid('sample-stock-2');
            if (!existingIds.has(stock1Id)) {
                await db.get<StockMovement>('stock_movements').create(sm => {
                    sm._raw.id = stock1Id;
                    sm.productId = prod1Id;
                    sm.productSource = 'marketplace_products';
                    sm.moduleId = 'agri-store';
                    sm.warehouseId = SAMPLE_WAREHOUSE_ID;
                    sm.branchId = SAMPLE_BRANCH_ID;
                    sm.movementType = 'purchase';
                    sm.quantityIn = 150;
                    sm.quantityOut = 0;
                    sm.quantityBalance = 150;
                    sm.unitCost = 1150;
                    sm.totalCost = 172500;
                    sm.referenceNumber = 'PO-2026-081';
                    sm.sourceTable = 'suppliers';
                    sm.movementDate = new Date(nowMinusDays(15));
                    sm.notes = `${SAMPLE_MARKER} Inbound supplier delivery to central warehouse`;
                    sm.performedBy = 'Warehouse Officer';
                });
            }
            if (!existingIds.has(stock2Id)) {
                await db.get<StockMovement>('stock_movements').create(sm => {
                    sm._raw.id = stock2Id;
                    sm.productId = prod1Id;
                    sm.productSource = 'marketplace_products';
                    sm.moduleId = 'agri-store';
                    sm.warehouseId = SAMPLE_WAREHOUSE_ID;
                    sm.branchId = SAMPLE_BRANCH_ID;
                    sm.movementType = 'sale';
                    sm.quantityIn = 0;
                    sm.quantityOut = 30;
                    sm.quantityBalance = 120;
                    sm.unitCost = 1150;
                    sm.totalCost = 34500;
                    sm.referenceNumber = 'SO-2026-104';
                    sm.sourceTable = 'marketplace_orders';
                    sm.movementDate = new Date(nowMinusDays(7));
                    sm.notes = `${SAMPLE_MARKER} Retail sales deduction from POS`;
                    sm.performedBy = 'Cashier';
                });
            }

            const order1Id = sampleUuid('sample-order-1');
            const subOrder1Id = sampleUuid('sample-suborder-1');
            const orderItem1Id = sampleUuid('sample-orderitem-1');
            const orderItem2Id = sampleUuid('sample-orderitem-2');

            if (!existingIds.has(order1Id)) {
                await db.get<MarketplaceOrder>('marketplace_orders').create(o => {
                    o._raw.id = order1Id;
                    o.buyerId = standardBorrowerId;
                    o.orderNumber = 'ORD-2026-001';
                    o.totalAmount = 3280;
                    o.paymentMethod = 'cash';
                    o.paymentStatus = 'paid';
                });
            }
            if (!existingIds.has(subOrder1Id)) {
                await db.get<MarketplaceSubOrder>('marketplace_sub_orders').create(so => {
                    so._raw.id = subOrder1Id;
                    so.orderId = order1Id;
                    so.storeId = SAMPLE_STORE_ID;
                    so.subOrderNumber = 'SUB-2026-001';
                    so.subtotal = 3280;
                    so.commissionAmount = 114.80;
                    so.shippingFee = 0;
                    so.netPayout = 3165.20;
                    so.fulfillmentStatus = 'delivered';
                    so.payoutStatus = 'settled';
                });
            }
            if (!existingIds.has(orderItem1Id)) {
                await db.get<MarketplaceOrderItem>('marketplace_order_items').create(oi => {
                    oi._raw.id = orderItem1Id;
                    oi.subOrderId = subOrder1Id;
                    oi.productId = prod1Id;
                    oi.quantity = 2;
                    oi.unitPrice = 1450;
                    oi.totalPrice = 2900;
                });
            }
            if (!existingIds.has(orderItem2Id)) {
                await db.get<MarketplaceOrderItem>('marketplace_order_items').create(oi => {
                    oi._raw.id = orderItem2Id;
                    oi.subOrderId = subOrder1Id;
                    oi.productId = prod2Id;
                    oi.quantity = 1;
                    oi.unitPrice = 380;
                    oi.totalPrice = 380;
                });
            }

            // 7. Sales Returns (Strict 3-step workflow)
            const return1Id = sampleUuid('sample-return-1');
            const retLine1Id = sampleUuid('sample-retline-1');
            if (!existingIds.has(return1Id)) {
                await db.get<SalesReturn>('sales_returns').create(sr => {
                    sr._raw.id = return1Id;
                    sr.returnNumber = 'SR-2026-001';
                    sr.originalOrderNumber = 'ORD-2026-001';
                    sr.originalOrderId = order1Id;
                    sr.customerId = standardBorrowerId;
                    sr.customerName = 'Sample Standard Client';
                    sr.branchId = SAMPLE_BRANCH_ID;
                    sr.warehouseId = SAMPLE_WAREHOUSE_ID;
                    sr.status = 'completed';
                    sr.reason = 'Packaging torn during delivery transport';
                    sr.totalRefundAmount = 1450;
                    sr.refundMethod = 'cash';
                    sr.createdBy = 'sample-data';
                    sr.approvedBy = 'Supervisor Jane';
                    sr.approvedAt = new Date(nowMinusDays(2));
                    sr.completedAt = new Date(nowMinusDays(1));
                    sr.notes = `${SAMPLE_MARKER} Sales return completed: 1 bag fertilizer verified damaged, returned to quarantine/waste, customer refunded in cash.`;
                });
            }
            if (!existingIds.has(retLine1Id)) {
                await db.get<SalesReturnLine>('sales_return_lines').create(srl => {
                    srl._raw.id = retLine1Id;
                    srl.salesReturnId = return1Id;
                    srl.productId = prod1Id;
                    srl.productName = 'Bio-Organic Fertilizer 14-14-14 (50kg)';
                    srl.sku = 'AGRI-FERT-14-50K';
                    srl.returnQuantity = 1;
                    srl.uom = 'bag';
                    srl.uomMultiplier = 1;
                    srl.baseQuantity = 1;
                    srl.unitPrice = 1450;
                    srl.totalAmount = 1450;
                    srl.condition = 'damaged';
                    srl.restockAction = 'waste_log';
                });
            }

            // 8. Water Refilling Station
            const wsCust1Id = sampleUuid('sample-wscust-1');
            const wsCust2Id = sampleUuid('sample-wscust-2');
            if (!existingIds.has(wsCust1Id)) {
                await db.get<WsCustomer>('ws_customers').create(c => {
                    c._raw.id = wsCust1Id;
                    c.name = `${SAMPLE_MARKER} Barangay San Isidro Health Center`;
                    c.phone = '0917-123-4567';
                    c.address = 'Purok 3, San Isidro, Tacurong City';
                    c.isMember = true;
                    c.isActive = true;
                });
            }
            if (!existingIds.has(wsCust2Id)) {
                await db.get<WsCustomer>('ws_customers').create(c => {
                    c._raw.id = wsCust2Id;
                    c.name = `${SAMPLE_MARKER} Elena's Bakery & Café`;
                    c.phone = '0928-555-7890';
                    c.address = 'Poblacion Commercial Strip, Tacurong City';
                    c.isMember = true;
                    c.isActive = true;
                });
            }

            const wsCont1Id = sampleUuid('sample-wscont-1');
            const wsCont2Id = sampleUuid('sample-wscont-2');
            if (!existingIds.has(wsCont1Id)) {
                await db.get<WsContainer>('ws_containers').create(c => {
                    c._raw.id = wsCont1Id;
                    c.customerId = wsCust1Id;
                    c.containerType = 'round';
                    c.quantityOwned = 15;
                    c.quantityLoaned = 10;
                });
            }
            if (!existingIds.has(wsCont2Id)) {
                await db.get<WsContainer>('ws_containers').create(c => {
                    c._raw.id = wsCont2Id;
                    c.customerId = wsCust2Id;
                    c.containerType = 'slim';
                    c.quantityOwned = 20;
                    c.quantityLoaned = 12;
                });
            }

            const wsDel1Id = sampleUuid('sample-wsdel-1');
            const wsDel2Id = sampleUuid('sample-wsdel-2');
            if (!existingIds.has(wsDel1Id)) {
                await db.get<WsDelivery>('ws_deliveries').create(d => {
                    d._raw.id = wsDel1Id;
                    d.customerId = wsCust1Id;
                    d.deliveryDate = nowMinusDays(2);
                    d.gallons = 10;
                    d.pricePerGallon = 35;
                    d.totalAmount = 350;
                    d.status = 'delivered';
                });
            }
            if (!existingIds.has(wsDel2Id)) {
                await db.get<WsDelivery>('ws_deliveries').create(d => {
                    d._raw.id = wsDel2Id;
                    d.customerId = wsCust2Id;
                    d.deliveryDate = nowMinusDays(1);
                    d.gallons = 8;
                    d.pricePerGallon = 35;
                    d.totalAmount = 280;
                    d.status = 'delivered';
                });
            }

            const wsPay1Id = sampleUuid('sample-wspay-1');
            if (!existingIds.has(wsPay1Id)) {
                await db.get<WsPayment>('ws_payments').create(p => {
                    p._raw.id = wsPay1Id;
                    p.customerId = wsCust1Id;
                    p.deliveryId = wsDel1Id;
                    p.paymentDate = nowMinusDays(2);
                    p.amount = 350;
                    p.paymentMethod = 'cash';
                });
            }

            const wsExp1Id = sampleUuid('sample-wsexp-1');
            if (!existingIds.has(wsExp1Id)) {
                await db.get<WsExpense>('ws_expenses').create(e => {
                    e._raw.id = wsExp1Id;
                    e.expenseDate = nowMinusDays(10);
                    e.category = 'Maintenance';
                    e.description = `${SAMPLE_MARKER} Replacement sediment and activated carbon filters`;
                    e.amount = 1250;
                });
            }

            // 9. Financials: Bank Accounts & Vault Float
            const bank1Id = sampleUuid('sample-bank-1');
            const bank2Id = sampleUuid('sample-bank-2');
            if (!existingIds.has(bank1Id)) {
                await db.get<BankAccount>('bank_accounts').create(b => {
                    b._raw.id = bank1Id;
                    b.bankName = 'LandBank of the Philippines';
                    b.accountName = `${SAMPLE_MARKER} JetFarm Agri-Operations Account`;
                    b.accountNumber = '0421-9981-22';
                    b.startingBalance = 250000;
                });
            }
            if (!existingIds.has(bank2Id)) {
                await db.get<BankAccount>('bank_accounts').create(b => {
                    b._raw.id = bank2Id;
                    b.bankName = 'BDO Unibank';
                    b.accountName = `${SAMPLE_MARKER} JetFarm Treasury & Lending Float`;
                    b.accountNumber = '1009-4452-11';
                    b.startingBalance = 180000;
                });
            }

            const cashTx1Id = sampleUuid('sample-cashtx-1');
            if (!existingIds.has(cashTx1Id)) {
                await db.get<CashTransaction>('cash_transactions').create(tx => {
                    tx._raw.id = cashTx1Id;
                    tx.transactionDate = nowMinusDays(30);
                    tx.branchId = SAMPLE_BRANCH_ID;
                    tx.particulars = `${SAMPLE_MARKER} Initial vault cash operating float`;
                    tx.type = 'cash_in';
                    tx.amount = 50000;
                    tx.remarks = 'Authorized starting petty and vault float';
                    tx.recordedBy = 'sample-data';
                    tx.isPettyCash = false;
                });
            }

            // 10. HR & Staff Employees
            const emp1Id = sampleUuid('sample-emp-1');
            const emp2Id = sampleUuid('sample-emp-2');
            if (!existingIds.has(emp1Id)) {
                await db.get<Employee>('employees').create(emp => {
                    emp._raw.id = emp1Id;
                    emp.employeeCode = 'EMP-001';
                    emp.firstName = 'Maria Clara';
                    emp.lastName = 'Santos';
                    emp.position = 'Lead Agronomist & Field Coordinator';
                    emp.branchId = SAMPLE_BRANCH_ID;
                    emp.dailyRate = 750;
                    emp.baseSalaryField = 19500;
                    emp.hireDate = new Date(nowMinusDays(365));
                    emp.sssNumber = '04-1234567-8';
                    emp.philhealthNumber = '12-345678901-2';
                    emp.pagibigNumber = '1234-5678-9012';
                    emp.tin = '123-456-789-000';
                    emp.phone = '0917-222-3344';
                    emp.isActive = true;
                });
            }
            if (!existingIds.has(emp2Id)) {
                await db.get<Employee>('employees').create(emp => {
                    emp._raw.id = emp2Id;
                    emp.employeeCode = 'EMP-002';
                    emp.firstName = 'Jose Rizal';
                    emp.lastName = 'Mercado';
                    emp.position = 'Farm Operations & Logistics Manager';
                    emp.branchId = SAMPLE_BRANCH_ID;
                    emp.dailyRate = 850;
                    emp.baseSalaryField = 22100;
                    emp.hireDate = new Date(nowMinusDays(400));
                    emp.sssNumber = '04-9876543-2';
                    emp.philhealthNumber = '98-765432109-8';
                    emp.pagibigNumber = '9876-5432-1098';
                    emp.tin = '987-654-321-000';
                    emp.phone = '0928-444-5566';
                    emp.isActive = true;
                });
            }

            // 11. Agribusiness Outgrowers, Investors, Growth Logs & Weekly Settlements
            const landowner1Id = sampleUuid('sample-landowner-1');
            const landowner2Id = sampleUuid('sample-landowner-2');
            if (!existingIds.has(landowner1Id)) {
                await db.get<AgriLandOwner>('agri_land_owners').create(lo => {
                    lo._raw.id = landowner1Id;
                    lo.userId = standardBorrowerId;
                    lo.name = `${SAMPLE_MARKER} Don Alejandro Valderrama`;
                    lo.contactNumber = '0917-555-1122';
                    lo.bankName = 'LandBank of the Philippines';
                    lo.accountNumber = '0421-5582-90';
                    lo.defaultPerKiloRate = 0.50;
                    lo.defaultGuaranteedMinimum = 5000;
                    lo.notes = `${SAMPLE_MARKER} Agrarian beneficiary - Sunrise Valley Cassava Parcel`;
                });
            }
            if (!existingIds.has(landowner2Id)) {
                await db.get<AgriLandOwner>('agri_land_owners').create(lo => {
                    lo._raw.id = landowner2Id;
                    lo.userId = livelihoodBorrowerId;
                    lo.name = `${SAMPLE_MARKER} Faustina Dizon`;
                    lo.contactNumber = '0928-333-4455';
                    lo.bankName = 'BDO Unibank';
                    lo.accountNumber = '1009-8871-34';
                    lo.defaultPerKiloRate = 1.20;
                    lo.defaultGuaranteedMinimum = 6000;
                    lo.notes = `${SAMPLE_MARKER} High-yield hybrid yellow corn parcel owner`;
                });
            }

            const investor1Id = sampleUuid('sample-investor-1');
            const investor2Id = sampleUuid('sample-investor-2');
            if (!existingIds.has(investor1Id)) {
                await db.get<AgriInvestor>('agri_investors').create(inv => {
                    inv._raw.id = investor1Id;
                    inv.companyName = `${SAMPLE_MARKER} South Cotabato Bio-Feed Mills`;
                    inv.contactPerson = 'Engr. Roberto Dizon';
                    inv.contactNumber = '0917-999-0011';
                    inv.email = 'procurement@scfeedmills.ph';
                    inv.defaultOfftakePricePerKg = 16.50;
                    inv.notes = `${SAMPLE_MARKER} Institutional contract offtaker for grade-A yellow corn`;
                });
            }
            if (!existingIds.has(investor2Id)) {
                await db.get<AgriInvestor>('agri_investors').create(inv => {
                    inv._raw.id = investor2Id;
                    inv.companyName = `${SAMPLE_MARKER} Sultan Kudarat Agri-Commodities Inc.`;
                    inv.contactPerson = 'Cynthia Tan';
                    inv.contactNumber = '0918-888-2233';
                    inv.email = 'trade@skagri.ph';
                    inv.defaultOfftakePricePerKg = 4.50;
                    inv.notes = `${SAMPLE_MARKER} Industrial high-starch cassava processor`;
                });
            }

            const checkin1Id = sampleUuid('sample-checkin-1');
            const checkin2Id = sampleUuid('sample-checkin-2');
            if (!existingIds.has(checkin1Id)) {
                await db.get<AgriGrowthCheckin>('agri_growth_checkins').create(chk => {
                    chk._raw.id = checkin1Id;
                    chk.cropCycleId = cycle1Id;
                    chk.checkinDate = new Date(nowMinusDays(30));
                    chk.stage = 'vegetative';
                    chk.plantHeightCm = 145;
                    chk.healthStatus = 'optimal';
                    chk.notes = `${SAMPLE_MARKER} Cassava canopy dense, healthy chlorophyll levels`;
                });
            }
            if (!existingIds.has(checkin2Id)) {
                await db.get<AgriGrowthCheckin>('agri_growth_checkins').create(chk => {
                    chk._raw.id = checkin2Id;
                    chk.cropCycleId = cycle2Id;
                    chk.checkinDate = new Date(nowMinusDays(10));
                    chk.stage = 'maturity';
                    chk.plantHeightCm = 185;
                    chk.healthStatus = 'good';
                    chk.notes = `${SAMPLE_MARKER} Corn ears filled, moisture testing 15.2% ready for harvest`;
                });
            }

            const settle1Id = sampleUuid('sample-settlement-1');
            const settle2Id = sampleUuid('sample-settlement-2');
            if (!existingIds.has(settle1Id)) {
                await db.get<AgriWeeklySettlement>('agri_weekly_settlements').create(st => {
                    st._raw.id = settle1Id;
                    st.cropCycleId = cycle2Id;
                    st.landOwnerId = landowner2Id;
                    st.weekNumber = 1;
                    st.weekStartDate = new Date(nowMinusDays(14));
                    st.weekEndDate = new Date(nowMinusDays(8));
                    st.cumulativeKilos = 10000;
                    st.ratePerKilo = 1.20;
                    st.rawKiloEarnings = 12000;
                    st.guaranteedMinimum = 6000;
                    st.targetCumulativePayout = 12000;
                    st.previousCumulativePayout = 0;
                    st.netPayoutDueThisWeek = 12000;
                    st.paymentStatus = 'paid';
                    st.disbursementDate = new Date(nowMinusDays(7));
                    st.receiptReference = 'SETTLE-2026-WK01';
                    st.calculationBreakdownJson = JSON.stringify({ formula: '10000kg * 1.20 = 12000 (exceeds min 6000)' });
                });
            }
            if (!existingIds.has(settle2Id)) {
                await db.get<AgriWeeklySettlement>('agri_weekly_settlements').create(st => {
                    st._raw.id = settle2Id;
                    st.cropCycleId = cycle2Id;
                    st.landOwnerId = landowner2Id;
                    st.weekNumber = 2;
                    st.weekStartDate = new Date(nowMinusDays(7));
                    st.weekEndDate = new Date(nowMinusDays(1));
                    st.cumulativeKilos = 17200;
                    st.ratePerKilo = 1.20;
                    st.rawKiloEarnings = 20640;
                    st.guaranteedMinimum = 12000;
                    st.targetCumulativePayout = 20640;
                    st.previousCumulativePayout = 12000;
                    st.netPayoutDueThisWeek = 8640;
                    st.paymentStatus = 'approved';
                    st.disbursementDate = null;
                    st.receiptReference = 'SETTLE-2026-WK02';
                    st.calculationBreakdownJson = JSON.stringify({ formula: 'cumulative 17200kg * 1.20 - previous 12000 = 8640' });
                });
            }

            const invLedger1Id = sampleUuid('sample-inv-ledger-1');
            const invLedger2Id = sampleUuid('sample-inv-ledger-2');
            if (!existingIds.has(invLedger1Id)) {
                await db.get<AgriInvestorLedger>('agri_investor_ledgers').create(il => {
                    il._raw.id = invLedger1Id;
                    il.investorId = investor1Id;
                    il.cropCycleId = cycle2Id;
                    il.transactionDate = new Date(nowMinusDays(60));
                    il.type = 'capital_injection';
                    il.kilosReceived = null;
                    il.pricePerKilo = null;
                    il.amount = 150000;
                    il.balanceRunning = 150000;
                    il.notes = `${SAMPLE_MARKER} Pre-harvest working capital allocation for corn inputs`;
                });
            }
            if (!existingIds.has(invLedger2Id)) {
                await db.get<AgriInvestorLedger>('agri_investor_ledgers').create(il => {
                    il._raw.id = invLedger2Id;
                    il.investorId = investor1Id;
                    il.cropCycleId = cycle2Id;
                    il.transactionDate = new Date(nowMinusDays(3));
                    il.type = 'harvest_offtake';
                    il.kilosReceived = 17200;
                    il.pricePerKilo = 16.50;
                    il.amount = 283800;
                    il.balanceRunning = 433800;
                    il.notes = `${SAMPLE_MARKER} Offtake liquidation for batch HARV-2026-001`;
                });
            }

            // 12. Enterprise Accounting & CDA General Ledger
            const buAgriId = sampleUuid('sample-bu-agri');
            const buStoreId = sampleUuid('sample-bu-store');
            const buWaterId = sampleUuid('sample-bu-water');
            const buLendingId = sampleUuid('sample-bu-lending');

            const buList = [
                { id: buAgriId, name: `${SAMPLE_MARKER} JetFarm Agri Operations`, slug: 'agri-operations', moduleId: 'agri-operations' },
                { id: buStoreId, name: `${SAMPLE_MARKER} JetFarm Agri-Store`, slug: 'agri-store', moduleId: 'agri-store' },
                { id: buWaterId, name: `${SAMPLE_MARKER} CleanWater Refilling Station`, slug: 'water-station', moduleId: 'water-station' },
                { id: buLendingId, name: `${SAMPLE_MARKER} Microfinance & Credit Services`, slug: 'microfinance', moduleId: 'lending' },
            ];

            for (const bu of buList) {
                if (!existingIds.has(bu.id)) {
                    await db.get<BusinessUnit>('business_units').create(record => {
                        record._raw.id = bu.id;
                        record.name = bu.name;
                        record.slug = bu.slug;
                        record.moduleId = bu.moduleId;
                        record.branchId = SAMPLE_BRANCH_ID;
                        record.isActive = true;
                        record.description = `${SAMPLE_MARKER} Operational business unit`;
                    });
                }
            }

            const coaSeeds = [
                { id: sampleUuid('sample-coa-1010'), code: '1010', name: 'Cash on Hand - Vault', type: 'asset', normal: 'debit', sort: 10 },
                { id: sampleUuid('sample-coa-1020'), code: '1020', name: 'Cash in Bank - Operations', type: 'asset', normal: 'debit', sort: 20 },
                { id: sampleUuid('sample-coa-1050'), code: '1050', name: 'Loans Receivable - Microfinance', type: 'asset', normal: 'debit', sort: 30 },
                { id: sampleUuid('sample-coa-1070'), code: '1070', name: 'Inventory - Agri Supplies & Produce', type: 'asset', normal: 'debit', sort: 40 },
                { id: sampleUuid('sample-coa-2010'), code: '2010', name: 'Accounts Payable - Trade Suppliers', type: 'liability', normal: 'credit', sort: 50 },
                { id: sampleUuid('sample-coa-3010'), code: '3010', name: 'Paid-Up Share Capital', type: 'equity', normal: 'credit', sort: 60 },
                { id: sampleUuid('sample-coa-4010'), code: '4010', name: 'Interest Income on Loans', type: 'income', normal: 'credit', sort: 70 },
                { id: sampleUuid('sample-coa-4020'), code: '4020', name: 'Sales Revenue - Agri Produce & Store', type: 'income', normal: 'credit', sort: 80 },
                { id: sampleUuid('sample-coa-5010'), code: '5010', name: 'Salaries & Wages Expense', type: 'expense', normal: 'debit', sort: 90 },
                { id: sampleUuid('sample-coa-5020'), code: '5020', name: 'Farm Inputs & Fertilizer Expense', type: 'expense', normal: 'debit', sort: 100 },
            ];

            for (const coa of coaSeeds) {
                if (!existingIds.has(coa.id)) {
                    await db.get<ChartOfAccount>('chart_of_accounts').create(acc => {
                        acc._raw.id = coa.id;
                        acc.code = coa.code;
                        acc.name = `${SAMPLE_MARKER} ${coa.name}`;
                        acc.accountType = coa.type;
                        acc.normalBalance = coa.normal;
                        acc.isActive = true;
                        acc.isHeader = false;
                        acc.parentCode = null;
                        acc.sortOrder = coa.sort;
                        acc.description = `${SAMPLE_MARKER} Standard CDA compliant account`;
                    });
                }
            }

            // Balanced Journal Entries (Debit === Credit)
            const je1Id = sampleUuid('sample-je-1');
            const je2Id = sampleUuid('sample-je-2');
            const je3Id = sampleUuid('sample-je-3');

            if (!existingIds.has(je1Id)) {
                await db.get<JournalEntry>('journal_entries').create(je => {
                    je._raw.id = je1Id;
                    je.entryDate = new Date(nowMinusDays(14));
                    je.referenceNumber = 'JV-2026-001';
                    je.description = `${SAMPLE_MARKER} Disbursement of livelihood loan to client`;
                    je.entryType = 'auto';
                    je.sourceTable = 'loans';
                    je.sourceId = stableId(LOAN_ID_PREFIX, 'livelihood-Sample Livelihood Client');
                    je.postedBy = 'System Auto-Post';
                    je.isPosted = true;
                    je.totalDebit = 25000;
                    je.totalCredit = 25000;
                    je.fiscalYear = 2026;
                    je.fiscalMonth = 8;
                });
            }
            if (!existingIds.has(sampleUuid('sample-jel-1-dr'))) {
                await db.get<JournalEntryLine>('journal_entry_lines').create(jel => {
                    jel._raw.id = sampleUuid('sample-jel-1-dr');
                    jel.journalEntryId = je1Id;
                    jel.accountCode = '1050';
                    jel.accountName = 'Loans Receivable - Microfinance';
                    jel.debitAmount = 25000;
                    jel.creditAmount = 0;
                    jel.description = 'Loan principal released';
                    jel.businessUnitId = buLendingId;
                });
            }
            if (!existingIds.has(sampleUuid('sample-jel-1-cr'))) {
                await db.get<JournalEntryLine>('journal_entry_lines').create(jel => {
                    jel._raw.id = sampleUuid('sample-jel-1-cr');
                    jel.journalEntryId = je1Id;
                    jel.accountCode = '1020';
                    jel.accountName = 'Cash in Bank - Operations';
                    jel.debitAmount = 0;
                    jel.creditAmount = 25000;
                    jel.description = 'Bank transfer disbursement';
                    jel.businessUnitId = buLendingId;
                });
            }

            if (!existingIds.has(je2Id)) {
                await db.get<JournalEntry>('journal_entries').create(je => {
                    je._raw.id = je2Id;
                    je.entryDate = new Date(nowMinusDays(7));
                    je.referenceNumber = 'JV-2026-002';
                    je.description = `${SAMPLE_MARKER} Store retail POS sales remittance`;
                    je.entryType = 'auto';
                    je.sourceTable = 'marketplace_orders';
                    je.sourceId = order1Id;
                    je.postedBy = 'Cashier Terminal';
                    je.isPosted = true;
                    je.totalDebit = 3280;
                    je.totalCredit = 3280;
                    je.fiscalYear = 2026;
                    je.fiscalMonth = 8;
                });
            }
            if (!existingIds.has(sampleUuid('sample-jel-2-dr'))) {
                await db.get<JournalEntryLine>('journal_entry_lines').create(jel => {
                    jel._raw.id = sampleUuid('sample-jel-2-dr');
                    jel.journalEntryId = je2Id;
                    jel.accountCode = '1010';
                    jel.accountName = 'Cash on Hand - Vault';
                    jel.debitAmount = 3280;
                    jel.creditAmount = 0;
                    jel.description = 'Cash received from POS retail order';
                    jel.businessUnitId = buStoreId;
                });
            }
            if (!existingIds.has(sampleUuid('sample-jel-2-cr'))) {
                await db.get<JournalEntryLine>('journal_entry_lines').create(jel => {
                    jel._raw.id = sampleUuid('sample-jel-2-cr');
                    jel.journalEntryId = je2Id;
                    jel.accountCode = '4020';
                    jel.accountName = 'Sales Revenue - Agri Produce & Store';
                    jel.debitAmount = 0;
                    jel.creditAmount = 3280;
                    jel.description = 'Store retail product sales';
                    jel.businessUnitId = buStoreId;
                });
            }

            if (!existingIds.has(je3Id)) {
                await db.get<JournalEntry>('journal_entries').create(je => {
                    je._raw.id = je3Id;
                    je.entryDate = new Date(nowMinusDays(3));
                    je.referenceNumber = 'JV-2026-003';
                    je.description = `${SAMPLE_MARKER} Corn harvest delivery inventory recognition`;
                    je.entryType = 'auto';
                    je.sourceTable = 'agri_harvest_logs';
                    je.sourceId = harvest1Id;
                    je.postedBy = 'Inventory Officer';
                    je.isPosted = true;
                    je.totalDebit = 17200;
                    je.totalCredit = 17200;
                    je.fiscalYear = 2026;
                    je.fiscalMonth = 8;
                });
            }
            if (!existingIds.has(sampleUuid('sample-jel-3-dr'))) {
                await db.get<JournalEntryLine>('journal_entry_lines').create(jel => {
                    jel._raw.id = sampleUuid('sample-jel-3-dr');
                    jel.journalEntryId = je3Id;
                    jel.accountCode = '1070';
                    jel.accountName = 'Inventory - Agri Supplies & Produce';
                    jel.debitAmount = 17200;
                    jel.creditAmount = 0;
                    jel.description = 'Yellow corn harvest incoming to warehouse';
                    jel.businessUnitId = buAgriId;
                });
            }
            if (!existingIds.has(sampleUuid('sample-jel-3-cr'))) {
                await db.get<JournalEntryLine>('journal_entry_lines').create(jel => {
                    jel._raw.id = sampleUuid('sample-jel-3-cr');
                    jel.journalEntryId = je3Id;
                    jel.accountCode = '2010';
                    jel.accountName = 'Accounts Payable - Trade Suppliers';
                    jel.debitAmount = 0;
                    jel.creditAmount = 17200;
                    jel.description = 'Payable to outgrower landowner';
                    jel.businessUnitId = buAgriId;
                });
            }

            const statfund1Id = sampleUuid('sample-statfund-1');
            const statfund2Id = sampleUuid('sample-statfund-2');
            if (!existingIds.has(statfund1Id)) {
                await db.get<StatutoryFundAllocation>('statutory_fund_allocations').create(sf => {
                    sf._raw.id = statfund1Id;
                    sf.fiscalYear = 2026;
                    sf.fiscalMonth = 8;
                    sf.fundType = 'reserve';
                    sf.amount = 25000;
                    sf.percentage = 50;
                    sf.notes = `${SAMPLE_MARKER} General Reserve Fund allocation (50% CDA mandate)`;
                    sf.performedBy = 'Chief Accountant';
                });
            }
            if (!existingIds.has(statfund2Id)) {
                await db.get<StatutoryFundAllocation>('statutory_fund_allocations').create(sf => {
                    sf._raw.id = statfund2Id;
                    sf.fiscalYear = 2026;
                    sf.fiscalMonth = 8;
                    sf.fundType = 'education';
                    sf.amount = 5000;
                    sf.percentage = 10;
                    sf.notes = `${SAMPLE_MARKER} Cooperative Education and Training Fund`;
                    sf.performedBy = 'Chief Accountant';
                });
            }

            // 13. Supply Chain, Franchise, Commissary & POS
            const supp1Id = sampleUuid('sample-supplier-1');
            const supp2Id = sampleUuid('sample-supplier-2');
            if (!existingIds.has(supp1Id)) {
                await db.get<Supplier>('suppliers').create(sp => {
                    sp._raw.id = supp1Id;
                    sp.name = `${SAMPLE_MARKER} Mindanao Bio-Agri Solutions Corp`;
                    sp.contactPerson = 'Rogelio Mendoza';
                    sp.phone = '0917-333-7788';
                    sp.email = 'sales@bioagri-solutions.ph';
                    sp.address = 'Industrial Zone, General Santos City';
                    sp.tin = '234-567-890-000';
                    sp.paymentTermsDays = 30;
                    sp.isActive = true;
                });
            }
            if (!existingIds.has(supp2Id)) {
                await db.get<Supplier>('suppliers').create(sp => {
                    sp._raw.id = supp2Id;
                    sp.name = `${SAMPLE_MARKER} Pioneer Grain & Seed Corp`;
                    sp.contactPerson = 'Grace Villar';
                    sp.phone = '0928-111-4455';
                    sp.email = 'distributors@pioneer-seeds.ph';
                    sp.address = 'KM 7 Highway, Koronadal City';
                    sp.tin = '345-678-901-000';
                    sp.paymentTermsDays = 15;
                    sp.isActive = true;
                });
            }

            const voucher1Id = sampleUuid('sample-voucher-1');
            const voucher2Id = sampleUuid('sample-voucher-2');
            if (!existingIds.has(voucher1Id)) {
                await db.get<AccountsPayableVoucher>('accounts_payable_vouchers').create(apv => {
                    apv._raw.id = voucher1Id;
                    apv.supplierId = supp1Id;
                    apv.voucherNumber = 'APV-2026-001';
                    apv.invoiceNumber = 'INV-MBAS-9012';
                    apv.invoiceDate = new Date(nowMinusDays(15));
                    apv.dueDate = new Date(nowMinusDays(-15));
                    apv.description = `${SAMPLE_MARKER} Bulk Bio-Organic Complete 14-14-14 Fertilizer shipment`;
                    apv.amount = 172500;
                    apv.amountPaid = 100000;
                    apv.balance = 72500;
                    apv.status = 'partial';
                    apv.expenseAccountCode = '1070';
                    apv.moduleId = 'agri-store';
                    apv.postedBy = 'Finance Officer';
                });
            }
            if (!existingIds.has(voucher2Id)) {
                await db.get<AccountsPayableVoucher>('accounts_payable_vouchers').create(apv => {
                    apv._raw.id = voucher2Id;
                    apv.supplierId = supp2Id;
                    apv.voucherNumber = 'APV-2026-002';
                    apv.invoiceNumber = 'INV-PGSC-4411';
                    apv.invoiceDate = new Date(nowMinusDays(20));
                    apv.dueDate = new Date(nowMinusDays(-5));
                    apv.description = `${SAMPLE_MARKER} Certified Pioneer 30T80 Hybrid seeds shipment`;
                    apv.amount = 32300;
                    apv.amountPaid = 32300;
                    apv.balance = 0;
                    apv.status = 'paid';
                    apv.expenseAccountCode = '1070';
                    apv.moduleId = 'agri-store';
                    apv.postedBy = 'Finance Officer';
                });
            }

            const dispatch1Id = sampleUuid('sample-dispatch-1');
            if (!existingIds.has(dispatch1Id)) {
                await db.get<CommissaryDispatch>('commissary_dispatches').create(cd => {
                    cd._raw.id = dispatch1Id;
                    cd.fromLocation = 'Central Agri & Cold Storage Warehouse';
                    cd.toBranchId = SAMPLE_BRANCH_ID;
                    cd.dispatchNumber = 'DSP-2026-001';
                    cd.poReference = 'PO-2026-081';
                    cd.status = 'delivered';
                    cd.itemsJson = JSON.stringify([{ sku: 'AGRI-FERT-14-50K', qty: 30, uom: 'bag' }]);
                    cd.totalAmount = 43500;
                    cd.dispatchedBy = 'Warehouse Logistics Lead';
                    cd.dispatchedAt = new Date(nowMinusDays(10));
                });
            }

            const wastelog1Id = sampleUuid('sample-wastelog-1');
            if (!existingIds.has(wastelog1Id)) {
                await db.get<WasteLog>('waste_logs').create(wl => {
                    wl._raw.id = wastelog1Id;
                    wl.branchId = SAMPLE_BRANCH_ID;
                    wl.productId = prod1Id;
                    wl.productName = 'Bio-Organic Fertilizer 14-14-14 (50kg)';
                    wl.quantity = 1;
                    wl.uom = 'bag';
                    wl.reason = 'damaged';
                    wl.unitCost = 1150;
                    wl.totalCost = 1150;
                    wl.recordedBy = 'Warehouse Supervisor';
                    wl.notes = `${SAMPLE_MARKER} Torn packaging quarantine from sales return SR-2026-001`;
                    wl.photoUri = null;
                    wl.status = 'approved';
                    wl.logDate = new Date(nowMinusDays(1));
                    wl.journalEntryId = null;
                    wl.stockMovementId = null;
                });
            }

            const contract1Id = sampleUuid('sample-contract-1');
            if (!existingIds.has(contract1Id)) {
                await db.get<FranchiseContract>('franchise_contracts').create(fc => {
                    fc._raw.id = contract1Id;
                    fc.branchId = SAMPLE_BRANCH_ID;
                    fc.branchName = 'JetFarm Main Operations Hub';
                    fc.ownerName = 'Agri-Venture Partners OPC';
                    fc.ownerPhone = '0917-777-9900';
                    fc.ownerEmail = 'franchise@agriventure.ph';
                    fc.territory = 'Tacurong City & Sultan Kudarat Province';
                    fc.contractStart = new Date(nowMinusDays(180));
                    fc.contractEnd = new Date(nowMinusDays(-540));
                    fc.renewalDate = new Date(nowMinusDays(-510));
                    fc.royaltyPct = 5.0;
                    fc.franchiseFee = 250000;
                    fc.status = 'active';
                    fc.notes = `${SAMPLE_MARKER} Flagship franchise contract agreement`;
                });
            }

            const royalty1Id = sampleUuid('sample-royalty-1');
            if (!existingIds.has(royalty1Id)) {
                await db.get<RoyaltyCalculation>('royalty_calculations').create(rc => {
                    rc._raw.id = royalty1Id;
                    rc.branchId = SAMPLE_BRANCH_ID;
                    rc.periodYear = 2026;
                    rc.periodMonth = 8;
                    rc.grossSales = 450000;
                    rc.cogs = 270000;
                    rc.cogsRatio = 0.60;
                    rc.grossProfit = 180000;
                    rc.opex = 85000;
                    rc.netIncome = 95000;
                    rc.netMargin = 0.21;
                    rc.operatorShare = 76000;
                    rc.franchisorShare = 19000;
                    rc.status = 'approved';
                    rc.approvedBy = 'Auditor Santos';
                    rc.approvedAt = new Date(nowMinusDays(5));
                    rc.apVoucherId = null;
                    rc.notes = `${SAMPLE_MARKER} Month-end royalty computation`;
                });
            }

            const pos1Id = sampleUuid('sample-pos-session-1');
            if (!existingIds.has(pos1Id)) {
                await db.get<PosSession>('pos_sessions').create(ps => {
                    ps._raw.id = pos1Id;
                    ps.branchId = SAMPLE_BRANCH_ID;
                    ps.cashierId = SAMPLE_COLLECTOR_ID;
                    ps.terminalId = 'POS-TERM-01';
                    ps.openedAt = new Date(nowMinusDays(1));
                    ps.closedAt = new Date(nowMinusDays(1) + 28800000);
                    ps.openingFloat = 5000;
                    ps.closingCashExpected = 38280;
                    ps.closingCashActual = 38280;
                    ps.varianceAmount = 0;
                    ps.status = 'closed';
                    ps.notes = `${SAMPLE_MARKER} Cashier shift closed with zero float variance`;
                });
            }

            // 14. HR, Payroll & Leaves
            const leave1Id = sampleUuid('sample-leave-1');
            const leave2Id = sampleUuid('sample-leave-2');
            if (!existingIds.has(leave1Id)) {
                await db.get<EmployeeLeave>('employee_leaves').create(el => {
                    el._raw.id = leave1Id;
                    el.employeeId = emp1Id;
                    el.leaveType = 'vacation';
                    el.startDate = new Date(nowMinusDays(10));
                    el.endDate = new Date(nowMinusDays(8));
                    el.daysCount = 2;
                    el.reason = 'Family wedding in Davao';
                    el.status = 'approved';
                    el.approvedBy = 'HR Manager';
                    el.approvedAt = new Date(nowMinusDays(11));
                });
            }
            if (!existingIds.has(leave2Id)) {
                await db.get<EmployeeLeave>('employee_leaves').create(el => {
                    el._raw.id = leave2Id;
                    el.employeeId = emp2Id;
                    el.leaveType = 'sick';
                    el.startDate = new Date(nowMinusDays(20));
                    el.endDate = new Date(nowMinusDays(19));
                    el.daysCount = 1;
                    el.reason = 'Seasonal viral fever';
                    el.status = 'approved';
                    el.approvedBy = 'HR Manager';
                    el.approvedAt = new Date(nowMinusDays(20));
                });
            }

            const prun1Id = sampleUuid('sample-payrollrun-1');
            if (!existingIds.has(prun1Id)) {
                await db.get<PayrollRun>('payroll_runs').create(pr => {
                    pr._raw.id = prun1Id;
                    pr.branchId = SAMPLE_BRANCH_ID;
                    pr.periodStart = new Date(nowMinusDays(15));
                    pr.periodEnd = new Date(nowMinusDays(1));
                    pr.payDate = new Date(nowMinusDays(1));
                    pr.status = 'approved';
                    pr.totalGross = 20800;
                    pr.totalDeductions = 1670;
                    pr.totalNet = 19130;
                    pr.totalEmployerContributions = 2390;
                    pr.computedBy = 'HR Payroll Officer';
                    pr.approvedBy = 'General Manager';
                    pr.approvedAt = new Date(nowMinusDays(1));
                    pr.journalEntryId = null;
                    pr.notes = `${SAMPLE_MARKER} Semi-monthly staff payroll computation`;
                });
            }

            const pline1Id = sampleUuid('sample-payrollline-1');
            const pline2Id = sampleUuid('sample-payrollline-2');
            if (!existingIds.has(pline1Id)) {
                await db.get<PayrollLine>('payroll_lines').create(pl => {
                    pl._raw.id = pline1Id;
                    pl.payrollId = prun1Id;
                    pl.employeeId = emp1Id;
                    pl.daysWorked = 13;
                    pl.basicPay = 9750;
                    pl.overtimeHours = 0;
                    pl.overtimePay = 0;
                    pl.holidayPay = 0;
                    pl.tlAllowance = 0;
                    pl.thirteenthMonth = 0;
                    pl.otherEarnings = 0;
                    pl.grossPay = 9750;
                    pl.sssEe = 450;
                    pl.philhealthEe = 243.75;
                    pl.pagibigEe = 100;
                    pl.withholdingTax = 0;
                    pl.otherDeductions = 0;
                    pl.totalDeductions = 793.75;
                    pl.netPay = 8956.25;
                    pl.sssEr = 900;
                    pl.philhealthEr = 243.75;
                    pl.pagibigEr = 100;
                });
            }
            if (!existingIds.has(pline2Id)) {
                await db.get<PayrollLine>('payroll_lines').create(pl => {
                    pl._raw.id = pline2Id;
                    pl.payrollId = prun1Id;
                    pl.employeeId = emp2Id;
                    pl.daysWorked = 13;
                    pl.basicPay = 11050;
                    pl.overtimeHours = 0;
                    pl.overtimePay = 0;
                    pl.holidayPay = 0;
                    pl.tlAllowance = 0;
                    pl.thirteenthMonth = 0;
                    pl.otherEarnings = 0;
                    pl.grossPay = 11050;
                    pl.sssEe = 500;
                    pl.philhealthEe = 276.25;
                    pl.pagibigEe = 100;
                    pl.withholdingTax = 0;
                    pl.otherDeductions = 0;
                    pl.totalDeductions = 876.25;
                    pl.netPay = 10173.75;
                    pl.sssEr = 1000;
                    pl.philhealthEr = 276.25;
                    pl.pagibigEr = 100;
                });
            }

            // 15. Member Capital & Credit Pipeline
            const sharecap1Id = sampleUuid('sample-sharecap-1');
            const sharecap2Id = sampleUuid('sample-sharecap-2');
            if (!existingIds.has(sharecap1Id)) {
                await db.get<ShareCapitalTransaction>('share_capital_transactions').create(sc => {
                    sc._raw.id = sharecap1Id;
                    sc.memberId = standardBorrowerId;
                    sc.transactionType = 'subscription';
                    sc.shareType = 'common';
                    sc.numberOfShares = 100;
                    sc.parValue = 100;
                    sc.amount = 10000;
                    sc.runningBalanceShares = 100;
                    sc.runningBalanceAmount = 10000;
                    sc.referenceNumber = 'SC-2026-001';
                    sc.transactionDate = nowMinusDays(180);
                    sc.notes = `${SAMPLE_MARKER} Initial membership paid-up share capital`;
                    sc.recordedBy = 'sample-data';
                });
            }
            if (!existingIds.has(sharecap2Id)) {
                await db.get<ShareCapitalTransaction>('share_capital_transactions').create(sc => {
                    sc._raw.id = sharecap2Id;
                    sc.memberId = livelihoodBorrowerId;
                    sc.transactionType = 'subscription';
                    sc.shareType = 'common';
                    sc.numberOfShares = 50;
                    sc.parValue = 100;
                    sc.amount = 5000;
                    sc.runningBalanceShares = 50;
                    sc.runningBalanceAmount = 5000;
                    sc.referenceNumber = 'SC-2026-002';
                    sc.transactionDate = nowMinusDays(120);
                    sc.notes = `${SAMPLE_MARKER} Membership share capital subscription`;
                    sc.recordedBy = 'sample-data';
                });
            }

            const sav1Id = sampleUuid('sample-savingstx-1');
            const sav2Id = sampleUuid('sample-savingstx-2');
            if (!existingIds.has(sav1Id)) {
                await db.get<SavingsTransaction>('savings_transactions').create(st => {
                    st._raw.id = sav1Id;
                    st.borrowerId = standardBorrowerId;
                    st.type = 'deposit';
                    st.amount = 2500;
                    st.referenceId = 'SAV-REC-001';
                    st.date = nowMinusDays(30);
                    st.notes = `${SAMPLE_MARKER} Regular voluntary savings deposit`;
                });
            }
            if (!existingIds.has(sav2Id)) {
                await db.get<SavingsTransaction>('savings_transactions').create(st => {
                    st._raw.id = sav2Id;
                    st.borrowerId = livelihoodBorrowerId;
                    st.type = 'deposit';
                    st.amount = 1500;
                    st.referenceId = 'SAV-REC-002';
                    st.date = nowMinusDays(25);
                    st.notes = `${SAMPLE_MARKER} Regular voluntary savings deposit`;
                });
            }

            const loanapp1Id = sampleUuid('sample-loanapp-1');
            const loanapp2Id = sampleUuid('sample-loanapp-2');
            if (!existingIds.has(loanapp1Id)) {
                await db.get<LoanApplication>('loan_applications').create(la => {
                    la._raw.id = loanapp1Id;
                    la.borrowerId = standardBorrowerId;
                    la.productId = 'standard';
                    la.amountApplied = 30000;
                    la.amountApproved = 30000;
                    la.purpose = 'Cassava plantation high-yield seed expansion';
                    la.applicationDate = nowMinusDays(30);
                    la.status = 'approved';
                    la.approvedBy = 'Credit Committee';
                    la.approvedAt = nowMinusDays(25);
                    la.notes = `${SAMPLE_MARKER} Approved based on solid farm track record`;
                });
            }
            if (!existingIds.has(loanapp2Id)) {
                await db.get<LoanApplication>('loan_applications').create(la => {
                    la._raw.id = loanapp2Id;
                    la.borrowerId = livelihoodBorrowerId;
                    la.productId = 'livelihood';
                    la.amountApplied = 15000;
                    la.amountApproved = null;
                    la.purpose = 'Sari-sari store grocery inventory replenishment';
                    la.applicationDate = nowMinusDays(5);
                    la.status = 'pending';
                    la.approvedBy = null;
                    la.approvedAt = null;
                    la.notes = `${SAMPLE_MARKER} Under field credit investigation`;
                });
            }

            const guar1Id = sampleUuid('sample-guarantor-1');
            const guar2Id = sampleUuid('sample-guarantor-2');
            if (!existingIds.has(guar1Id)) {
                await db.get<Guarantor>('guarantors').create(g => {
                    g._raw.id = guar1Id;
                    g.applicationId = loanapp1Id;
                    g.loanId = null;
                    g.guarantorName = 'Pedro Penduko';
                    g.contactNo = '0917-444-8899';
                    g.relationship = 'Co-maker / Brother-in-law';
                    g.memberId = standardBorrowerId;
                });
            }
            if (!existingIds.has(guar2Id)) {
                await db.get<Guarantor>('guarantors').create(g => {
                    g._raw.id = guar2Id;
                    g.applicationId = loanapp2Id;
                    g.loanId = null;
                    g.guarantorName = 'Juan Dela Cruz';
                    g.contactNo = '0928-333-2211';
                    g.relationship = 'Co-maker / Barangay Councilman';
                    g.memberId = livelihoodBorrowerId;
                });
            }
        });
    }

    static async disable(db: Database = globalDatabase) {
        const records = await this.fetchAllSampleRecords(db);
        const timestamp = Date.now();
        await db.write(async () => {
            for (const record of records as any[]) {
                if (record.deletedAt) continue;
                await record.update((r: any) => {
                    r.deletedAt = timestamp;
                });
            }
        });
    }

    static async restore(db: Database = globalDatabase) {
        const records = await this.fetchAllSampleRecords(db);
        await db.write(async () => {
            for (const record of records as any[]) {
                await record.update((r: any) => {
                    r.deletedAt = null;
                });
            }
        });
    }

    static async purge(db: Database = globalDatabase) {
        const records = await this.fetchAllSampleRecords(db);
        await db.write(async () => {
            for (const record of records as any[]) {
                await record.destroyPermanently();
            }
        });
    }

    private static async fetchAllSampleRecords(db: Database) {
        const results = await Promise.all(
            SampleDataService.sampleTables.map(table => this.fetchSampleRecords(db, table))
        );

        return results.flat();
    }

    /**
     * One-time repair for the pre-UUID demo-id scheme (2026-10-08).
     *
     * Devices that enabled sample data before sample ids became real UUIDs carry
     * local records with readable ids ("sample-area-poblacion", ...). Remote
     * tables with `id UUID PRIMARY KEY` reject them (PostgREST 22P02), which
     * fails the whole table push on EVERY sync and also blocks real records
     * batched in the same table. Real records are always UUID v4 (see
     * database/index.ts), so any id starting with "sample-" is legacy demo
     * data by definition and safe to destroy locally. Rows that never pushed
     * successfully exist only on the device, so destroyPermanently (no sync
     * tombstone) is exactly right.
     */
    static async purgeLegacyReadableIds(db: Database = globalDatabase): Promise<number> {
        let purged = 0;
        for (const table of SampleDataService.sampleTables) {
            if (!db || typeof (db as any).get !== 'function') continue;
            const collection = db.get<any>(table);
            if (!collection || typeof (collection as any).query !== 'function') continue;
            const rows = await collection.query().fetch() as any[];
            const legacy = rows.filter(record => typeof record.id === 'string' && record.id.startsWith('sample-'));
            if (legacy.length === 0) continue;
            await db.write(async () => {
                for (const record of legacy) {
                    await record.destroyPermanently();
                    purged++;
                }
            });
        }
        if (purged > 0) {
            console.log(`[SampleDataService] Purged ${purged} legacy readable-id sample record(s)`);
        }
        return purged;
    }

    private static readonly sampleTables = [
        'borrowers', 'loans', 'expenses', 'file_cases',
        'payments', 'agri_parcels', 'agri_crop_cycles', 'agri_farm_workers',
        'agri_harvest_logs', 'marketplace_stores', 'marketplace_products',
        'sales_returns', 'ws_customers', 'ws_deliveries', 'bank_accounts',
        'employees', 'marketplace_categories', 'branches', 'warehouses',
        'stock_movements', 'marketplace_orders', 'marketplace_sub_orders',
        'marketplace_order_items', 'sales_return_lines', 'ws_containers',
        'ws_payments', 'ws_expenses', 'cash_transactions', 'agri_labor_logs',
        'agri_farm_expenses', 'collectors', 'areas', 'payment_schedules',
        'agri_land_owners', 'agri_investors', 'agri_weekly_settlements',
        'agri_growth_checkins', 'agri_investor_ledgers', 'business_units',
        'chart_of_accounts', 'journal_entries', 'journal_entry_lines',
        'statutory_fund_allocations', 'suppliers', 'accounts_payable_vouchers',
        'commissary_dispatches', 'waste_logs', 'franchise_contracts',
        'royalty_calculations', 'pos_sessions', 'payroll_runs', 'payroll_lines',
        'employee_leaves', 'share_capital_transactions', 'savings_transactions',
        'loan_applications', 'guarantors'
    ];

    private static async fetchSampleRecords<T>(db: Database, table: string): Promise<T[]> {
        const ids = this.sampleIdsForTable(table);
        if (ids.length === 0) return [];
        if (!db || typeof (db as any).get !== 'function') return [];
        const collection = db.get<T & any>(table);
        if (!collection || typeof (collection as any).query !== 'function') return [];
        return await collection.query(Q.where('id', Q.oneOf(ids))).fetch() as T[];
    }

    private static sampleIdsForTable(table: string): string[] {
        if (table === 'collectors') return [SAMPLE_COLLECTOR_ID];
        if (table === 'areas') return [SAMPLE_AREA_ID];
        if (table === 'borrowers') return LOAN_SEEDS.map(seed => stableId(BORROWER_ID_PREFIX, seed.borrowerName));
        if (table === 'loans') return LOAN_SEEDS.map(seed => stableId(LOAN_ID_PREFIX, `${seed.type}-${seed.borrowerName}`));
        if (table === 'payment_schedules') {
            return LOAN_SEEDS.filter(s => s.status === 'active').flatMap(s => {
                const loanId = stableId(LOAN_ID_PREFIX, `${s.type}-${s.borrowerName}`);
                return [`sample-sched-${loanId}-1`, `sample-sched-${loanId}-2`].map(sampleUuid);
            });
        }
        if (table === 'payments') {
            return LOAN_SEEDS.filter(s => s.status === 'active').map(s => {
                const loanId = stableId(LOAN_ID_PREFIX, `${s.type}-${s.borrowerName}`);
                return sampleUuid(`sample-pay-${loanId}-1`);
            });
        }
        if (table === 'expenses') return EXPENSE_SEEDS.map((_, index) => sampleUuid(`${EXPENSE_ID_PREFIX}${index + 1}`));
        if (table === 'file_cases') return [sampleUuid(`${FILE_CASE_ID_PREFIX}delinquent`)];

        if (table === 'agri_parcels') return ['sample-parcel-1', 'sample-parcel-2'].map(sampleUuid);
        if (table === 'agri_crop_cycles') return ['sample-cycle-1', 'sample-cycle-2'].map(sampleUuid);
        if (table === 'agri_farm_workers') return ['sample-worker-1', 'sample-worker-2'].map(sampleUuid);
        if (table === 'agri_farm_expenses') return ['sample-agri-exp-1', 'sample-agri-exp-2'].map(sampleUuid);
        if (table === 'agri_labor_logs') return ['sample-labor-1'].map(sampleUuid);
        if (table === 'agri_harvest_logs') return ['sample-harvest-1'].map(sampleUuid);
        if (table === 'agri_land_owners') return ['sample-landowner-1', 'sample-landowner-2'].map(sampleUuid);
        if (table === 'agri_investors') return ['sample-investor-1', 'sample-investor-2'].map(sampleUuid);
        if (table === 'agri_weekly_settlements') return ['sample-settlement-1', 'sample-settlement-2'].map(sampleUuid);
        if (table === 'agri_growth_checkins') return ['sample-checkin-1', 'sample-checkin-2'].map(sampleUuid);
        if (table === 'agri_investor_ledgers') return ['sample-inv-ledger-1', 'sample-inv-ledger-2'].map(sampleUuid);

        if (table === 'business_units') return ['sample-bu-agri', 'sample-bu-store', 'sample-bu-water', 'sample-bu-lending'].map(sampleUuid);
        if (table === 'chart_of_accounts') return [
            'sample-coa-1010', 'sample-coa-1020', 'sample-coa-1050', 'sample-coa-1070',
            'sample-coa-2010', 'sample-coa-3010', 'sample-coa-4010', 'sample-coa-4020',
            'sample-coa-5010', 'sample-coa-5020'
        ].map(sampleUuid);
        if (table === 'journal_entries') return ['sample-je-1', 'sample-je-2', 'sample-je-3'].map(sampleUuid);
        if (table === 'journal_entry_lines') return [
            'sample-jel-1-dr', 'sample-jel-1-cr',
            'sample-jel-2-dr', 'sample-jel-2-cr',
            'sample-jel-3-dr', 'sample-jel-3-cr'
        ].map(sampleUuid);
        if (table === 'statutory_fund_allocations') return ['sample-statfund-1', 'sample-statfund-2'].map(sampleUuid);

        if (table === 'branches') return [SAMPLE_BRANCH_ID];
        if (table === 'warehouses') return [SAMPLE_WAREHOUSE_ID];
        if (table === 'marketplace_stores') return [SAMPLE_STORE_ID];
        if (table === 'marketplace_categories') return ['sample-cat-fert', 'sample-cat-seeds', 'sample-cat-produce'].map(sampleUuid);
        if (table === 'marketplace_products') return ['sample-prod-1', 'sample-prod-2', 'sample-prod-3'].map(sampleUuid);
        if (table === 'stock_movements') return ['sample-stock-1', 'sample-stock-2'].map(sampleUuid);
        if (table === 'marketplace_orders') return ['sample-order-1'].map(sampleUuid);
        if (table === 'marketplace_sub_orders') return ['sample-suborder-1'].map(sampleUuid);
        if (table === 'marketplace_order_items') return ['sample-orderitem-1', 'sample-orderitem-2'].map(sampleUuid);
        if (table === 'sales_returns') return ['sample-return-1'].map(sampleUuid);
        if (table === 'sales_return_lines') return ['sample-retline-1'].map(sampleUuid);

        if (table === 'suppliers') return ['sample-supplier-1', 'sample-supplier-2'].map(sampleUuid);
        if (table === 'accounts_payable_vouchers') return ['sample-voucher-1', 'sample-voucher-2'].map(sampleUuid);
        if (table === 'commissary_dispatches') return ['sample-dispatch-1'].map(sampleUuid);
        if (table === 'waste_logs') return ['sample-wastelog-1'].map(sampleUuid);
        if (table === 'franchise_contracts') return ['sample-contract-1'].map(sampleUuid);
        if (table === 'royalty_calculations') return ['sample-royalty-1'].map(sampleUuid);
        if (table === 'pos_sessions') return ['sample-pos-session-1'].map(sampleUuid);

        if (table === 'ws_customers') return ['sample-wscust-1', 'sample-wscust-2'].map(sampleUuid);
        if (table === 'ws_containers') return ['sample-wscont-1', 'sample-wscont-2'].map(sampleUuid);
        if (table === 'ws_deliveries') return ['sample-wsdel-1', 'sample-wsdel-2'].map(sampleUuid);
        if (table === 'ws_payments') return ['sample-wspay-1'].map(sampleUuid);
        if (table === 'ws_expenses') return ['sample-wsexp-1'].map(sampleUuid);

        if (table === 'bank_accounts') return ['sample-bank-1', 'sample-bank-2'].map(sampleUuid);
        if (table === 'cash_transactions') return ['sample-cashtx-1'].map(sampleUuid);
        if (table === 'employees') return ['sample-emp-1', 'sample-emp-2'].map(sampleUuid);
        if (table === 'payroll_runs') return ['sample-payrollrun-1'].map(sampleUuid);
        if (table === 'payroll_lines') return ['sample-payrollline-1', 'sample-payrollline-2'].map(sampleUuid);
        if (table === 'employee_leaves') return ['sample-leave-1', 'sample-leave-2'].map(sampleUuid);

        if (table === 'share_capital_transactions') return ['sample-sharecap-1', 'sample-sharecap-2'].map(sampleUuid);
        if (table === 'savings_transactions') return ['sample-savingstx-1', 'sample-savingstx-2'].map(sampleUuid);
        if (table === 'loan_applications') return ['sample-loanapp-1', 'sample-loanapp-2'].map(sampleUuid);
        if (table === 'guarantors') return ['sample-guarantor-1', 'sample-guarantor-2'].map(sampleUuid);

        return [];
    }
}

export default SampleDataService;
