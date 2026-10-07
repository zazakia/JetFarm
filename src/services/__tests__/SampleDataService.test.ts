import { Database, Q } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import Loan from '../../database/models/Loan';
import Expense from '../../database/models/Expense';
import FileCase from '../../database/models/FileCase';
import AgriParcel from '../../database/models/AgriParcel';
import AgriCropCycle from '../../database/models/AgriCropCycle';
import MarketplaceProduct from '../../database/models/MarketplaceProduct';
import SalesReturn from '../../database/models/SalesReturn';
import WsCustomer from '../../database/models/WsCustomer';
import BankAccount from '../../database/models/BankAccount';
import Employee from '../../database/models/Employee';
import { SampleDataService, sampleUuid } from '../SampleDataService';
import { LOAN_PRODUCT_PRESETS } from '../../utils/loanProducts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Every remote table SyncService pushes sample records into (app_areas,
// app_borrowers, ws_customers, employees, ...) declares `id UUID PRIMARY KEY`.
// PostgREST rejects readable ids like "sample-area-poblacion" with 22P02, which
// fails the whole table push and blocks real records in the same batch.
const SAMPLE_TABLES = [
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
    'loan_applications', 'guarantors',
];

describe('SampleDataService', () => {
    let database: Database;

    beforeEach(() => {
        database = createTestDatabase();
    });

    afterEach(async () => {
        await closeTestDatabase(database);
    });

    it('seeds one sample loan for every loan product type', async () => {
        await SampleDataService.enable(database);

        const loans = await database.get<Loan>('loans').query(
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
        const seededTypes = new Set(loans.map(loan => loan.loanType));

        expect(seededTypes).toEqual(new Set(Object.keys(LOAN_PRODUCT_PRESETS)));
        expect(loans.some(loan => loan.status === 'pending')).toBe(true);
        expect(loans.some(loan => loan.loanType === 'petty_cash')).toBe(true);
        expect(loans.some(loan => loan.loanType === 'livelihood')).toBe(true);
        expect(loans.some(loan => loan.isDelinquent && loan.status === 'defaulted')).toBe(true);
    });

    it('adds sample records for expenses and file cases', async () => {
        await SampleDataService.enable(database);

        const expenses = await database.get<Expense>('expenses').query(
            Q.where('deleted_at', Q.eq(null))
        ).fetch();
        const fileCases = await database.get<FileCase>('file_cases').query(
            Q.where('deleted_at', Q.eq(null))
        ).fetch();

        expect(expenses).toHaveLength(3);
        expect(expenses.every(expense => expense.description.includes(SampleDataService.marker))).toBe(true);
        expect(fileCases).toHaveLength(1);
        expect(fileCases[0].status).toBe('open');
    });

    it('seeds mock data across all modules (Agribusiness, Marketplace, Water Station, Banking, Employees, Accounting, Supply Chain, POS, Payroll, Credit Pipeline)', async () => {
        await SampleDataService.enable(database);

        const parcels = await database.get<AgriParcel>('agri_parcels').query(Q.where('deleted_at', null)).fetch();
        const cycles = await database.get<AgriCropCycle>('agri_crop_cycles').query(Q.where('deleted_at', null)).fetch();
        const landowners = await database.get('agri_land_owners').query(Q.where('deleted_at', null)).fetch();
        const investors = await database.get('agri_investors').query(Q.where('deleted_at', null)).fetch();
        const settlements = await database.get('agri_weekly_settlements').query(Q.where('deleted_at', null)).fetch();
        const checkins = await database.get('agri_growth_checkins').query(Q.where('deleted_at', null)).fetch();
        const products = await database.get<MarketplaceProduct>('marketplace_products').query(Q.where('deleted_at', null)).fetch();
        const returns = await database.get<SalesReturn>('sales_returns').query(Q.where('deleted_at', null)).fetch();
        const wsCustomers = await database.get<WsCustomer>('ws_customers').query(Q.where('deleted_at', null)).fetch();
        const banks = await database.get<BankAccount>('bank_accounts').query(Q.where('deleted_at', null)).fetch();
        const employees = await database.get<Employee>('employees').query(Q.where('deleted_at', null)).fetch();
        const coa = await database.get('chart_of_accounts').query(Q.where('deleted_at', null)).fetch();
        const jes = await database.get('journal_entries').query(Q.where('deleted_at', null)).fetch();
        const vouchers = await database.get('accounts_payable_vouchers').query(Q.where('deleted_at', null)).fetch();
        const payrollRuns = await database.get('payroll_runs').query(Q.where('deleted_at', null)).fetch();
        const loanApps = await database.get('loan_applications').query(Q.where('deleted_at', null)).fetch();
        const shareCaps = await database.get('share_capital_transactions').query(Q.where('deleted_at', null)).fetch();
        const savings = await database.get('savings_transactions').query(Q.where('deleted_at', null)).fetch();

        expect(parcels.length).toBeGreaterThanOrEqual(2);
        expect(cycles.length).toBeGreaterThanOrEqual(2);
        expect(landowners.length).toBeGreaterThanOrEqual(2);
        expect(investors.length).toBeGreaterThanOrEqual(2);
        expect(settlements.length).toBeGreaterThanOrEqual(2);
        expect(checkins.length).toBeGreaterThanOrEqual(2);
        expect(products.length).toBeGreaterThanOrEqual(3);
        expect(returns.length).toBeGreaterThanOrEqual(1);
        expect(returns[0].status).toBe('completed');
        expect(wsCustomers.length).toBeGreaterThanOrEqual(2);
        expect(banks.length).toBeGreaterThanOrEqual(2);
        expect(employees.length).toBeGreaterThanOrEqual(2);
        expect(coa.length).toBeGreaterThanOrEqual(10);
        expect(jes.length).toBeGreaterThanOrEqual(3);
        // Verify double-entry balance: totalDebit === totalCredit
        for (const je of jes as any[]) {
            expect(je.totalDebit).toBe(je.totalCredit);
            expect(je.totalDebit).toBeGreaterThan(0);
        }
        expect(vouchers.length).toBeGreaterThanOrEqual(2);
        expect(payrollRuns.length).toBeGreaterThanOrEqual(1);
        expect(loanApps.length).toBeGreaterThanOrEqual(2);
        expect(shareCaps.length).toBeGreaterThanOrEqual(2);
        expect(savings.length).toBeGreaterThanOrEqual(2);
    });

    it('can hide, restore, and purge sample data without touching unrelated loans', async () => {
        await database.write(async () => {
            await database.get<Loan>('loans').create(loan => {
                loan.loanNumber = 'REAL-001';
                loan.borrowerId = 'real-borrower';
                loan.principalAmount = 1000;
                loan.interestRate = 10;
                loan.interestType = 'flat';
                loan.term = 1;
                loan.termUnit = 'months';
                loan.frequency = 'monthly';
                loan.totalAmount = 1100;
                loan.installmentAmount = 1100;
                loan.status = 'active';
            });
        });

        await SampleDataService.enable(database);
        await SampleDataService.disable(database);

        let status = await SampleDataService.getStatus(database);
        const realLoan = await database.get<Loan>('loans').query(Q.where('loan_number', 'REAL-001')).fetch();
        expect(status.enabled).toBe(false);
        expect(status.deleted).toBeGreaterThan(0);
        expect(realLoan[0].deletedAt).toBeFalsy();

        await SampleDataService.restore(database);
        status = await SampleDataService.getStatus(database);
        expect(status.enabled).toBe(true);

        await SampleDataService.purge(database);
        status = await SampleDataService.getStatus(database);
        expect(status.active).toBe(0);
        expect(status.deleted).toBe(0);

        const remainingRealLoans = await database.get<Loan>('loans').query(Q.where('loan_number', 'REAL-001')).fetch();
        expect(remainingRealLoans).toHaveLength(1);
    });

    it('returns an empty status when the database is unavailable during logout teardown', async () => {
        const dbWithMissingCollection = {
            get: jest.fn(() => null),
        } as unknown as Database;

        await expect(SampleDataService.getStatus(dbWithMissingCollection)).resolves.toEqual({
            enabled: false,
            active: 0,
            deleted: 0,
            totals: {
                borrowers: 0,
                loans: 0,
                expenses: 0,
                fileCases: 0,
                payments: 0,
                agriParcels: 0,
                agriCropCycles: 0,
                agriFarmWorkers: 0,
                agriHarvestLogs: 0,
                agriLandOwners: 0,
                agriInvestors: 0,
                agriWeeklySettlements: 0,
                agriGrowthCheckins: 0,
                marketplaceProducts: 0,
                marketplaceStores: 0,
                salesReturns: 0,
                waterCustomers: 0,
                waterDeliveries: 0,
                bankAccounts: 0,
                employees: 0,
                chartOfAccounts: 0,
                journalEntries: 0,
                suppliers: 0,
                accountsPayableVouchers: 0,
                payrollRuns: 0,
                loanApplications: 0,
                shareCapitalTransactions: 0,
                savingsTransactions: 0,
            },
        });
    });

    describe('sync-safe uuid sample ids', () => {
        it('assigns a valid uuid id to every seeded sample record', async () => {
            await SampleDataService.enable(database);

            const offenders: string[] = [];
            for (const table of SAMPLE_TABLES) {
                const rows = await database.get(table as any).query().fetch();
                for (const row of rows as any[]) {
                    if (!UUID_RE.test(row.id)) {
                        offenders.push(`${table}:${row.id}`);
                    }
                }
            }
            expect(offenders).toEqual([]);
        });

        it('keeps sample cross-references uuid-formatted and resolvable', async () => {
            await SampleDataService.enable(database);

            const loans = await database.get<Loan>('loans').query().fetch();
            expect(loans.length).toBeGreaterThan(0);
            for (const loan of loans as any[]) {
                expect(loan.borrowerId).toEqual(expect.stringMatching(UUID_RE));
                const borrower = await database.get('borrowers').find(loan.borrowerId);
                expect(borrower).toBeTruthy();
            }

            const deliveries = await database.get('ws_deliveries').query().fetch();
            for (const delivery of deliveries as any[]) {
                expect(delivery.customerId).toEqual(expect.stringMatching(UUID_RE));
                const customer = await database.get('ws_customers').find(delivery.customerId);
                expect(customer).toBeTruthy();
            }
        });

        it('sampleUuid is deterministic, uuid-formatted, and collision-free per key', () => {
            const a = sampleUuid('sample-area-poblacion');
            const b = sampleUuid('sample-area-poblacion');
            const c = sampleUuid('sample-branch-main');

            expect(a).toBe(b);
            expect(a).not.toBe(c);
            expect(a).toEqual(expect.stringMatching(UUID_RE));
        });

        it('purgeLegacyReadableIds destroys pre-uuid sample rows without touching real records', async () => {
            await database.write(async () => {
                await database.get('areas').create((r: any) => {
                    r._raw.id = 'sample-area-poblacion';
                    r._raw.name = '[sample-data] District 1 - Poblacion Agri-Center';
                });
                await database.get('collectors').create((r: any) => {
                    r._raw.id = 'sample-collector-main';
                    r._raw.full_name = '[sample-data] Main Field Collector';
                });
                await database.get('employees').create((r: any) => {
                    r._raw.id = 'real-employee-1';
                    r.firstName = 'Real';
                    r.lastName = 'Employee';
                });
            });

            const purged = await SampleDataService.purgeLegacyReadableIds(database);
            expect(purged).toBe(2);

            expect(await findByIdOrNull(database, 'areas', 'sample-area-poblacion')).toBeNull();
            expect(await findByIdOrNull(database, 'collectors', 'sample-collector-main')).toBeNull();
            expect(await findByIdOrNull(database, 'employees', 'real-employee-1')).not.toBeNull();
        });

        it('enable after purgeLegacyReadableIds does not resurrect legacy readable ids', async () => {
            await database.write(async () => {
                await database.get('areas').create((r: any) => {
                    r._raw.id = 'sample-area-poblacion';
                    r._raw.name = '[sample-data] District 1 - Poblacion Agri-Center';
                });
            });
            await SampleDataService.purgeLegacyReadableIds(database);
            await SampleDataService.enable(database);

            const areas = await database.get('areas').query().fetch();
            for (const area of areas as any[]) {
                expect(area.id).toEqual(expect.stringMatching(UUID_RE));
            }
        });
    });
});

async function findByIdOrNull(db: Database, table: string, id: string) {
    try {
        return await db.get(table as any).find(id);
    } catch {
        return null;
    }
}
