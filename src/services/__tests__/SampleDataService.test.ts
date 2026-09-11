import { Database, Q } from '@nozbe/watermelondb';
import { createTestDatabase, closeTestDatabase } from '../../__tests__/test-utils';
import Loan from '../../database/models/Loan';
import Expense from '../../database/models/Expense';
import FileCase from '../../database/models/FileCase';
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
            },
        });
    });
});
