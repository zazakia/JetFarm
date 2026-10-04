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
import { LOAN_PRODUCT_PRESETS, LoanProductType } from '../utils/loanProducts';

const SAMPLE_MARKER = '[sample-data]';
const SAMPLE_COLLECTOR_ID = 'sample-collector-main';
const SAMPLE_AREA_ID = 'sample-area-poblacion';
const SAMPLE_BRANCH_ID = 'sample-branch-main';
const SAMPLE_WAREHOUSE_ID = 'sample-warehouse-main';
const SAMPLE_STORE_ID = 'sample-store-agri';

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
        marketplaceProducts: number;
        marketplaceStores: number;
        salesReturns: number;
        waterCustomers: number;
        waterDeliveries: number;
        bankAccounts: number;
        employees: number;
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

function stableId(prefix: string, value: string) {
    return `${prefix}${value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
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
            laborLogs, agriExpenses, collectors, areas, schedules
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
        ]);

        const all = [
            ...borrowers, ...loans, ...expenses, ...fileCases,
            ...payments, ...agriParcels, ...agriCycles, ...agriWorkers, ...agriHarvests,
            ...stores, ...products, ...salesReturns,
            ...waterCustomers, ...waterDeliveries, ...bankAccounts, ...employees,
            ...categories, ...branches, ...warehouses, ...stockMovements,
            ...orders, ...subOrders, ...orderItems, ...returnLines,
            ...containers, ...waterPayments, ...waterExpenses, ...cashTxns,
            ...laborLogs, ...agriExpenses, ...collectors, ...areas, ...schedules
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
                marketplaceProducts: products.length,
                marketplaceStores: stores.length,
                salesReturns: salesReturns.length,
                waterCustomers: waterCustomers.length,
                waterDeliveries: waterDeliveries.length,
                bankAccounts: bankAccounts.length,
                employees: employees.length,
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
                        const sched1Id = `sample-sched-${loanId}-1`;
                        const sched2Id = `sample-sched-${loanId}-2`;
                        const pay1Id = `sample-pay-${loanId}-1`;

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
                const id = `${EXPENSE_ID_PREFIX}${index + 1}`;
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
            if (!existingIds.has(`${FILE_CASE_ID_PREFIX}delinquent`)) {
                await db.get<FileCase>('file_cases').create(record => {
                    record._raw.id = `${FILE_CASE_ID_PREFIX}delinquent`;
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

            const parcel1Id = 'sample-parcel-1';
            const parcel2Id = 'sample-parcel-2';
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

            const cycle1Id = 'sample-cycle-1';
            const cycle2Id = 'sample-cycle-2';
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

            const worker1Id = 'sample-worker-1';
            const worker2Id = 'sample-worker-2';
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

            const agriExp1Id = 'sample-agri-exp-1';
            const agriExp2Id = 'sample-agri-exp-2';
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

            const labor1Id = 'sample-labor-1';
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

            const harvest1Id = 'sample-harvest-1';
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

            const cat1Id = 'sample-cat-fert';
            const cat2Id = 'sample-cat-seeds';
            const cat3Id = 'sample-cat-produce';
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

            const prod1Id = 'sample-prod-1';
            const prod2Id = 'sample-prod-2';
            const prod3Id = 'sample-prod-3';
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

            const stock1Id = 'sample-stock-1';
            const stock2Id = 'sample-stock-2';
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

            const order1Id = 'sample-order-1';
            const subOrder1Id = 'sample-suborder-1';
            const orderItem1Id = 'sample-orderitem-1';
            const orderItem2Id = 'sample-orderitem-2';

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
            const return1Id = 'sample-return-1';
            const retLine1Id = 'sample-retline-1';
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
            const wsCust1Id = 'sample-wscust-1';
            const wsCust2Id = 'sample-wscust-2';
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

            const wsCont1Id = 'sample-wscont-1';
            const wsCont2Id = 'sample-wscont-2';
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

            const wsDel1Id = 'sample-wsdel-1';
            const wsDel2Id = 'sample-wsdel-2';
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

            const wsPay1Id = 'sample-wspay-1';
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

            const wsExp1Id = 'sample-wsexp-1';
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
            const bank1Id = 'sample-bank-1';
            const bank2Id = 'sample-bank-2';
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

            const cashTx1Id = 'sample-cashtx-1';
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
            const emp1Id = 'sample-emp-1';
            const emp2Id = 'sample-emp-2';
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
        const tables = [
            'borrowers', 'loans', 'expenses', 'file_cases',
            'payments', 'agri_parcels', 'agri_crop_cycles', 'agri_farm_workers',
            'agri_harvest_logs', 'marketplace_stores', 'marketplace_products',
            'sales_returns', 'ws_customers', 'ws_deliveries', 'bank_accounts',
            'employees', 'marketplace_categories', 'branches', 'warehouses',
            'stock_movements', 'marketplace_orders', 'marketplace_sub_orders',
            'marketplace_order_items', 'sales_return_lines', 'ws_containers',
            'ws_payments', 'ws_expenses', 'cash_transactions', 'agri_labor_logs',
            'agri_farm_expenses', 'collectors', 'areas', 'payment_schedules'
        ];

        const results = await Promise.all(
            tables.map(table => this.fetchSampleRecords(db, table))
        );

        return results.flat();
    }

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
                return [`sample-sched-${loanId}-1`, `sample-sched-${loanId}-2`];
            });
        }
        if (table === 'payments') {
            return LOAN_SEEDS.filter(s => s.status === 'active').map(s => {
                const loanId = stableId(LOAN_ID_PREFIX, `${s.type}-${s.borrowerName}`);
                return `sample-pay-${loanId}-1`;
            });
        }
        if (table === 'expenses') return EXPENSE_SEEDS.map((_, index) => `${EXPENSE_ID_PREFIX}${index + 1}`);
        if (table === 'file_cases') return [`${FILE_CASE_ID_PREFIX}delinquent`];

        if (table === 'agri_parcels') return ['sample-parcel-1', 'sample-parcel-2'];
        if (table === 'agri_crop_cycles') return ['sample-cycle-1', 'sample-cycle-2'];
        if (table === 'agri_farm_workers') return ['sample-worker-1', 'sample-worker-2'];
        if (table === 'agri_farm_expenses') return ['sample-agri-exp-1', 'sample-agri-exp-2'];
        if (table === 'agri_labor_logs') return ['sample-labor-1'];
        if (table === 'agri_harvest_logs') return ['sample-harvest-1'];

        if (table === 'branches') return [SAMPLE_BRANCH_ID];
        if (table === 'warehouses') return [SAMPLE_WAREHOUSE_ID];
        if (table === 'marketplace_stores') return [SAMPLE_STORE_ID];
        if (table === 'marketplace_categories') return ['sample-cat-fert', 'sample-cat-seeds', 'sample-cat-produce'];
        if (table === 'marketplace_products') return ['sample-prod-1', 'sample-prod-2', 'sample-prod-3'];
        if (table === 'stock_movements') return ['sample-stock-1', 'sample-stock-2'];
        if (table === 'marketplace_orders') return ['sample-order-1'];
        if (table === 'marketplace_sub_orders') return ['sample-suborder-1'];
        if (table === 'marketplace_order_items') return ['sample-orderitem-1', 'sample-orderitem-2'];
        if (table === 'sales_returns') return ['sample-return-1'];
        if (table === 'sales_return_lines') return ['sample-retline-1'];

        if (table === 'ws_customers') return ['sample-wscust-1', 'sample-wscust-2'];
        if (table === 'ws_containers') return ['sample-wscont-1', 'sample-wscont-2'];
        if (table === 'ws_deliveries') return ['sample-wsdel-1', 'sample-wsdel-2'];
        if (table === 'ws_payments') return ['sample-wspay-1'];
        if (table === 'ws_expenses') return ['sample-wsexp-1'];

        if (table === 'bank_accounts') return ['sample-bank-1', 'sample-bank-2'];
        if (table === 'cash_transactions') return ['sample-cashtx-1'];
        if (table === 'employees') return ['sample-emp-1', 'sample-emp-2'];

        return [];
    }
}

export default SampleDataService;
