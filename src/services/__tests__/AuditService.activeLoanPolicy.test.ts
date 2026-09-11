import { AuditService } from '../AuditService';

const calcResult: any = {
    totalInterest: 100,
    totalFees: 0,
    totalAmount: 1100,
    schedule: [{ scheduledAmount: 1100 }],
    maturityDate: new Date(),
};

function createAuditServiceWithActiveLoans(activeLoans: any[]) {
    const db: any = {
        get: () => ({
            query: () => ({
                fetch: async () => activeLoans,
            }),
        }),
    };
    return new AuditService(db);
}

const baseLoanData = {
    borrowerId: 'borrower-1',
    principal: '1000',
    ratePercent: '10',
    deposit: '0',
    insurance: '0',
    releaseDate: new Date().toISOString(),
    isReloan: false,
    previousLoanId: '',
};

describe('AuditService active loan policy', () => {
    it('does not warn when borrower has an active loan of a different type', async () => {
        const audit = createAuditServiceWithActiveLoans([
            { id: 'loan-1', status: 'active', loanType: 'standard', loanNumber: 'LN-001' },
        ]);

        const issues = await audit.validateLoanPreSave(
            { ...baseLoanData, loanType: 'pension' },
            calcResult,
            false
        );

        expect(issues.find(issue => issue.id === 'pre_save_active_loan')).toBeUndefined();
    });

    it('warns when borrower has an active loan of the same type', async () => {
        const audit = createAuditServiceWithActiveLoans([
            { id: 'loan-1', status: 'active', loanType: 'pension', loanNumber: 'LN-001' },
        ]);

        const issues = await audit.validateLoanPreSave(
            { ...baseLoanData, loanType: 'pension' },
            calcResult,
            false
        );

        expect(issues.find(issue => issue.id === 'pre_save_active_loan')?.message)
            .toContain('Only one active loan is allowed per loan type');
    });

    it('does not warn when saving a renewal of the same active loan', async () => {
        const audit = createAuditServiceWithActiveLoans([
            { id: 'loan-1', status: 'active', loanType: 'pension', loanNumber: 'LN-001' },
        ]);

        const issues = await audit.validateLoanPreSave(
            { ...baseLoanData, loanType: 'pension', isReloan: true, previousLoanId: 'loan-1', deductedAmount: '100' },
            calcResult,
            false
        );

        expect(issues.find(issue => issue.id === 'pre_save_active_loan')).toBeUndefined();
    });
});
