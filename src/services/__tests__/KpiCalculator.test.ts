import { KpiCalculator } from '../KpiCalculator';

describe('KpiCalculator', () => {
    describe('computeGLP', () => {
        it('calculates total principal of active and defaulted loans', () => {
            const loans = [
                { id: 'l1', principalAmount: 1000, status: 'active' },
                { id: 'l2', principalAmount: 500, status: 'defaulted' },
                { id: 'l3', principalAmount: 200, status: 'paid' },
            ] as any[];
            expect(KpiCalculator.computeGLP(loans)).toBe(1500);
        });
    });

    describe('computePAR', () => {
        it('calculates PAR and GLP independently', () => {
            const loans = [
                { id: '1', principalAmount: 1000, status: 'active' },
                { id: '2', principalAmount: 500, status: 'active' },
            ] as any[];
            
            const oldDate = '2020-01-01T00:00:00Z';
            
            const schedules = [
                { loanId: '1', dueDate: oldDate, status: 'pending', scheduledAmount: 100 },
                { loanId: '2', dueDate: new Date().toISOString(), status: 'pending', scheduledAmount: 100 },
            ] as any[];
            
            const payments = [
                { loanId: '1', amount: 200 }
            ] as any[];

            const res = KpiCalculator.computePAR(loans, schedules, payments, 30);
            expect(res.glp).toBe(1500);
            // Loan 1 is overdue. Without exact principal allocation, paid progress
            // is prorated against total receivable. With no totalAmount supplied,
            // total receivable falls back to principal, so 1000 - 200 = 800.
            // GLP = 1500. PAR = 800 / 1500 * 100 = 53.33%.
            expect(res.par).toBeCloseTo(53.33, 1);
        });

        it('limits par between 0 and 100', () => {
            const loans = [{ id: '1', principalAmount: 10, status: 'active' }] as any[];
            const schedules = [{ loanId: '1', dueDate: '2000-01-01', status: 'pending', scheduledAmount: 1000 }] as any[];
            const res = KpiCalculator.computePAR(loans, schedules, [], 0);
            expect(res.par).toBe(100);
        });

        it('returns zero PAR if GLP is zero', () => {
            const res = KpiCalculator.computePAR([], [], [], 30);
            expect(res.par).toBe(0);
            expect(res.glp).toBe(0);
        });
    });

    describe('calculation helpers', () => {
        it('computes ROA, ROE, OSS, FSS, OER, etc.', () => {
            expect(KpiCalculator.computeROA(10, 100)).toBe(10);
            expect(KpiCalculator.computeROA(10, 0)).toBe(0);

            expect(KpiCalculator.computeROE(20, 100)).toBe(20);
            expect(KpiCalculator.computeROE(20, 0)).toBe(0);

            expect(KpiCalculator.computeOSS(120, 50, 20, 30)).toBe(120);
            expect(KpiCalculator.computeOSS(120, 0, 0, 0)).toBe(0);

            expect(KpiCalculator.computeFSS(150, 50, 20, 30, 25, 25)).toBe(100);
            expect(KpiCalculator.computeFSS(150, 0, 0, 0, 0, 0)).toBe(0);

            expect(KpiCalculator.computeCollectionEfficiency(80, 100)).toBe(80);
            expect(KpiCalculator.computeCollectionEfficiency(80, 0)).toBe(0);

            expect(KpiCalculator.computeOER(15, 100)).toBe(15);
            expect(KpiCalculator.computeOER(15, 0)).toBe(0);

            expect(KpiCalculator.computeBorrowersPerLO(100, 4)).toBe(25);
            expect(KpiCalculator.computeBorrowersPerLO(100, 0)).toBe(0);

            expect(KpiCalculator.computeDebtToEquity(50, 100)).toBe(0.5);
            expect(KpiCalculator.computeDebtToEquity(50, 0)).toBe(0);

            expect(KpiCalculator.computeCAR(20, 100)).toBe(20);
            expect(KpiCalculator.computeCAR(20, 0)).toBe(0);

            const borrowers = [{ gender: 'female' }, { gender: 'female' }, { gender: 'male' }] as any[];
            expect(KpiCalculator.computeWomenRatio(borrowers)).toBeCloseTo(66.66, 1);
            expect(KpiCalculator.computeWomenRatio([])).toBe(0);

            expect(KpiCalculator.computeAvgLoanSize(1000, 10)).toBe(100);
            expect(KpiCalculator.computeAvgLoanSize(1000, 0)).toBe(0);
        });
    });

    describe('computeOutstandingBalance', () => {
        it('calculates outstanding balance correctly', () => {
            const loans = [
                { id: '1', principalAmount: 1000, totalAmount: 1200, status: 'active', collectorId: 'c1' },
                { id: '2', principalAmount: 500, totalAmount: 600, status: 'active', collectorId: 'c2' },
            ] as any[];
            const payments = [
                { loanId: '1', amount: 200 }
            ] as any[];

            const penalties = [
                { loanId: '1', amount: 50 }
            ] as any[];

            expect(KpiCalculator.computeOutstandingBalance(loans, payments, penalties)).toBe(1650);
            expect(KpiCalculator.computeOutstandingBalance(loans, payments, penalties, 'c1')).toBe(1050);
            expect(KpiCalculator.computeOutstandingBalance(loans, payments, penalties, 'c3')).toBe(0);
        });
    });

    describe('computeInterestIncome', () => {
        it('calculates interest portion of payments', () => {
            const loans = [
                { id: '1', principalAmount: 800, interestAmount: 120, depositAmount: 50, insuranceAmount: 30, totalAmount: 1000 },
            ] as any[];
            const payments = [
                { loanId: '1', amount: 100 },
                { loanId: '1', amount: 200 },
            ] as any[];
            // Interest is recognized proportionally against explicit interestAmount,
            // excluding deposit and insurance from operating revenue.
            expect(KpiCalculator.computeInterestIncome(payments, loans)).toBeCloseTo(36, 5);
            expect(KpiCalculator.computeInterestIncome(payments, [])).toBe(0);
        });
    });
});
