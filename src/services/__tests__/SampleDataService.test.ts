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
import { SampleDataService } from '../SampleDataService';
import { LOAN_PRODUCT_PRESETS } from '../../utils/loanProducts';

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

    it('seeds mock data across all modules (Agribusiness, Marketplace, Water Station, Banking, Employees)', async () => {
        await SampleDataService.enable(database);

        const parcels = await database.get<AgriParcel>('agri_parcels').query(Q.where('deleted_at', null)).fetch();
        const cycles = await database.get<AgriCropCycle>('agri_crop_cycles').query(Q.where('deleted_at', null)).fetch();
        const products = await database.get<MarketplaceProduct>('marketplace_products').query(Q.where('deleted_at', null)).fetch();
        const returns = await database.get<SalesReturn>('sales_returns').query(Q.where('deleted_at', null)).fetch();
        const wsCustomers = await database.get<WsCustomer>('ws_customers').query(Q.where('deleted_at', null)).fetch();
        const banks = await database.get<BankAccount>('bank_accounts').query(Q.where('deleted_at', null)).fetch();
        const employees = await database.get<Employee>('employees').query(Q.where('deleted_at', null)).fetch();

        expect(parcels.length).toBeGreaterThanOrEqual(2);
        expect(cycles.length).toBeGreaterThanOrEqual(2);
        expect(products.length).toBeGreaterThanOrEqual(3);
        expect(returns.length).toBeGreaterThanOrEqual(1);
        expect(returns[0].status).toBe('completed');
        expect(wsCustomers.length).toBeGreaterThanOrEqual(2);
        expect(banks.length).toBeGreaterThanOrEqual(2);
        expect(employees.length).toBeGreaterThanOrEqual(2);
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
                marketplaceProducts: 0,
                marketplaceStores: 0,
                salesReturns: 0,
                waterCustomers: 0,
                waterDeliveries: 0,
                bankAccounts: 0,
                employees: 0,
            },
        });
    });
});
